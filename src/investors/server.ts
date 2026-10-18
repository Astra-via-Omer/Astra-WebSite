import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Storage } from '@google-cloud/storage';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { assertDocument, assertMembership, categories, emailField, limitedBody, RoomError, textField, uuid, type Member, type RoomDocument } from './policy';
import { preparePdf, watermarkPdf } from './pdf';
import { mailConfig, sendRecoveryEmail } from './mail';

const tables = { members: 'astra_investor_members', settings: 'astra_investor_settings', documents: 'astra_investor_documents', grants: 'astra_investor_grants', events: 'astra_investor_events', questions: 'astra_investor_questions', shares: 'astra_investor_shares' };
export const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
export function publicConfig() {
  const enabled = process.env.ASTRA_INVESTOR_ENABLED === 'on' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.ASTRA_INVESTOR_BUCKET;
  return { enabled, url: enabled ? process.env.SUPABASE_URL! : '', key: enabled ? process.env.SUPABASE_ANON_KEY! : '', passwordReset: enabled && process.env.ASTRA_INVESTOR_PASSWORD_RESET_ENABLED === 'on' && !!mailConfig(process.env.ASTRA_MICROSOFT_MAIL_JSON) };
}
function database() {
  if (!publicConfig().enabled) throw new RoomError(503, 'The investor room is being prepared. Please contact support@astra-via.com.');
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
type Context = { db: SupabaseClient; member: Member; token: string; mfa: boolean; request: Request };
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) { console.error('Investor database operation failed'); throw new RoomError(503, 'The operation could not be confirmed. Refresh and try again.'); }
  return result.data;
}
function assertOrigin(request: Request, required = false) {
  const origin = request.headers.get('origin');
  const expected = process.env.ASTRA_INVESTOR_ORIGIN || 'https://astra-via.com';
  if ((required && !origin) || (origin && ![expected, ...(process.env.ASTRA_INVESTOR_ADDITIONAL_ORIGINS || '').split(',').filter(Boolean)].includes(origin))) throw new RoomError(403, 'This request came from an unapproved origin.');
}
export async function context(request: Request): Promise<Context> {
  assertOrigin(request);
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token || token.length > 10000) throw new RoomError(401, 'Sign in to the investor room.');
  const db = database();
  const verified = await db.auth.getUser(token);
  if (verified.error || !verified.data.user) throw new RoomError(401, 'Your session has expired. Sign in again.');
  const user = verified.data.user;
  // Read live account suspension as well as the authenticated identity. Neither
  // user-editable metadata nor a stale JWT can grant investor access.
  const current = await db.auth.admin.getUserById(user.id);
  if (current.error || !current.data.user) throw new RoomError(401, 'This account is no longer available.');
  const approval = checked(await db.from('astra_user_system_access').select('investor_room').eq('user_id', user.id).maybeSingle());
  const member = checked(await db.from(tables.members).select('*').eq('user_id', user.id).maybeSingle()) as Member | null;
  assertMembership(current.data.user, approval?.investor_room === true, member);
  if (!member) throw new RoomError(403, 'Investor membership is required.');
  // Watermarks use the freshly verified Auth email, never form input or the
  // membership's display copy of the email.
  member.email = current.data.user.email!;
  const claims = await db.auth.getClaims(token);
  if (claims.error || !claims.data) throw new RoomError(401, 'The session could not be verified.');
  return { db, member, token, mfa: claims.data.claims.aal === 'aal2', request };
}
export async function requestPasswordReset(request: Request) {
  assertOrigin(request, true);
  const mail = mailConfig(process.env.ASTRA_MICROSOFT_MAIL_JSON);
  if (!publicConfig().passwordReset || !mail) throw new RoomError(503, 'Password reset is temporarily unavailable. Contact support@astra-via.com.');
  let input: unknown;
  try { input = JSON.parse((await limitedBody(request, 1024)).toString('utf8')); }
  catch (error) { if (error instanceof RoomError) throw error; throw new RoomError(400, 'Invalid request.'); }
  const email = emailField(input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>).email : null);
  // Google HTTPS LB appends client IP and LB IP. Ignore caller-supplied prefix.
  // Direct Cloud Run requests use the last proxy-appended address instead.
  const chain = (request.headers.get('x-forwarded-for') || '').split(',').map(v => v.trim());
  const address = chain.at(-1) === '34.49.17.123' ? chain.at(-2) : chain.at(-1);
  const key = (kind: string, value: string) => kind + ':' + createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(kind + ':' + value).digest('hex');
  const db = database();
  const eligible = checked(await db.rpc('astra_investor_reserve_reset', { p_email: email, p_email_key: key('email', email), p_network_key: key('network', address && isIP(address) ? address : 'unknown') })) as { user_id: string; email: string }[];
  if (eligible[0]) {
    const member = eligible[0];
    const event = async (action: string) => checked(await db.from(tables.events).insert({ actor_id: member.user_id, actor_email: member.email, action, details: { source: 'unauthenticated_reset_request' } }));
    // The actor is the target account; this event does not claim its owner made
    // the unauthenticated request. No recovery token enters audit/log output.
    await event('password_reset_requested');
    try {
      const generated = await db.auth.admin.generateLink({ type: 'recovery', email: member.email, options: { redirectTo: 'https://astra-via.com/investors' } });
      if (generated.error || generated.data.user?.id !== member.user_id) throw Error('Reset link could not be generated');
      await sendRecoveryEmail(mail, member.email, generated.data.properties.hashed_token);
      await event('password_reset_provider_accepted');
    } catch {
      await event('password_reset_failed');
      console.error('Investor password reset could not be confirmed');
    }
  }
  // Identical response for unknown, blocked, throttled, and eligible accounts.
  return { ok: true };
}
function administrator(ctx: Context) {
  if (ctx.member.role !== 'admin') throw new RoomError(403, 'Investor administrator access is required.');
  if (!ctx.mfa) throw new RoomError(403, 'Verify with your authenticator to manage the investor room.');
}
async function settings(ctx: Context) {
  const row = checked(await ctx.db.from(tables.settings).select('*').eq('id', true).single());
  return row as { nda_text: string; nda_version: string };
}
async function ndaRequired(ctx: Context) {
  if (ctx.member.role === 'admin') return;
  const room = await settings(ctx);
  if (!room.nda_text || !room.nda_version || ctx.member.nda_version !== room.nda_version) throw new RoomError(403, 'Accept the current confidentiality agreement before accessing documents or Q&A.');
}
async function audit(ctx: Context, action: string, details: Record<string, unknown> = {}, documentId?: string, copyId?: string) {
  checked(await ctx.db.from(tables.events).insert({ actor_id: ctx.member.user_id, actor_email: ctx.member.email, action, details, document_id: documentId || null, copy_id: copyId || null }));
}
export async function roomState(ctx: Context) {
  const room = await settings(ctx);
  const canRead = ctx.member.role === 'admin' || (!!room.nda_text && !!room.nda_version && ctx.member.nda_version === room.nda_version);
  const admin = ctx.member.role === 'admin' && ctx.mfa;
  let docs: Record<string, unknown>[] = [];
  if (canRead) {
    if (admin) docs = checked(await ctx.db.from(tables.documents).select('id,title,category,version,description,pages,bytes,published,created_at').order('created_at', { ascending: false })) || [];
    else {
      const grants = checked(await ctx.db.from(tables.grants).select('document_id,can_view,can_download').eq('user_id', ctx.member.user_id).eq('can_view', true)) || [];
      if (grants.length) {
        const rows = checked(await ctx.db.from(tables.documents).select('id,title,category,version,description,pages,bytes,published,created_at').in('id', grants.map(g => g.document_id)).eq('published', true).order('created_at', { ascending: false })) || [];
        docs = rows.map(d => ({ ...d, can_download: grants.find(g => g.document_id === d.id)?.can_download === true }));
      }
    }
  }
  const questions = canRead ? checked(await (admin ? ctx.db.from(tables.questions).select('*') : ctx.db.from(tables.questions).select('*').eq('user_id', ctx.member.user_id)).order('created_at', { ascending: false }).limit(100)) : [];
  await audit(ctx, 'room_opened');
  return { member: ctx.member, admin, needsMfa: ctx.member.role === 'admin' && !ctx.mfa, nda: room, canRead, documents: docs, questions, categories };
}
export async function adminState(ctx: Context, offset: number) {
  administrator(ctx);
  const members = checked(await ctx.db.from(tables.members).select('*').order('email')) || [];
  const approvals = checked(await ctx.db.from('astra_user_system_access').select('user_id,investor_room').in('user_id', members.map(m => m.user_id))) || [];
  const events = checked(await ctx.db.from(tables.events).select('*').order('occurred_at', { ascending: false }).order('id').range(offset, offset + 99));
  return {
    members: members.map(m => ({ ...m, approved: approvals.find(a => a.user_id === m.user_id)?.investor_room === true })),
    grants: checked(await ctx.db.from(tables.grants).select('*')),
    shares: checked(await ctx.db.from(tables.shares).select('*').order('created_at', { ascending: false }).limit(100)),
    events, offset,
  };
}
async function documentAccess(ctx: Context, id: string, download: boolean) {
  await ndaRequired(ctx);
  if (ctx.member.role === 'admin') administrator(ctx);
  const doc = checked(await ctx.db.from(tables.documents).select('*').eq('id', uuid(id)).maybeSingle()) as RoomDocument | null;
  const grant = ctx.member.role === 'admin' ? null : checked(await ctx.db.from(tables.grants).select('can_view,can_download').eq('user_id', ctx.member.user_id).eq('document_id', id).maybeSingle());
  assertDocument(ctx.member, doc, grant, download);
  return doc!;
}
export async function deliverDocument(ctx: Context, id: string, download: boolean) {
  const doc = await documentAccess(ctx, id, download);
  const copy = randomUUID(), date = new Date().toISOString();
  await audit(ctx, 'document_requested', { mode: download ? 'download' : 'preview', version: doc.version }, id, copy);
  const bucket = new Storage().bucket(process.env.ASTRA_INVESTOR_BUCKET!);
  const [source] = await bucket.file(doc.object_path).download({ validation: 'crc32c' });
  if (createHash('sha256').update(source).digest('hex') !== doc.sha256) throw new RoomError(503, 'Document integrity verification failed.');
  const result = await watermarkPdf(source, ctx.member.email, date, doc.version, copy);
  // Recheck after PDF generation to catch revocation/expiry during processing.
  const live = await context(ctx.request); await documentAccess(live, id, download);
  await audit(live, 'document_delivered', { mode: download ? 'download' : 'preview', version: doc.version, bytes: result.length, source_sha256: doc.sha256, delivered_sha256: createHash('sha256').update(result).digest('hex') }, id, copy);
  return { bytes: result, name: `${doc.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 80) || 'Investor document'} - ${copy}.pdf` };
}
export async function uploadDocument(ctx: Context) {
  administrator(ctx);
  const body = await limitedBody(ctx.request, 26 * 1024 * 1024);
  const form = await new Response(body, { headers: { 'content-type': ctx.request.headers.get('content-type') || '' } }).formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new RoomError(400, 'Select a PDF file.');
  const title = textField(form.get('title')), version = textField(form.get('version'), 40);
  const category = textField(form.get('category'));
  if (!(categories as readonly string[]).includes(category)) throw new RoomError(400, 'Choose a document category.');
  const description = textField(form.get('description') || '', 2000, false);
  const clean = await preparePdf(new Uint8Array(await file.arrayBuffer()));
  const id = randomUUID(), objectPath = `documents/${id}.pdf`;
  await audit(ctx, 'document_upload_requested', { title, version }, id);
  await new Storage().bucket(process.env.ASTRA_INVESTOR_BUCKET!).file(objectPath).save(clean.bytes, {
    resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
  });
  checked(await ctx.db.from(tables.documents).insert({ id, title, version, category, description, object_path: objectPath, pages: clean.pages, bytes: clean.bytes.length, sha256: createHash('sha256').update(clean.bytes).digest('hex'), published: false }));
  await audit(ctx, 'document_uploaded', { title, version, pages: clean.pages }, id);
  return { id };
}
export async function mutate(ctx: Context, body: Record<string, unknown>) {
  const { db } = ctx;
  if (body.action === 'accept-nda') {
    const room = await settings(ctx);
    if (!room.nda_text || !room.nda_version || body.version !== room.nda_version) throw new RoomError(409, 'The agreement changed. Refresh and read the current version.');
    await audit(ctx, 'nda_acceptance_requested', { version: room.nda_version });
    checked(await db.from(tables.members).update({ nda_version: room.nda_version, nda_accepted_at: new Date().toISOString() }).eq('user_id', ctx.member.user_id));
    await audit(ctx, 'nda_accepted', { version: room.nda_version });
  } else if (body.action === 'question') {
    await ndaRequired(ctx); const question = textField(body.question, 4000);
    await audit(ctx, 'question_submission_requested');
    checked(await db.from(tables.questions).insert({ user_id: ctx.member.user_id, email: ctx.member.email, question }));
    await audit(ctx, 'question_submitted');
  } else if (body.action === 'share') {
    const doc = await documentAccess(ctx, uuid(body.document_id), false); const recipient = emailField(body.email);
    if (recipient === ctx.member.email.toLowerCase()) throw new RoomError(400, 'Enter your colleague’s email address.');
    await audit(ctx, 'share_requested', { recipient }, doc.id);
    checked(await db.from(tables.shares).insert({ sender_id: ctx.member.user_id, sender_email: ctx.member.email, recipient_email: recipient, document_id: doc.id }));
  } else {
    administrator(ctx);
    if (body.action === 'save-nda') {
      const nda = textField(body.text, 30000); const version = randomUUID();
      await audit(ctx, 'nda_publication_requested', { version });
      checked(await db.from(tables.settings).update({ nda_text: nda, nda_version: version, updated_at: new Date().toISOString() }).eq('id', true));
      await audit(ctx, 'nda_published', { version });
    } else if (body.action === 'member') {
      const email = emailField(body.email); const role = body.role === 'admin' ? 'admin' : 'investor';
      const expires = body.expires_at ? textField(body.expires_at, 40) : null;
      if (expires && (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now())) throw new RoomError(400, 'Choose an expiry in the future.');
      const stages = ['invited', 'reviewing', 'follow-up', 'committed', 'closed'];
      const stage = typeof body.stage === 'string' && stages.includes(body.stage) ? body.stage : 'invited';
      await audit(ctx, 'member_change_requested', { email, role, approved: body.approved === true, expires_at: expires, stage });
      const found = checked(await db.rpc('astra_investor_find_user', { p_email: email })) as { user_id: string; email: string }[];
      let userId = found[0]?.user_id, inviteLink: string | undefined;
      if (!userId) {
        const invite = await db.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: (process.env.ASTRA_INVESTOR_ORIGIN || 'https://astra-via.com') + '/investors' } });
        if (invite.error || !invite.data.user) throw new RoomError(400, 'The invitation could not be created. Check this email in Supabase.');
        userId = invite.data.user.id; inviteLink = (process.env.ASTRA_INVESTOR_ORIGIN || 'https://astra-via.com') + '/investors#token_hash=' + encodeURIComponent(invite.data.properties.hashed_token) + '&type=invite';
      }
      if (userId === ctx.member.user_id) throw new RoomError(400, 'Use another administrator to change your own investor access.');
      checked(await db.from(tables.members).upsert({ user_id: userId, email, role, organization: textField(body.organization || '', 200, false), expires_at: expires, stage }, { onConflict: 'user_id' }));
      // This only sets the Investor Room flag; other system approvals are untouched.
      const updated = checked(await db.from('astra_user_system_access').update({ investor_room: body.approved === true }).eq('user_id', userId).select('user_id'));
      if (!updated?.length) throw new RoomError(409, 'The shared system approval record is missing. Check the Supabase setup.');
      await audit(ctx, 'member_saved', { user_id: userId, email, approved: body.approved === true });
      return { invitation: inviteLink || null };
    } else if (body.action === 'grant') {
      const userId = uuid(body.user_id), docId = uuid(body.document_id);
      await audit(ctx, 'document_permission_change_requested', { user_id: userId, can_view: body.can_view === true, can_download: body.can_view === true && body.can_download === true }, docId);
      checked(await db.from(tables.grants).upsert({ user_id: userId, document_id: docId, can_view: body.can_view === true, can_download: body.can_view === true && body.can_download === true }));
      await audit(ctx, 'document_permission_changed', { user_id: userId, can_view: body.can_view === true, can_download: body.can_view === true && body.can_download === true }, docId);
    } else if (body.action === 'publish') {
      const id = uuid(body.document_id);
      await audit(ctx, 'document_publication_change_requested', { published: body.published === true }, id);
      checked(await db.from(tables.documents).update({ published: body.published === true }).eq('id', id));
      await audit(ctx, 'document_publication_changed', { published: body.published === true }, id);
    } else if (body.action === 'answer') {
      const id = uuid(body.id), answer = textField(body.answer, 8000);
      await audit(ctx, 'question_answer_requested', { question_id: id });
      checked(await db.from(tables.questions).update({ answer, answered_at: new Date().toISOString() }).eq('id', id));
      await audit(ctx, 'question_answered', { question_id: id });
    } else if (body.action === 'resolve-share') {
      const id = uuid(body.id); const status = body.status === 'approved' ? 'approved' : 'declined';
      const share = checked(await db.from(tables.shares).select('*').eq('id', id).single());
      if (status === 'approved') {
        const member = checked(await db.from(tables.members).select('user_id').eq('email', share.recipient_email).maybeSingle());
        if (!member) throw new RoomError(400, 'Add the recipient as an investor first, then approve this request.');
        await audit(ctx, 'shared_document_grant_requested', { share_id: id, recipient: share.recipient_email }, share.document_id);
        // A colleague receives preview permission; downloads need separate approval.
        const prior = checked(await db.from(tables.grants).select('can_download').eq('user_id', member.user_id).eq('document_id', share.document_id).maybeSingle());
        checked(await db.from(tables.grants).upsert({ user_id: member.user_id, document_id: share.document_id, can_view: true, can_download: prior?.can_download === true }));
        await audit(ctx, 'shared_document_granted', { share_id: id, recipient: share.recipient_email }, share.document_id);
      }
      await audit(ctx, 'share_resolution_requested', { share_id: id, status, recipient: share.recipient_email });
      checked(await db.from(tables.shares).update({ status }).eq('id', id));
      await audit(ctx, 'share_resolved', { share_id: id, status, recipient: share.recipient_email });
    } else throw new RoomError(400, 'Unknown investor room action.');
  }
  return { ok: true };
}
export function errorResponse(error: unknown) {
  const known = error instanceof RoomError;
  if (!known) console.error('Investor request failed');
  return Response.json({ error: known ? error.message : 'The request could not be completed. Please try again.' }, { status: known ? error.status : 503, headers: privateHeaders });
}
