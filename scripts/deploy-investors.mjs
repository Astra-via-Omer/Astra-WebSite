import { execFileSync } from 'node:child_process';
const project = 'astra-via', region = 'me-west1', account = 'omer@astra-via.com';
const runtime = `astra-investor-runtime@${project}.iam.gserviceaccount.com`;
const bucket = 'astra-via-investor-documents-418893440067';
const mode = process.argv[2];
const cloud = args => execFileSync('gcloud', [...args, '--project=' + project, ...(process.env.GITHUB_ACTIONS ? [] : ['--account=' + account])], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const exists = args => { try { cloud(args); return true; } catch { return false; } };
if (mode === 'provision') {
  if (!exists(['iam', 'service-accounts', 'describe', runtime])) cloud(['iam', 'service-accounts', 'create', 'astra-investor-runtime', '--display-name=Astra Investor Room runtime']);
  if (!exists(['storage', 'buckets', 'describe', 'gs://' + bucket])) cloud(['storage', 'buckets', 'create', 'gs://' + bucket, '--location=' + region, '--uniform-bucket-level-access', '--public-access-prevention']);
  cloud(['storage', 'buckets', 'update', 'gs://' + bucket, '--uniform-bucket-level-access', '--public-access-prevention', '--versioning', '--soft-delete-duration=7d']);
  for (const role of ['roles/storage.objectCreator', 'roles/storage.objectViewer']) cloud(['storage', 'buckets', 'add-iam-policy-binding', 'gs://' + bucket, '--member=serviceAccount:' + runtime, '--role=' + role]);
  cloud(['secrets', 'add-iam-policy-binding', 'astra-supabase-service-role', '--member=serviceAccount:' + runtime, '--role=roles/secretmanager.secretAccessor']);
  if (process.env.ASTRA_MICROSOFT_MAIL_SECRET_VERSION) cloud(['secrets', 'add-iam-policy-binding', 'astra-microsoft-mail', '--member=serviceAccount:' + runtime, '--role=roles/secretmanager.secretAccessor']);
  console.log('Investor runtime and private document bucket provisioned.');
} else if (mode === 'deploy') {
  const image = process.argv[3]; if (!image?.startsWith('me-west1-docker.pkg.dev/astra-via/astra-images/astra-website:')) throw Error('An Astra website image is required.');
  const env = process.env.SUPABASE_URL ? [] : JSON.parse(cloud(['run', 'services', 'describe', 'astra-web', '--region=' + region, '--format=json'])).spec.template.spec.containers[0].env;
  const url = process.env.SUPABASE_URL || env.find(e => e.name === 'SUPABASE_URL')?.value, key = process.env.SUPABASE_ANON_KEY || env.find(e => e.name === 'SUPABASE_ANON_KEY')?.value;
  const secret = process.env.SUPABASE_ADMIN_SECRET_VERSION ? { name: 'astra-supabase-service-role', key: process.env.SUPABASE_ADMIN_SECRET_VERSION } : env.find(e => e.name === 'SUPABASE_SERVICE_ROLE_KEY')?.valueFrom?.secretKeyRef;
  if (!url || !key || !secret) throw Error('The existing Supabase configuration is incomplete.');
  const mailVersion = process.env.ASTRA_MICROSOFT_MAIL_SECRET_VERSION;
  if (mailVersion && !/^[1-9][0-9]*$/.test(mailVersion)) throw Error('Pin an enabled Microsoft mail secret version.');
  if (process.env.ASTRA_INVESTOR_PASSWORD_RESET_ENABLED === 'on' && !mailVersion) throw Error('Password reset requires an existing Microsoft mail configuration.');
  cloud(['run', 'deploy', 'astra-investors', '--region=' + region, '--image=' + image, '--service-account=' + runtime, '--port=8080', '--cpu=1', '--memory=1Gi', '--concurrency=4', '--min-instances=0', '--max-instances=2', '--timeout=120', ...(process.env.GITHUB_ACTIONS ? [] : ['--allow-unauthenticated']), '--quiet',
    '--set-env-vars=^|^ASTRA_INVESTOR_ENABLED=on|ASTRA_INVESTOR_ORIGIN=https://astra-via.com|ASTRA_INVESTOR_ADDITIONAL_ORIGINS=https://www.astra-via.com|GOOGLE_CLOUD_PROJECT=' + project + '|SUPABASE_URL=' + url + '|SUPABASE_ANON_KEY=' + key + '|ASTRA_INVESTOR_BUCKET=' + bucket + '|ASTRA_INVESTOR_PASSWORD_RESET_ENABLED=' + (process.env.ASTRA_INVESTOR_PASSWORD_RESET_ENABLED === 'on' ? 'on' : 'off'),
    '--set-secrets=SUPABASE_SERVICE_ROLE_KEY=' + secret.name + ':' + secret.key + (mailVersion ? ',ASTRA_MICROSOFT_MAIL_JSON=astra-microsoft-mail:' + mailVersion : '')]);
  console.log(cloud(['run', 'services', 'describe', 'astra-investors', '--region=' + region, '--format=value(status.url)']));
} else if (mode === 'route') {
  if (!exists(['compute', 'network-endpoint-groups', 'describe', 'astra-investors-neg', '--region=' + region])) cloud(['compute', 'network-endpoint-groups', 'create', 'astra-investors-neg', '--region=' + region, '--network-endpoint-type=serverless', '--cloud-run-service=astra-investors']);
  if (!exists(['compute', 'backend-services', 'describe', 'astra-investors-backend', '--global'])) {
    cloud(['compute', 'backend-services', 'create', 'astra-investors-backend', '--global', '--load-balancing-scheme=EXTERNAL_MANAGED', '--protocol=HTTP']);
    cloud(['compute', 'backend-services', 'add-backend', 'astra-investors-backend', '--global', '--network-endpoint-group=astra-investors-neg', '--network-endpoint-group-region=' + region]);
  }
  cloud(['compute', 'url-maps', 'add-path-matcher', 'astra-website-lb', '--path-matcher-name=astra-site-investors', '--default-service=astra-website-backend', '--backend-service-path-rules=/investors=astra-investors-backend,/investors/*=astra-investors-backend,/api/investors=astra-investors-backend,/api/investors/*=astra-investors-backend', '--new-hosts=astra-via.com,www.astra-via.com']);
  console.log('Investor paths routed to the dedicated service.');
} else throw Error('Use provision, deploy IMAGE, or route.');
