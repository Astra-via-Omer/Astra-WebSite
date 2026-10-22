import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'http://localhost:3217');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname), 'Country fixtures are restricted to a local server');
let checks = 0;
for (const path of ['/privacy','/legal','/accessibility']) {
  for (const country of ['IL','DE','GB','US','AE','SA','ZZ','']) {
    const response = await fetch(new URL(path,origin), { headers: country ? {'X-Astra-Client-Country':country} : {} });
    assert.equal(response.status,200,`${path} ${country}`);
    assert.match(response.headers.get('cache-control') || '',/private/);
    assert.match(response.headers.get('cache-control') || '',/no-store/);
    const body = await response.text();
    assert.equal(/[\u0590-\u05ff]/u.test(body),country === 'IL',`${path} ${country}: raw HTML and RSC language isolation`);
    assert.match(body,/support@astra-via.com/);
    assert.match(body,/Israeli|Israel/,'Required disclosures remain in English');
    checks++;
  }
}
for (const [country,region,label] of [['AE','israel','Israel'],['IL','us','United States'],['FR','uk','United Kingdom'],['US','invalid','United States']]) {
  const response = await fetch(new URL('/privacy',origin), {headers:{'X-Astra-Client-Country':country,'Cookie':`astra-region=${region}`}});
  const body = await response.text();
  assert.match(body,new RegExp(`Regional information: (?:<!-- -->)?${label}`));
  assert.equal(/[\u0590-\u05ff]/u.test(body),country === 'IL');
  checks++;
}
const settings = await fetch(new URL('/region',origin),{headers:{'X-Astra-Client-Country':'DE'}});
assert.equal(settings.status,200);
const body = await settings.text();
assert.match(body,/European Economic Area/);
assert.match(body,/Region &amp; privacy/);
assert.equal(/[\u0590-\u05ff]/u.test(body),false);
checks++;
console.log(`${checks} local HTTP checks passed: regional content, raw payload isolation, policy overrides, disclosures, settings and private/no-store caching.`);
