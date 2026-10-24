import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { assertDocument, assertMembership, emailField, limitedBody, type Member, type RoomDocument } from '../src/investors/policy';
import { preparePdf, watermarkPdf } from '../src/investors/pdf';
const member: Member = { user_id: '00000000-0000-0000-0000-000000000002', email: 'investor@example.invalid', role: 'investor', expires_at: null, stage: 'invited', nda_version: null, organization: '' };
test('access fails closed for unapproved, suspended, unverified, missing and expired memberships', () => {
  const verified = { email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {} };
  assert.doesNotThrow(() => assertMembership(verified, true, member));
  for (const user of [{}, { ...verified, app_metadata: { disabled: true } }, { ...verified, app_metadata: { disabled: 'true' } }, { ...verified, app_metadata: { directory_archived: true } }, { ...verified, app_metadata: { directory_archived: 'true' } }, { ...verified, banned_until: '2099-01-01T00:00:00Z' }]) assert.throws(() => assertMembership(user, true, member));
  assert.throws(() => assertMembership(verified, false, member));
  assert.throws(() => assertMembership(verified, true, null));
  for (const expires_at of ['2020-01-01T00:00:00Z', 'invalid']) assert.throws(() => assertMembership(verified, true, { ...member, expires_at }));
});
test('document grants separate preview and downloads; unpublished and cross-investor documents stay blocked', () => {
  const doc = { published: true } as RoomDocument;
  assert.doesNotThrow(() => assertDocument(member, doc, { can_view: true, can_download: false }, false));
  assert.throws(() => assertDocument(member, doc, { can_view: true, can_download: false }, true));
  assert.throws(() => assertDocument(member, doc, null, false));
  assert.throws(() => assertDocument(member, { ...doc, published: false }, { can_view: true, can_download: true }, false));
});
test('bounded requests reject oversized chunked bodies and forged content lengths', async () => {
  await assert.rejects(limitedBody(new Request('https://example.invalid', { method: 'POST', body: 'a'.repeat(11) }), 10));
  assert.equal((await limitedBody(new Request('https://example.invalid', { method: 'POST', body: 'abc' }), 10)).toString(), 'abc');
  assert.throws(() => emailField('person@example.invalid\nInjected: value'));
});
test('PDF delivery preserves pages, removes page actions, and creates distinct personalized copies', async () => {
  const source = await PDFDocument.create(); const font = await source.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) { const page = source.addPage([612, 792]); page.drawText(`Financial report ${i + 1}`, { font }); page.node.set(PDFName.of('AA'), source.context.obj({})); }
  const original = await source.save(); const clean = await preparePdf(original);
  const sanitized = await PDFDocument.load(clean.bytes);
  assert.equal(sanitized.getPageCount(), 3); assert.equal(sanitized.getPage(0).node.has(PDFName.of('AA')), false);
  const a = await watermarkPdf(clean.bytes, 'a@example.invalid', '2026-10-18T12:00:00Z', '1', 'copy-a');
  const b = await watermarkPdf(clean.bytes, 'b@example.invalid', '2026-10-18T12:00:00Z', '1', 'copy-b');
  assert.notDeepEqual(a, b); const pdfA = await PDFDocument.load(a);
  assert.match(pdfA.getSubject()!, /a@example.invalid/); assert.match(pdfA.getSubject()!, /copy-a/);
  assert.equal(pdfA.getPageCount(), 3); assert.equal(sanitized.getSubject(), undefined);
  await assert.rejects(preparePdf(Buffer.from('Not a PDF')));
  const empty = await PDFDocument.create(); await assert.rejects(preparePdf(await empty.save({ addDefaultPage: false })));
});
test('migration is repeatable; RLS blocks direct REST and preserves all existing application approvals', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001', investor = member.user_id;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',updated_at timestamptz,deleted_at timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.astra_user_system_access(user_id uuid primary key references auth.users(id),email text,workflow boolean default false,lab boolean default false,colossus boolean default false,enigma boolean default false,evidence boolean default false);
      alter table public.astra_user_system_access enable row level security;
      grant select on public.astra_user_system_access to authenticated;
      create policy own_approvals on public.astra_user_system_access for select to authenticated using(user_id=auth.uid());
      create function public.legacy_sync() returns trigger language plpgsql security definer as $$begin update auth.users set raw_app_meta_data=raw_app_meta_data||jsonb_build_object('system_access',jsonb_build_object('workflow',new.workflow,'lab',new.lab,'colossus',new.colossus,'enigma',new.enigma,'evidence',new.evidence)) where id=new.user_id; return new; end$$;
      create trigger legacy_sync before insert or update on public.astra_user_system_access for each row execute function public.legacy_sync();`);
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [owner, 'owner@example.invalid', investor, member.email]);
    await db.query('insert into public.astra_user_system_access(user_id,email,workflow,lab) values($1,$2,true,true),($3,$4,false,false)', [owner, 'owner@example.invalid', investor, member.email]);
    const migration = await readFile(new URL('../database/006_investor_room.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const directory = await readFile(new URL('../database/008_investor_directory.sql', import.meta.url), 'utf8');
    await db.exec(directory); await db.exec(directory);
    const approvals = (await db.query<{investor_room:boolean;workflow:boolean;lab:boolean}>('select * from public.astra_user_system_access where user_id=$1', [owner])).rows[0];
    assert.equal(approvals.investor_room, false); assert.equal(approvals.workflow, true); assert.equal(approvals.lab, true);
    await db.query('update public.astra_user_system_access set investor_room=true where user_id=$1', [investor]);
    await db.query('update public.astra_user_system_access set lab=true where user_id=$1', [investor]);
    const meta = (await db.query<{raw_app_meta_data:unknown}>('select raw_app_meta_data from auth.users where id=$1', [investor])).rows[0].raw_app_meta_data as { system_access: Record<string, boolean> };
    assert.equal(meta.system_access.investor_room, true); assert.equal(meta.system_access.workflow, false); assert.equal(meta.system_access.lab, true);
    await db.query(`insert into public.astra_investor_members(user_id,email) values($1,$2)`, [investor, member.email]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [investor]); await db.exec('set role authenticated');
    for (const table of ['members', 'documents', 'grants', 'events', 'settings', 'questions', 'shares']) await assert.rejects(db.query(`select * from public.astra_investor_${table}`), /permission denied/);
    assert.equal((await db.query('update public.astra_user_system_access set investor_room=false where user_id=$1 returning user_id', [investor])).rows.length, 0);
    await assert.rejects(db.query("select * from public.astra_investor_find_user('owner@example.invalid')"), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query("update public.astra_investor_events set action='forged'"), /append-only/);
    await assert.rejects(db.query('delete from public.astra_investor_events'), /append-only/);
    await db.exec('set role service_role');
    await assert.rejects(db.query("update public.astra_investor_events set action='forged'"), /permission denied/);
    const found = await db.query("select * from public.astra_investor_find_user('OWNER@EXAMPLE.INVALID')"); assert.equal(found.rows.length, 1);
    assert.equal((await db.query('select * from public.astra_investor_directory_members()')).rows.length, 1);
    await db.exec('reset role');
    await db.query(`update auth.users set raw_app_meta_data=raw_app_meta_data||'{"directory_archived":true}' where id=$1`, [investor]);
    await db.exec('set role service_role');
    assert.equal((await db.query('select * from public.astra_investor_directory_members()')).rows.length, 0, 'Archived fixture members are omitted');
    assert.equal((await db.query('select * from public.astra_investor_members')).rows.length, 1, 'Membership and audit references remain intact');
    await db.exec('reset role; set role authenticated');
    await assert.rejects(db.query('select * from public.astra_investor_directory_members()'), /permission denied/);

  } finally { await db.close(); }
});
