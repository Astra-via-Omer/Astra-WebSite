import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Check through the public load balancer: /health on either runtime alone cannot
// detect investor HTML that references chunks missing from the marketing image.
export async function checkPublicAssets({
  origins = ['https://astra-via.com', 'https://www.astra-via.com'],
  pages = ['/', '/investors'],
  fetchImpl = fetch,
} = {}) {
  const checked = new Set();
  for (const origin of origins) {
    for (const page of pages) {
      const url = new URL(page, origin);
      const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, `${url}: page returned HTTP ${response.status}`);
      assert.match(response.headers.get('content-type') || '', /^text\/html\b/i, `${url}: expected HTML`);
      const html = await response.text();
      const assets = new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
        .map(match => new URL(match[1].replaceAll('&amp;', '&'), url))
        .filter(asset => asset.pathname.startsWith('/_next/static/') && /\.(?:js|css)$/.test(asset.pathname))
        .map(asset => asset.href));
      assert.ok([...assets].some(asset => new URL(asset).pathname.endsWith('.js')), `${url}: no Next.js scripts found`);
      for (const asset of assets) {
        if (checked.has(asset)) continue;
        const result = await fetchImpl(asset, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        assert.equal(result.status, 200, `${url}: ${asset} returned HTTP ${result.status}; check that both services use the same image`);
        const mime = new URL(asset).pathname.endsWith('.css') ? /^text\/css\b/i : /^(?:application|text)\/javascript\b/i;
        assert.match(result.headers.get('content-type') || '', mime, `${asset}: unexpected asset content type`);
        assert.ok((await result.arrayBuffer()).byteLength, `${asset}: empty asset`);
        checked.add(asset);
      }
    }
  }
  return { pages: origins.length * pages.length, assets: checked.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkPublicAssets().then(result => {
    console.log(`Public asset check passed: ${result.pages} pages and ${result.assets} scripts/styles across both website hosts.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
