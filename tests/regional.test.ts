import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRegion, parseRegion } from '../src/regional/policy';
import { CONSENT_VERSION, CONSENT_SECONDS, parseConsent, consentSignals, mayLoadTags, tagManagerId, type Consent } from '../src/regional/consent';
import { startTagManager } from '../src/regional/tags';

test('country estimates choose regional information, with Hebrew only on trusted Israeli connections', () => {
  for (const [country, expected] of [['IL','israel'],['DE','eea'],['FR','eea'],['NO','eea'],['IS','eea'],['LI','eea'],['GB','uk'],['US','us'],['AE','international'],['SA','international'],['CH','international'],['CA','international']] as const) {
    const result = resolveRegion({ countryHeader: country, trustGoogleGeo: true });
    assert.equal(result.region, expected);
    assert.equal(result.showHebrew, country === 'IL');
  }
  assert.equal(resolveRegion({countryHeader: ' il ', trustGoogleGeo: true}).showHebrew, true);
});

test('untrusted, missing or malformed location never enables Hebrew', () => {
  for (const countryHeader of ['IL', 'IL,US', 'ZZ', 'XX', '', '{client_region}', '<script>', null]) {
    const result = resolveRegion({countryHeader, trustGoogleGeo: false, preference: 'israel'});
    assert.equal(result.showHebrew, false);
    assert.equal(result.country, null);
  }
  for (const countryHeader of ['IL,US','ZZ','XX','',null]) {
    assert.equal(resolveRegion({countryHeader, trustGoogleGeo: true}).country, null);
  }
});

test('a policy choice cannot change the connection country or bypass the language rule', () => {
  assert.deepEqual(resolveRegion({countryHeader: 'AE', trustGoogleGeo: true, preference: 'israel'}), {
    country: 'AE', detected: 'international', region: 'israel', showHebrew: false,
  });
  assert.equal(resolveRegion({countryHeader:'IL', trustGoogleGeo:true, preference:'us'}).showHebrew, true);
  assert.equal(resolveRegion({countryHeader:'DE', trustGoogleGeo:true, preference:'javascript:alert(1)'}).region, 'eea');
  assert.equal(parseRegion('__proto__'), null);
});

const now = Date.now();
const granted: Consent = { version: CONSENT_VERSION, analytics: true, advertising: false, savedAt: now };
test('only valid current unexpired category preferences are restored', () => {
  const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
  assert.deepEqual(parseConsent(encode(granted), now), granted);
  for (const value of [undefined, '', '%', '{}', encode({...granted,version:'old'}),encode({...granted,analytics:'true'}),encode({...granted,savedAt:now+1}),encode({...granted,savedAt:now-CONSENT_SECONDS*1000-1})]) {
    assert.equal(parseConsent(value, now), null);
  }
  assert.equal(consentSignals(granted).analytics_storage, 'granted');
  assert.equal(consentSignals(granted).ad_user_data, 'denied');
  assert.ok(Object.values(consentSignals(granted, true)).every(value => value === 'denied'));
});

test('optional tags are denied for unknown choices, privacy signals and every private route', () => {
  assert.equal(mayLoadTags(null, false, '/'), false);
  assert.equal(mayLoadTags(granted, true, '/'), false);
  for (const path of ['/investors','/investors/reset','/register','/auth/callback','/api/investors','/region','/privacy','/legal','/accessibility','/unknown']) {
    assert.equal(mayLoadTags(granted, false, path), false, path);
  }
  assert.equal(mayLoadTags(granted, false, '/'), true);
  assert.equal(tagManagerId('GTM-ABCDE1'), 'GTM-ABCDE1');
  assert.equal(tagManagerId('GTM-ABC&evil=1'), null);
});

test('GTM makes zero DOM/network requests while denied and queues consent before loading', () => {
  const globals = globalThis as unknown as { window: Window; document: Document };
  const originalWindow = globals.window;
  const originalDocument = globals.document;
  const scripts: Array<{id?: string;src?: string;async?: boolean}> = [];
  globals.window = {} as Window;
  globals.document = {
    getElementById: () => scripts[0] ?? null,
    createElement: () => ({}),
    head: { appendChild: (item: typeof scripts[number]) => { scripts.push(item); } },
  } as unknown as Document;
  try {
    const input = { id: 'GTM-ABCDE1', consent: granted, privacySignal: false, pathname: '/' };
    assert.equal(startTagManager({...input,consent:null}),false);
    assert.equal(startTagManager({...input,privacySignal:true}),false);
    assert.equal(startTagManager({...input,pathname:'/investors'}),false);
    assert.equal(startTagManager({...input,id:'<script>'}),false);
    assert.equal(scripts.length,0);
    assert.equal(globals.window.dataLayer,undefined);
    assert.equal(startTagManager(input),true);
    assert.equal(scripts.length,1);
    assert.equal(scripts[0].src,'https://www.googletagmanager.com/gtm.js?id=GTM-ABCDE1');
    const commands = globals.window.dataLayer!;
    assert.deepEqual(Array.from(commands[0] as IArguments),['consent','default',consentSignals(null)]);
    assert.deepEqual(Array.from(commands[2] as IArguments),['consent','update',consentSignals(granted)]);
    assert.equal((commands[4] as {event:string}).event,'gtm.js');
    startTagManager(input);
    assert.equal(scripts.length,1);
  } finally { globals.window = originalWindow; globals.document = originalDocument; }
});
