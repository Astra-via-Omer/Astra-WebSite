// Manual production smoke test. Does not send email or change passwords/access.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const cloud = args => execFileSync('gcloud', [...args, '--account=omer@astra-via.com', '--project=astra-via'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const env = JSON.parse(cloud(['run', 'services', 'describe', 'astra-investors', '--region=me-west1', '--format=json'])).spec.template.spec.containers[0].env;
const secret = env.find(e => e.name === 'SUPABASE_SERVICE_ROLE_KEY').valueFrom.secretKeyRef;
const key = cloud(['secrets', 'versions', 'access', secret.key, '--secret=' + secret.name]);
const url = env.find(e => e.name === 'SUPABASE_URL').value, anon = env.find(e => e.name === 'SUPABASE_ANON_KEY').value;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(url, key, options), publicDb = createClient(url, anon, options);
const email = `unknown-recovery-qa-${Date.now()}@example.invalid`;
const hmac = (kind, value) => kind + ':' + createHmac('sha256', key).update(kind + ':' + value).digest('hex');
const input = { p_email: email, p_email_key: hmac('email', email), p_network_key: hmac('network', 'test-only-qa') };
const eligible = await db.rpc('astra_investor_reserve_reset', input);
assert.equal(eligible.error?.code, undefined, 'Recovery RPC failed: ' + eligible.error?.code);
assert.equal(eligible.data.length, 0);
assert.ok((await publicDb.rpc('astra_investor_reserve_reset', input)).error);
assert.ok((await publicDb.from('astra_investor_reset_limits').select('*')).error);
if (!process.argv.includes('--database-only')) for (const origin of ['https://astra-via.com', 'https://www.astra-via.com']) {
  const send = (body, from = origin) => fetch(origin + '/api/investors/reset', { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ok = await send({ email }); assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { ok: true });
  assert.match(ok.headers.get('cache-control'), /no-store/);
  assert.equal((await send({ email }, 'https://unapproved.example.invalid')).status, 403);
  assert.equal((await send({ email: 'invalid' })).status, 400);
  assert.equal((await send({ email: 'a'.repeat(1100) })).status, 413);
}
console.log('Live recovery smoke passed' + (process.argv.includes('--database-only') ? ' (database only).' : ': database, both origins, bounds, origin checks, no-store.') + ' No emails sent.');
