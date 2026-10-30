// Read-only aggregate collection using the existing Astra identity. No credentials or user records are emitted.
import { execFileSync } from 'node:child_process';

export const services = ['astra-web', 'astra-colossus', 'astra-enigma', 'astra-lab', 'evidence-validation', 'astra-investors', 'astra-website'];
export function aggregateDays(series, start, end) {
  const days = new Map();
  for (const s of series) {
    if (!services.includes(s.resource?.labels?.service_name)) throw Error('Unexpected service in metric response.');
    for (const p of s.points || []) {
      const from = Date.parse(p.interval.startTime), to = Date.parse(p.interval.endTime);
      if (from < start || to > end) continue;
      if (to - from !== 86400000) throw Error('Expected complete UTC metric days.');
      const value = Number(p.value.int64Value ?? p.value.doubleValue);
      if (!Number.isFinite(value) || value < 0) throw Error('Invalid measured value.');
      const date = new Date(from).toISOString().slice(0, 10);
      const d = days.get(date) || { value: 0, observedServices: new Set() };
      d.value += value; d.observedServices.add(s.resource.labels.service_name); days.set(date, d);
    }
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, value: d.value, observedServices: [...d.observedServices].sort() }));
}

async function collect() {
  const token = execFileSync('gcloud', ['auth', 'print-access-token', '--account=omer@astra-via.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 7 * 86400000), periodStart = new Date(end.getTime() - 86400000).toISOString();
  const measuredAt = new Date().toISOString();
  const definitions = [
    { id: 'cloud-requests', label: 'Application requests', unit: 'requests', type: 'run.googleapis.com/request_count', scale: 1, definition: 'Requests reaching the seven listed Astra application services on Cloud Run. Includes internal service calls, staff, automated checks and test traffic; it is not a count of users or reviews. Requests rejected before reaching a container are excluded.' },
    { id: 'cloud-cpu-hours', label: 'Compute allocated', unit: 'vCPU-hours', type: 'run.googleapis.com/container/cpu/allocation_time', scale: 1 / 3600, definition: 'Container CPU allocation seconds divided by 3,600, across seven listed Astra application services on Cloud Run. This measures allocated CPU time, not CPU utilization, GPU time, model tokens, inference cost, or completed customer work.' },
  ];
  const output = [];
  for (const definition of definitions) {
    const filter = `metric.type="${definition.type}" AND resource.type="cloud_run_revision" AND resource.labels.project_id="astra-via" AND resource.labels.location="me-west1" AND resource.labels.service_name=monitoring.regex.full_match("${services.join('|')}")`;
    const query = new URLSearchParams({ filter, 'interval.startTime': start.toISOString(), 'interval.endTime': end.toISOString(), 'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM', 'aggregation.groupByFields': 'resource.labels.service_name', pageSize: '1000' });
    const series = []; let pageToken = '';
    do {
      if (pageToken) query.set('pageToken', pageToken);
      const response = await fetch(`https://monitoring.googleapis.com/v3/projects/astra-via/timeSeries?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) { const failure = await response.json().catch(() => ({})); throw Error(`Cloud Monitoring unavailable (${response.status}): ${failure.error?.message || 'no response detail'}`); }
      const result = await response.json(); series.push(...(result.timeSeries || [])); pageToken = result.nextPageToken || '';
    } while (pageToken);
    const days = aggregateDays(series, start.getTime(), end.getTime()), latest = days.find(d => d.date === periodStart.slice(0, 10));
    output.push({ id: definition.id, label: definition.label, value: latest ? Number((latest.value * definition.scale).toFixed(3)) : null, unit: definition.unit,
      definition: `${definition.definition} Scope: ${services.join(', ')}. ${latest ? `${latest.observedServices.length} of ${services.length} services reported this metric during the latest day; a service without a series is not treated as zero.` : 'No measurement was returned for the latest day.'}`,
      periodStart, periodEnd: end.toISOString(), measuredAt, status: latest ? 'measured' : 'unavailable',
      history: days.map(d => ({ date: d.date, value: Number((d.value * definition.scale).toFixed(3)) })),
      evidence: [{ key: `${definition.id}-${periodStart.slice(0, 10)}`, kind: 'measurement', url: 'https://console.cloud.google.com/monitoring', checkedAt: measuredAt }],
      // Private, stripped by the server projection. Keep this with the committed observation.
      collection: { project: 'astra-via', region: 'me-west1', metric: definition.type, services, observedServices: latest?.observedServices || [], intervalStart: start.toISOString(), intervalEnd: end.toISOString() },
    });
  }
  console.log(JSON.stringify(output, null, 2));
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  collect().catch(error => { console.error('Aggregate collection failed:', error.message); process.exitCode = 1; });
}
