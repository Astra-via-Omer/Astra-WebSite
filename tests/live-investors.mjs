// Explicit deployment validation, never run by npm test. Uses synthetic accounts
// and a synthetic PDF; no email is sent and no real investor files are imported.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
const base = process.argv[2]; if (!base?.startsWith('https://astra-investors-')) throw Error('Use the dedicated Astra investor service URL before public routing.');
const cloud = args => execFileSync('gcloud', [...args, '--project=astra-via', '--account=omer@astra-via.com'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const env = JSON.parse(cloud(['run', 'services', 'describe', 'astra-web', '--region=me-west1', '--format=json'])).spec.template.spec.containers[0].env;
const secret = env.find(e => e.name === 'SUPABASE_SERVICE_ROLE_KEY').valueFrom.secretKeyRef;
const url = env.find(e => e.name === 'SUPABASE_URL').value, publicKey = env.find(e => e.name === 'SUPABASE_ANON_KEY').value;
const db = createClient(url, cloud(['secrets', 'versions', 'access', secret.key, '--secret=' + secret.name]), { auth: { persistSession: false, autoRefreshToken: false } });
const checked = r => { if (r.error) throw Error('Validation database operation failed: ' + r.error.code); return r.data; };
const original = checked(await db.from('astra_investor_settings').select('*').single());
if (original.nda_text) throw Error('Validation requires the empty, newly provisioned room; never overwrite an active agreement.');
const suffix = randomBytes(5).toString('hex'), users = []; let documentId;
function totp(secret) {
  let bits = ''; for (const c of secret.toUpperCase().replace(/=+$/, '')) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0');
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const count = Buffer.alloc(8); count.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(count).digest(), offset = mac[19] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
async function api(client, path = '', body) {
  const session = client ? (await client.auth.getSession()).data.session : null;
  return fetch(base + '/api/investors' + path, { method: body ? 'POST' : 'GET', headers: { ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
}
async function json(client, body, path = '') { const r = await api(client, path, body); const data = await r.json(); assert.equal(r.status, 200, data.error); return data; }
async function person(name, role = 'investor') {
  const email = `astra-room-qa-${name}-${suffix}@example.com`, password = randomBytes(24).toString('base64url');
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'viewer' } });
  if (created.error) throw Error('Synthetic account creation failed.'); const id = created.data.user.id;
  users.push({ id, email });
  checked(await db.from('astra_investor_members').insert({ user_id: id, email, role, organization: 'SYNTHETIC SECURITY VALIDATION' }));
  checked(await db.from('astra_user_system_access').update({ investor_room: true }).eq('user_id', id));
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email, password }); if (login.error) throw Error('Synthetic sign-in failed.');
  return { client, id, email };
}
try {
  assert.equal((await api(null)).status, 401);
  assert.equal((await fetch(base + '/api/investors', { headers: { Authorization: 'Bearer forged.token.value' } })).status, 401);
  const admin = await person('admin', 'admin'), a = await person('a'), b = await person('b');
  assert.equal((await api(admin.client, '?admin=1')).status, 403, 'AAL1 administrator must be blocked');
  const enrollment = await admin.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Synthetic validation' });
  if (enrollment.error) throw Error('MFA enrollment validation failed: ' + enrollment.error.code);
  const verified = await admin.client.auth.mfa.challengeAndVerify({ factorId: enrollment.data.id, code: totp(enrollment.data.totp.secret) });
  if (verified.error) throw Error('MFA verification validation failed: ' + verified.error.code);
  assert.equal((await json(admin.client, undefined, '?admin=1')).members.length >= 4, true);
  assert.equal((await api(a.client, '', { action: 'save-nda', text: 'Forged' })).status, 403);
  const nda = await json(admin.client, { action: 'save-nda', text: 'SYNTHETIC VALIDATION ONLY. This temporary text tests acceptance versioning; it is not an investor agreement.' });
  const stateA = await json(a.client); assert.equal(stateA.canRead, false);
  assert.equal((await api(a.client, '', { action: 'question', question: 'Blocked before NDA' })).status, 403);
  assert.equal((await api(a.client, '', { action: 'accept-nda', version: 'stale-version' })).status, 409);
  await json(a.client, { action: 'accept-nda', version: stateA.nda.nda_version });
  await json(b.client, { action: 'accept-nda', version: stateA.nda.nda_version });
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) pdf.addPage().drawText('SYNTHETIC INVESTOR ROOM SECURITY VALIDATION', { x: 30, y: 700, size: 12, font });
  const form = new FormData(); form.set('title', 'Security validation sample — no investor information'); form.set('category', 'Company overview'); form.set('version', 'QA-' + suffix); form.set('description', 'Synthetic deployment validation. Withdrawn after testing.'); form.set('file', new Blob([await pdf.save()], { type: 'application/pdf' }), 'synthetic.pdf');
  documentId = (await json(admin.client, form)).id;
  await json(admin.client, { action: 'grant', user_id: a.id, document_id: documentId, can_view: true, can_download: false });
  assert.equal((await api(a.client, '/document/' + documentId)).status, 404, 'Draft document stays private');
  await json(admin.client, { action: 'publish', document_id: documentId, published: true });
  assert.equal((await api(b.client, '/document/' + documentId)).status, 404, 'Other investor has no grant');
  assert.equal((await api(a.client, '/document/' + documentId + '?download=1')).status, 404);
  let delivery = await api(a.client, '/document/' + documentId); assert.equal(delivery.status, 200);
  assert.match(delivery.headers.get('cache-control'), /no-store/);
  const first = await PDFDocument.load(await delivery.arrayBuffer()); assert.match(first.getSubject(), new RegExp(a.email)); assert.equal(first.getPageCount(), 2);
  delivery = await api(a.client, '/document/' + documentId); const second = await PDFDocument.load(await delivery.arrayBuffer()); assert.notEqual(first.getSubject(), second.getSubject());
  await json(admin.client, { action: 'grant', user_id: a.id, document_id: documentId, can_view: true, can_download: true });
  assert.equal((await api(a.client, '/document/' + documentId + '?download=1')).status, 200);
  await json(a.client, { action: 'share', document_id: documentId, email: b.email });
  let management = await json(admin.client, undefined, '?admin=1');
  const share = management.shares.find(s => s.sender_id === a.id);
  await json(admin.client, { action: 'resolve-share', id: share.id, status: 'approved' });
  assert.equal((await api(b.client, '/document/' + documentId)).status, 200);
  assert.equal((await api(b.client, '/document/' + documentId + '?download=1')).status, 404);
  await json(a.client, { action: 'question', question: 'Synthetic private question ' + suffix });
  assert.equal((await json(b.client)).questions.some(q => q.email === a.email), false);
  management = await json(admin.client, undefined, '?admin=1');
  const question = (await json(admin.client)).questions.find(q => q.email === a.email);
  await json(admin.client, { action: 'answer', id: question.id, answer: 'Synthetic administrator response.' });
  assert.equal((await json(a.client)).questions[0].answer, 'Synthetic administrator response.');
  const doc = checked(await db.from('astra_investor_documents').select('object_path').eq('id', documentId).single());
  assert.equal((await fetch('https://storage.googleapis.com/astra-via-investor-documents-418893440067/' + doc.object_path)).status, 403);
  const direct = await a.client.from('astra_investor_documents').select('*'); assert.ok(direct.error);
  checked(await db.from('astra_investor_members').update({ expires_at: '2020-01-01T00:00:00Z' }).eq('user_id', a.id));
  assert.equal((await api(a.client)).status, 403, 'Existing token loses expired access');
  checked(await db.from('astra_investor_members').update({ expires_at: null }).eq('user_id', a.id));
  checked(await db.from('astra_user_system_access').update({ investor_room: false }).eq('user_id', a.id));
  assert.equal((await api(a.client)).status, 403, 'Existing token loses revoked access');
  const events = checked(await db.from('astra_investor_events').select('*').eq('document_id', documentId).eq('action', 'document_delivered'));
  assert.ok(events.length >= 4); assert.ok(events.every(e => e.copy_id && e.details.delivered_sha256));
  console.log('Passed live: authentication, MFA, NDA versioning, uploads, private bucket, draft isolation, per-investor access, preview/download separation, personalized copies, sharing approval, private Q&A, audit hashes, expiry and immediate revocation.');
} finally {
  checked(await db.from('astra_investor_settings').update({ nda_text: original.nda_text, nda_version: original.nda_version, updated_at: original.updated_at }).eq('id', true));
  if (documentId) checked(await db.from('astra_investor_documents').update({ published: false }).eq('id', documentId));
  for (const user of users) {
    checked(await db.from('astra_user_system_access').update({ investor_room: false }).eq('user_id', user.id));
    checked(await db.from('astra_investor_members').update({ expires_at: '2020-01-01T00:00:00Z', stage: 'closed' }).eq('user_id', user.id));
    const suspended = await db.auth.admin.updateUserById(user.id, { ban_duration: '876000h' });
    if (suspended.error) throw Error('Synthetic account cleanup failed.');
  }
  checked(await db.from('astra_investor_events').insert({ actor_email: 'deployment-validation', action: 'validation_cleanup', details: { synthetic_accounts: users.length, synthetic_document: documentId || null } }));
  console.log('Synthetic accounts disabled; sample document withdrawn; original agreement restored.');
}
