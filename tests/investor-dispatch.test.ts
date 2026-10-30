import { test } from 'node:test';
import assert from 'node:assert/strict';
import { investorProgress } from '../src/investors/dispatch';
import { aggregateDays } from '../scripts/collect-investor-metrics.mjs';

const now = Date.parse('2026-10-30T20:00:00Z');
function fixture() {
  return { publishedAt: '2026-10-30T10:00:00Z', entries: [{ id: 'synthetic-milestone', date: '2026-10-29', publishedAt: '2026-10-30T10:00:00Z', product: 'Workspace', status: 'Merged', title: 'Synthetic milestone', summary: 'Synthetic investor summary.', detail: 'A synthetic limitation.', sourceLabel: 'Synthetic source checked.', privateNotes: 'PRIVATE_NOTE', evidence: [{ key: 'synthetic-merge', kind: 'merge', url: 'https://github.com/example/synthetic/pull/1', checkedAt: '2026-10-30T09:00:00Z' }] }], metrics: [{ id: 'synthetic-measurement', label: 'Synthetic requests', value: 0 as number | null, unit: 'requests', definition: 'A synthetic measurement with an explicit observed zero.', periodStart: '2026-10-29T00:00:00Z', periodEnd: '2026-10-30T00:00:00Z', measuredAt: '2026-10-30T09:00:00Z', status: 'measured', history: [{ date: '2026-10-29', value: 0 }], evidence: [{ key: 'measurement', kind: 'measurement', url: 'https://console.cloud.google.com/monitoring', checkedAt: '2026-10-30T09:00:00Z' }], collection: { internalQuery: 'PRIVATE_QUERY' } }] };
}
test('private progress is absent without the current room agreement and projects only allowed fields', () => {
  assert.equal(investorProgress({ invalid: true }, false, now), null);
  const output = investorProgress(fixture(), true, now)!;
  const serialized = JSON.stringify(output);
  for (const privateValue of ['PRIVATE_NOTE', 'PRIVATE_QUERY', 'github.com', 'console.cloud.google.com', 'checkedAt', 'evidence']) assert(!serialized.includes(privateValue));
  assert.equal(output.entries.length, 1);
  assert.equal(output.metrics[0].value, 0);
});
test('duplicate evidence, invented release labels, future milestones, and missing source records are rejected', () => {
  let content = fixture(); content.entries.push({ ...content.entries[0], id: 'duplicate-source' });
  assert.throws(() => investorProgress(content, true, now), /Duplicate/);
  content = fixture(); content.entries[0].status = 'Released';
  assert.throws(() => investorProgress(content, true, now), /deployment/);
  content = fixture(); content.entries[0].date = '2026-11-01';
  assert.throws(() => investorProgress(content, true, now), /date/);
  content = fixture(); content.entries[0].evidence = [];
  assert.throws(() => investorProgress(content, true, now), /Evidence/);
});
test('missing measurements stay null and metrics keep valid periods and source evidence', () => {
  let content = fixture(); content.metrics[0].status = 'unavailable';
  assert.throws(() => investorProgress(content, true, now), /unavailable is null/);
  content.metrics[0].value = null; content.metrics[0].history = [];
  assert.equal(investorProgress(content, true, now)!.metrics[0].value, null);
  content = fixture(); content.metrics[0].periodStart = content.metrics[0].periodEnd;
  assert.throws(() => investorProgress(content, true, now), /period/);
  content = fixture(); content.metrics[0].value = NaN;
  assert.throws(() => investorProgress(content, true, now));
  content = fixture(); content.metrics[0].evidence[0].url = 'https://unapproved.invalid/private';
  assert.throws(() => investorProgress(content, true, now), /Unapproved/);
});
test('compute aggregation sums observed services and leaves an absent day absent', () => {
  const point = (value: number) => ({ interval: { startTime: '2026-10-29T00:00:00Z', endTime: '2026-10-30T00:00:00Z' }, value: { doubleValue: value } });
  const series = [ { resource: { labels: { service_name: 'astra-web' } }, points: [point(120)] }, { resource: { labels: { service_name: 'astra-colossus' } }, points: [point(60)] } ];
  const output = aggregateDays(series, Date.parse('2026-10-28'), Date.parse('2026-10-30'));
  assert.equal(output.length, 1); assert.equal(output[0].value, 180);
  assert.deepEqual(output[0].observedServices, ['astra-colossus', 'astra-web']);
  series[0].resource.labels.service_name = 'unapproved-service';
  assert.throws(() => aggregateDays(series, Date.parse('2026-10-28'), Date.parse('2026-10-30')), /Unexpected service/);
});
