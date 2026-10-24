import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { mailConfig, recoveryUrl, sendRecoveryEmail } from '../src/investors/mail';

const config = { tenantId: '00000000-0000-0000-0000-000000000001', clientId: '00000000-0000-0000-0000-000000000002', clientSecret: 'test-only-secret', sender: 'investors@example.invalid' };
test('mail config fails closed and recovery links always use the canonical investor origin', () => {
  assert.deepEqual(mailConfig(JSON.stringify(config)), config);
  for (const value of [undefined, '{}', '{', JSON.stringify({ ...config, tenantId: '../tenant' }), JSON.stringify({ ...config, sender: 'x@example.invalid\nBcc: victim@example.invalid' }), JSON.stringify({ ...config, clientSecret: '' })]) assert.equal(mailConfig(value), null);
  assert.equal(recoveryUrl('a'.repeat(64)), 'https://astra-via.com/investors#token_hash=' + 'a'.repeat(64) + '&type=recovery');
  assert.throws(() => recoveryUrl('https://evil.invalid'));
});
test('recovery mail uses the existing app and sender; Graph acceptance is required', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return calls.length === 1 ? Response.json({ access_token: 'mock-token' }) : new Response(null, { status: 202 });
  };
  await sendRecoveryEmail(config, 'PERSON@EXAMPLE.INVALID', 'b'.repeat(64), transport);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`);
  const form = new URLSearchParams(calls[0].init.body as URLSearchParams);
  assert.equal(form.get('client_secret'), config.clientSecret);
  assert.equal(form.get('scope'), 'https://graph.microsoft.com/.default');
  assert.equal(calls[1].url, 'https://graph.microsoft.com/v1.0/users/investors%40example.invalid/sendMail');
  const body = JSON.parse(calls[1].init.body as string);
  assert.equal(body.saveToSentItems, false);
  assert.deepEqual(body.message.toRecipients, [{ emailAddress: { address: 'person@example.invalid' } }]);
  assert.equal(body.message.body.contentType, 'Text');
  assert.match(body.message.body.content, /https:\/\/astra-via.com\/investors#token_hash=b+&type=recovery/);
  assert.equal(body.message.body.content.includes(config.clientSecret), false);
  let count = 0;
  await assert.rejects(sendRecoveryEmail(config, 'person@example.invalid', 'b'.repeat(64), async () => { count++; return new Response(null, { status: 401 }); }), /authentication/);
  assert.equal(count, 1);
  await assert.rejects(sendRecoveryEmail(config, 'person@example.invalid', 'b'.repeat(64), async url => String(url).includes('oauth2') ? Response.json({ access_token: 'mock-token' }) : new Response(null, { status: 403 })), /rejected/);
});
test('recovery migration restricts RPC/table privileges and live eligibility without changing account access', async () => {
  const db = new PGlite();
  const id = '00000000-0000-0000-0000-000000000001', email = 'person@example.invalid';
  const emailKey = 'email:' + 'a'.repeat(64), networkKey = 'network:' + 'b'.repeat(64);
  const reserve = () => db.query('select * from public.astra_investor_reserve_reset($1,$2,$3)', [email, emailKey, networkKey]);
  const clearLimits = () => db.exec('reset role; truncate public.astra_investor_reset_limits; set role service_role');
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email varchar(255),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,raw_app_meta_data jsonb default '{}');
      create table public.astra_user_system_access(user_id uuid primary key,investor_room boolean default false,workflow boolean default true);
      create table public.astra_investor_members(user_id uuid primary key,expires_at timestamptz);`);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, email]);
    await db.query('insert into public.astra_user_system_access(user_id,investor_room) values($1,true)', [id]);
    await db.query('insert into public.astra_investor_members(user_id) values($1)', [id]);
    const sql = await readFile(new URL('../database/007_investor_recovery.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(reserve(), /permission denied/);
      await assert.rejects(db.query('select * from public.astra_investor_reset_limits'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.deepEqual((await reserve()).rows, [{ user_id: id, email }]);
    assert.equal((await reserve()).rows.length, 0, 'cooldown blocks immediate retry');
    await assert.rejects(db.query('select * from public.astra_investor_reset_limits'), /permission denied/);
    for (const change of ["update auth.users set email_confirmed_at=null", "update auth.users set banned_until=now()+interval '1 day'", "update auth.users set deleted_at=now()", "update auth.users set raw_app_meta_data='{\"disabled\":true}'", "update public.astra_user_system_access set investor_room=false", "update public.astra_investor_members set expires_at=now()-interval '1 day'"]) {
      await db.exec("reset role; update auth.users set email_confirmed_at=now(),banned_until=null,deleted_at=null,raw_app_meta_data='{}'; update public.astra_user_system_access set investor_room=true; update public.astra_investor_members set expires_at=null;");
      await db.exec(change); await clearLimits();
      assert.equal((await reserve()).rows.length, 0, change);
    }
    await db.exec("reset role; update public.astra_investor_members set expires_at=null; update public.astra_user_system_access set investor_room=true;");
    await clearLimits(); await reserve();
    for (let i = 0; i < 2; i++) { await db.exec("reset role; update public.astra_investor_reset_limits set last_at=now()-interval '2 minutes'; set role service_role"); assert.equal((await reserve()).rows.length, 1); }
    await db.exec("reset role; update public.astra_investor_reset_limits set last_at=now()-interval '2 minutes'; set role service_role");
    assert.equal((await reserve()).rows.length, 0, 'three per email per hour');
    await clearLimits(); await reserve();
    await db.exec("reset role; update public.astra_investor_reset_limits set requests=20 where key like 'network:%'; update public.astra_investor_reset_limits set last_at=now()-interval '2 minutes'; set role service_role");
    assert.equal((await reserve()).rows.length, 0, 'network cap');
    await clearLimits(); await reserve();
    await db.exec("reset role; update public.astra_investor_reset_limits set requests=120 where key='global'; update public.astra_investor_reset_limits set last_at=now()-interval '2 minutes'; set role service_role");
    assert.equal((await reserve()).rows.length, 0, 'global cap');
    await db.exec("reset role; update public.astra_investor_reset_limits set started_at=now()-interval '3 hours',last_at=now()-interval '3 hours'; set role service_role");
    assert.equal((await reserve()).rows.length, 1, 'expired windows are purged');
    await db.exec('reset role');
    assert.deepEqual((await db.query('select investor_room,workflow from public.astra_user_system_access')).rows, [{ investor_room: true, workflow: true }]);
    assert.equal(JSON.stringify((await db.query('select * from public.astra_investor_reset_limits')).rows).includes(email), false);
  } finally { await db.close(); }
});
