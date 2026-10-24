import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
test('published agreement text is immutable, acceptance captures its hash, and room polls create one visit event', async () => {
 const db = new PGlite();
 const investor = '00000000-0000-0000-0000-000000000001', text = 'Synthetic confidentiality agreement.';
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table public.astra_user_system_access(user_id uuid primary key,workflow boolean,investor_room boolean);
   grant update(workflow,investor_room) on public.astra_user_system_access to authenticated;
   create table public.astra_investor_settings(id boolean primary key,nda_text text default '',nda_version text default '',updated_at timestamptz default now());
   create table public.astra_investor_members(user_id uuid primary key,nda_version text,nda_accepted_at timestamptz);
   create table public.astra_investor_events(actor_id uuid,actor_email text,action text);
   grant select,update on public.astra_investor_settings,public.astra_investor_members to service_role;`);
  await db.query('insert into public.astra_investor_settings(id,nda_text,nda_version) values(true,$1,$2)', [text,'legacy-v1']);
  await db.query('insert into public.astra_investor_members values($1,$2,now())',[investor,'legacy-v1']);
  const sql=await readFile(new URL('../database/009_investor_integrity.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const digest=createHash('sha256').update(text).digest('hex');
  assert.equal((await db.query<{sha256:string}>('select * from public.astra_investor_nda_versions')).rows[0].sha256,digest);
  assert.equal((await db.query<{nda_sha256:string|null}>('select * from public.astra_investor_members')).rows[0].nda_sha256,null,'Historical acceptance is not fabricated');
  await db.exec('set role service_role');
  await assert.rejects(db.query("update public.astra_investor_nda_versions set nda_text='forged'"),/permission denied/);
  await assert.rejects(db.query("update public.astra_investor_settings set nda_text='forged'"),/new version/);
  await db.query("update public.astra_investor_members set nda_accepted_at=now() where user_id=$1",[investor]);
  assert.equal((await db.query<{nda_sha256:string}>('select * from public.astra_investor_members')).rows[0].nda_sha256,digest);
  const session='a'.repeat(64);for(let i=0;i<5;i++)await db.query('select public.astra_investor_record_room_open($1,$2,$3)',[investor,'synthetic@example.invalid',session]);
  await db.exec('reset role');assert.equal((await db.query('select * from public.astra_investor_events')).rows.length,1);
  for(const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from public.astra_investor_nda_versions'),/permission denied/);
   await assert.rejects(db.query('select public.astra_investor_record_room_open($1,$2,$3)',[investor,'synthetic@example.invalid',session]),/permission denied/);
   await db.exec('reset role');
  }
  await assert.rejects(db.query("update public.astra_investor_nda_versions set nda_text='forged'"),/immutable/);
  await assert.rejects(db.query('delete from public.astra_investor_nda_versions'),/immutable/);
  assert.equal((await db.query<{allowed:boolean}>("select has_column_privilege('authenticated','public.astra_user_system_access','investor_room','update') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query<{allowed:boolean}>("select has_column_privilege('authenticated','public.astra_user_system_access','workflow','update') as allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});
