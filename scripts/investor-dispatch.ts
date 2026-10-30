// Trusted local publisher. Uses the existing owner's cloud login and existing private document bucket.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { investorProgress } from '../src/investors/dispatch';

const cloud = (args: string[]) => execFileSync('gcloud', [...args, '--project=astra-via', '--account=omer@astra-via.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function run() {
  const command = process.argv[2];
  if (!['read', 'publish'].includes(command)) throw Error('Use read, or publish PRIVATE_JSON_PATH.');
  let body: string | undefined;
  if (command === 'publish') {
    if (!process.argv[3] || !/^\d+$/.test(process.argv[4] || '')) throw Error('Pass PRIVATE_JSON_PATH and the expected generation returned by read.');
    body = readFileSync(process.argv[3], 'utf8');
    if (Buffer.byteLength(body) > 256 * 1024) throw Error('Dispatch exceeds the size limit.');
    investorProgress(JSON.parse(body), true);
  }
  const service = JSON.parse(cloud(['run', 'services', 'describe', 'astra-investors', '--region=me-west1', '--format=json']));
  const bucket = service.spec.template.spec.containers[0].env.find((e: { name: string }) => e.name === 'ASTRA_INVESTOR_BUCKET')?.value;
  if (!bucket || !/^[a-z0-9][a-z0-9._-]+$/.test(bucket)) throw Error('Existing investor bucket configuration is required.');
  const token = cloud(['auth', 'print-access-token']);
  const headers = { Authorization: `Bearer ${token}` };
  const object = 'investor-dispatch/current.json';
  const endpoint = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}`;
  const metadata = await fetch(endpoint, { headers, signal: AbortSignal.timeout(30000) });
  if (!metadata.ok && metadata.status !== 404) throw Error(`Cannot verify current dispatch (${metadata.status}).`);
  const generation = metadata.ok ? String((await metadata.json()).generation) : '0';
  let current: string | undefined;
  if (generation !== '0') {
    const response = await fetch(`${endpoint}?alt=media&generation=${generation}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Cannot read current dispatch (${response.status}).`);
    current = await response.text();
  }
  if (command === 'read') { console.log(JSON.stringify({ generation, content: current ? JSON.parse(current) : null }, null, 2)); return; }
  if (generation !== process.argv[4]) throw Error('The feed changed since the draft was prepared. Read and reconcile before publishing.');
  if (current && JSON.stringify(JSON.parse(current)) === JSON.stringify(JSON.parse(body!))) { console.log('Dispatch unchanged; no publication.'); return; }
  const upload = async (name: string, match: string) => {
    const metadata = { name, contentType: 'application/json', cacheControl: 'private, no-store, max-age=0' };
    const boundary = 'astra_dispatch_' + createHash('sha256').update(body!).digest('hex').slice(0, 24);
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--\r\n`;
    const query = new URLSearchParams({ uploadType: 'multipart', ifGenerationMatch: match });
    const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?${query}`, { method: 'POST', headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(response.status === 412 ? 'Another publication changed this object. Read the latest feed and reconcile before retrying.' : `Private publication failed (${response.status}).`);
    return response.json();
  };
  // Immutable archive first. A failed current-pointer update leaves an unpublished archive, not a lost update.
  const hash = createHash('sha256').update(body!).digest('hex');
  const archive = `investor-dispatch/history/${JSON.parse(body!).publishedAt.replaceAll(':', '-')}-${hash.slice(0, 12)}.json`;
  try { await upload(archive, '0'); } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Another publication')) throw error;
    const prior = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(archive)}?alt=media`, { headers, signal: AbortSignal.timeout(30000) });
    if (!prior.ok || createHash('sha256').update(await prior.text()).digest('hex') !== hash) throw Error('Existing archive differs from this publication.');
  }
  const published = await upload(object, generation);
  const check = await fetch(`${endpoint}?alt=media&generation=${published.generation}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!check.ok || createHash('sha256').update(await check.text()).digest('hex') !== hash) throw Error('Publication read-back could not be verified.');
  console.log(`Private investor dispatch published and verified. Generation ${published.generation}; SHA-256 ${hash}.`);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
