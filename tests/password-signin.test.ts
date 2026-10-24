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
   return require(name);
  },
 });
 const token = 'synthetic.' + Buffer.from(JSON.stringify({ aal: 'aal1' })).toString('base64url') + '.password-session';
 const request = new Request('https://astra-via.com/api/investors', { headers: { Authorization: 'Bearer ' + token } });
 return { server: module.exports, member, user, approval, events, state, verifiedTokens, token, request };
}
test('an approved investor administrator can manage the room after password sign-in', async () => {
 const f = fixture(), ctx = await f.server.context(f.request);
 assert.deepEqual(f.verifiedTokens, [f.token]);
 const state = await f.server.roomState(ctx);
 assert.equal(state.admin, true); assert.equal(state.documents[0].published, false);
 assert.equal((await f.server.adminState(ctx, 0)).members[0].user_id, f.user.id);
 assert(f.events.some(event => event.action === 'room_opened'));
});
test('password sign-in retains investor membership and role boundaries', async () => {
 const f = fixture(); f.member.role = 'investor';
 const ctx = await f.server.context(f.request);
 assert.equal((await f.server.roomState(ctx)).admin, false);
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
