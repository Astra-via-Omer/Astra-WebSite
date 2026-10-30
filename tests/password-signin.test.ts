import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/investors/policy';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../src/investors/server.ts', import.meta.url), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function fixture() {
 const user = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.invalid', email_confirmed_at: '2026-01-01', app_metadata: { role: 'admin', disabled: false } };
 const member: policy.Member = { user_id: user.id, email: user.email, role: 'admin', expires_at: null, stage: 'invited', nda_version: null, organization: '' };
 const approval = { user_id: user.id, investor_room: true };
 const events: any[] = [], verifiedTokens: string[] = [];
 const tables: Record<string, any[]> = {
  astra_user_system_access: [approval], astra_investor_members: [member],
  astra_investor_settings: [{ id: true, nda_text: 'Test agreement', nda_version: 'test-version' }],
  astra_investor_documents: [{ id: 'draft', title: 'Private draft', published: false }],
  astra_investor_events: events, astra_investor_questions: [], astra_investor_grants: [], astra_investor_shares: [],
 };
 const state = { accepted: true };
 const db = {
  auth: {
   getUser: async (token: string) => { verifiedTokens.push(token); return { data: { user: state.accepted ? user : null }, error: state.accepted ? null : Error('Expired') }; },
   getClaims: async () => ({ data: { claims: { aal: 'aal1', session_id: 'synthetic-session' } }, error: null }),
   admin: { getUserById: async () => ({ data: { user }, error: null }) },
  },
  rpc: async () => ({ data: [member], error: null }),
  from(table: string) {
   const rows = tables[table]; assert(rows, table);
   let single = false, insert: any, update: any;
   const filters: Array<(row: any) => boolean> = [];
   const query: any = {
    select: () => query, order: () => query, limit: () => query, range: () => query,
    eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
    in: (key: string, values: any[]) => { filters.push(row => values.includes(row[key])); return query; },
    single: () => { single = true; return query; }, maybeSingle: () => { single = true; return query; },
    insert: (value: any) => { insert = value; return query; }, update: (value: any) => { update = value; return query; },
    then(resolve: any, reject: any) {
     const matches = rows.filter(row => filters.every(filter => filter(row)));
     if (insert) rows.push(insert);
     if (update) matches.forEach(row => Object.assign(row, update));
     return Promise.resolve({ data: single ? matches[0] || null : matches, error: null }).then(resolve, reject);
    },
   };
   return query;
  },
 };
 const module = { exports: {} as any };
 vm.runInNewContext(source, { module, exports: module.exports, Request, Response, Buffer, console,
  process: { env: { ASTRA_INVESTOR_ENABLED: 'on', SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'synthetic-public', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin', ASTRA_INVESTOR_BUCKET: 'synthetic-bucket' } },
  require(name: string) {
   if (name === 'server-only') return {};
   if (name === '@supabase/supabase-js') return { createClient: () => db };
   if (name === '@google-cloud/storage' || name === './pdf') return {};
   if (name === './mail') return { mailConfig: () => null };
   if (name === './policy') return policy;
   if (name === './presentation') return { investorDisplayName: () => 'Owner' };
   if (name === './dispatchFeed') return { readInvestorProgress: async (canRead: boolean) => canRead ? { entries: [{ id: 'private-progress' }] } : null };
   return require(name);
  },
 });
 const token = 'synthetic.' + Buffer.from(JSON.stringify({ aal: 'aal1' })).toString('base64url') + '.password-session';
 const request = new Request('https://astra-via.com/api/investors', { headers: { Authorization: 'Bearer ' + token } });
 return { server: module.exports, member, user, approval, events, state, verifiedTokens, token, request, tables };
}
test('an approved investor administrator can manage the room after password sign-in', async () => {
 const f = fixture(), ctx = await f.server.context(f.request);
 assert.deepEqual(f.verifiedTokens, [f.token]);
 const state = await f.server.roomState(ctx);
 assert.equal(state.admin, true); assert.equal(state.documents[0].published, false);
 assert.equal(state.progress.entries[0].id, 'private-progress');
 assert.equal((await f.server.adminState(ctx, 0)).members[0].user_id, f.user.id);
 assert(f.events.some(event => event.action === 'room_opened'));
});
test('password sign-in retains investor membership and role boundaries', async () => {
 const f = fixture(); f.member.role = 'investor';
 const ctx = await f.server.context(f.request);
 const state = await f.server.roomState(ctx);
 assert.equal(state.admin, false); assert.equal(state.canRead, false); assert.equal(state.progress, null);
 await assert.rejects(f.server.adminState(ctx, 0), /administrator access/);
 await assert.rejects(f.server.mutate(ctx, { action: 'save-nda', text: 'Forged' }), /administrator access/);
 f.approval.investor_room = false;
 await assert.rejects(f.server.context(f.request), /not approved/);
});
test('revoked sessions and disabled or expired accounts remain blocked', async () => {
 const f = fixture(); f.state.accepted = false;
 await assert.rejects(f.server.context(f.request), /session has expired/);
 f.state.accepted = true; f.user.app_metadata.disabled = true;
 await assert.rejects(f.server.context(f.request), /suspended/);
 f.user.app_metadata.disabled = false; f.member.expires_at = '2020-01-01';
 await assert.rejects(f.server.context(f.request), /expired/);
});

test('power users see published previews and their own questions without any management capability', async () => {
 const f = fixture(); f.member.role = 'power_user'; f.member.nda_version = 'test-version';
 f.tables.astra_investor_documents.push({ id: 'published', title: 'Published material', published: true, category: 'Company overview' });
 f.tables.astra_investor_questions.push({ id: 'own', user_id: f.user.id }, { id: 'another-person', user_id: 'another-user' });
 const ctx = await f.server.context(f.request), state = await f.server.roomState(ctx);
 assert.equal(state.admin, false); assert(!state.tabs.includes('admin'));
 assert.equal(state.tabs.length, 5); assert.equal(state.documents.length, 1); assert.equal(state.documents[0].id, 'published');
 assert.equal(state.documents[0].can_download, false); assert.equal(state.questions.length, 1); assert.equal(state.questions[0].id, 'own');
 for (const action of ['member-access','member','grant','publish','save-nda','answer','resolve-share']) await assert.rejects(f.server.mutate(ctx,{action}), /administrator access/);
 await assert.rejects(f.server.adminState(ctx,0), /administrator access/);
});
test('unapproved tabs do not leak documents, updates or question data and cannot submit questions', async () => {
 const f = fixture(); f.member.role = 'investor'; f.member.nda_version = 'test-version'; f.member.tab_access = ['overview'];
 f.tables.astra_investor_documents.push({ id:'published',title:'Restricted material',published:true,category:'Company overview' });
 f.tables.astra_investor_grants.push({ user_id:f.user.id,document_id:'published',can_view:true,can_download:true });
 f.tables.astra_investor_questions.push({ id:'own',user_id:f.user.id });
 const ctx = await f.server.context(f.request); let state = await f.server.roomState(ctx);
 assert.equal(state.documents.length,0); assert.equal(state.questions.length,0); assert.equal(state.progress,null);
 assert.equal(state.tabs.join(','),'overview,account');
 await assert.rejects(f.server.mutate(ctx,{action:'question',question:'Unapproved request'}), /not approved/);
 f.member.tab_access = ['updates'];
 f.tables.astra_investor_documents.push({ id:'update',title:'Approved briefing',published:true,category:'Investor updates' });
 f.tables.astra_investor_grants.push({ user_id:f.user.id,document_id:'update',can_view:true,can_download:false });
 state = await f.server.roomState(ctx);
 assert.equal(state.documents.length,1); assert.equal(state.documents[0].id,'update'); assert(state.progress);
});
test('only administrators can atomically save valid room roles and tabs while preserving other access', async () => {
 const f = fixture(), ctx = await f.server.context(f.request), target='00000000-0000-0000-0000-000000000002';
 f.tables.astra_investor_members.push({ user_id:target,email:'person@example.invalid',role:'investor',tab_access:['overview'],expires_at:null,organization:'Original organization' });
 await f.server.mutate(ctx,{action:'member-access',user_id:target,role:'power_user',tab_access:['overview']});
 const saved=f.tables.astra_investor_members[1]; assert.equal(saved.role,'power_user'); assert.equal(saved.organization,'Original organization');
 assert.equal(f.approval.investor_room,true); assert.equal(f.member.role,'admin');
 assert(f.events.some(e=>e.action==='room_permissions_changed'));
 await assert.rejects(f.server.mutate(ctx,{action:'member-access',user_id:target,role:'super_admin',tab_access:[]}),/valid room role/);
 await assert.rejects(f.server.mutate(ctx,{action:'member-access',user_id:target,role:'investor',tab_access:['admin']}),/valid investor tabs/);
 await assert.rejects(f.server.mutate(ctx,{action:'member-access',user_id:f.user.id,role:'investor',tab_access:[]}),/another administrator/);
});
