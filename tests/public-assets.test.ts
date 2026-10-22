import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicAssets } from '../scripts/check-public-assets.mjs';

const origin = 'https://example.invalid';
const layout = '/_next/static/chunks/app/layout-current.js';
const investor = '/_next/static/chunks/app/investors/page-current.js';
const css = '/_next/static/css/current.css';
const html = (scripts: string[]) => `<link rel="stylesheet" href="${css}">${scripts.map(src => `<script src="${src}"></script>`).join('')}`;
function fixture(overrides: Record<string, () => Response> = {}) {
  return async (input: RequestInfo | URL) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    if (overrides[path]) return overrides[path]();
    if (path === '/' || path === '/investors') return new Response(html(path === '/' ? [layout] : [layout, investor]), { headers: { 'content-type': 'text/html' } });
    return new Response('asset', { headers: { 'content-type': path.endsWith('.css') ? 'text/css' : 'application/javascript' } });
  };
}

test('checks investor-specific assets through the public origin and deduplicates shared assets', async () => {
  const calls: string[] = [];
  const serve = fixture();
  const result = await checkPublicAssets({ origins: [origin], fetchImpl: async (input: RequestInfo | URL) => { calls.push(String(input)); return serve(input); } });
  assert.deepEqual(result, { pages: 2, assets: 3 });
  assert.equal(calls.filter(url => url.endsWith(layout)).length, 1);
  assert.ok(calls.includes(origin + investor));
});

test('fails for missing investor chunks even when both pages return 200', async () => {
  await assert.rejects(checkPublicAssets({ origins: [origin], fetchImpl: fixture({ [investor]: () => new Response('Not Found', { status: 404 }) }) }), /page-current\.js returned HTTP 404/);
});

test('fails for incorrect script MIME types and missing styles', async () => {
  await assert.rejects(checkPublicAssets({ origins: [origin], fetchImpl: fixture({ [layout]: () => new Response('Not Found', { headers: { 'content-type': 'text/plain' } }) }) }), /unexpected asset content type/);
  await assert.rejects(checkPublicAssets({ origins: [origin], fetchImpl: fixture({ [css]: () => new Response('Not Found', { status: 404 }) }) }), /current\.css returned HTTP 404/);
});

test('fails for empty or non-HTML page responses', async () => {
  await assert.rejects(checkPublicAssets({ origins: [origin], fetchImpl: fixture({ '/': () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }) }) }), /no Next\.js scripts found/);
  await assert.rejects(checkPublicAssets({ origins: [origin], fetchImpl: fixture({ '/': () => new Response('{}', { headers: { 'content-type': 'application/json' } }) }) }), /expected HTML/);
});
