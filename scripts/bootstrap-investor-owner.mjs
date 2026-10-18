import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const cloud = args => execFileSync('gcloud', [...args, '--project=astra-via', '--account=omer@astra-via.com'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const env = JSON.parse(cloud(['run', 'services', 'describe', 'astra-web', '--region=me-west1', '--format=json'])).spec.template.spec.containers[0].env;
const secretRef = env.find(e => e.name === 'SUPABASE_SERVICE_ROLE_KEY').valueFrom.secretKeyRef;
// Credentials exist in process memory only. Never print these values.
const key = cloud(['secrets', 'versions', 'access', secretRef.key, '--secret=' + secretRef.name]);
const db = createClient(env.find(e => e.name === 'SUPABASE_URL').value, key, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = r => { if (r.error) throw Error('Owner provisioning could not be confirmed: ' + r.error.code); return r.data; };
const found = checked(await db.rpc('astra_investor_find_user', { p_email: 'omer@astra-via.com' }));
if (found.length !== 1) throw Error('The existing owner account was not found.');
const user = (await db.auth.admin.getUserById(found[0].user_id)).data.user;
if (!user?.email_confirmed_at || user.app_metadata.role !== 'admin' || user.app_metadata.disabled || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw Error('A verified active Astra owner account is required.');
const prior = checked(await db.from('astra_investor_members').select('role').eq('user_id', user.id).maybeSingle());
if (!prior) checked(await db.from('astra_investor_members').insert({ user_id: user.id, email: user.email, role: 'admin', organization: 'Astra-via' }));
if (prior && prior.role !== 'admin') throw Error('Existing membership requires administrator review.');
checked(await db.from('astra_user_system_access').update({ investor_room: true }).eq('user_id', user.id));
checked(await db.from('astra_investor_events').insert({ actor_id: user.id, actor_email: user.email, action: 'owner_bootstrapped', details: { source: 'trusted-deployment' } }));
console.log('Existing verified Astra owner enabled as investor administrator. Other accounts remain blocked.');
