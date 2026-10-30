// Shared types and validation only. The private content is imported by dispatchFeed.ts on the server.
export const progressProducts = ['Workspace', 'Colossus', 'Enigma', 'Research', 'Investor Room', 'Company'] as const;
export const progressStates = ['Released', 'Merged', 'Research', 'Experiment'] as const;
export type ProgressEntry = {
  id: string; date: string; publishedAt: string; product: string; status: string;
  title: string; summary: string; detail: string; sourceLabel: string;
};
export type ProgressMetric = {
  id: string; label: string; value: number | null; unit: string;
  definition: string; periodStart: string; periodEnd: string; measuredAt: string;
  status: 'measured' | 'unavailable'; history: { date: string; value: number }[];
};
export type InvestorProgress = { publishedAt: string; entries: ProgressEntry[]; metrics: ProgressMetric[] };
type Evidence = { key: string; kind: string; url: string; checkedAt: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected a dispatch object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u0008]/.test(value)) throw Error('Invalid dispatch text.');
  return value;
}
function timestamp(value: unknown, now: number) {
  const result = text(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(result) || !Number.isFinite(Date.parse(result)) || Date.parse(result) > now) throw Error('Invalid or future dispatch timestamp.');
  return result;
}
function day(value: unknown, now: number) {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result || Date.parse(result) > now) throw Error('Invalid milestone date.');
  return result;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw Error('Invalid dispatch list.');
  return value;
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw Error('Duplicate dispatch identity or evidence.');
}
function evidence(value: unknown, now: number): Evidence[] {
  const result = list(value, 8).map(item => {
    const e = record(item), url = new URL(text(e.url, 500));
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['github.com', 'astraviacom-my.sharepoint.com', 'console.cloud.google.com'].includes(url.hostname)) throw Error('Unapproved evidence URL.');
    const kind = text(e.kind, 20);
    if (!['merge', 'deployment', 'research', 'measurement'].includes(kind)) throw Error('Invalid evidence kind.');
    return { key: text(e.key, 140), kind, url: url.href, checkedAt: timestamp(e.checkedAt, now) };
  });
  if (!result.length) throw Error('Evidence is required.');
  return result;
}

// An explicit projection prevents internal evidence URLs, queries, and notes from reaching investors.
// canRead must come from the existing live membership + confidentiality checks, never the client.
export function investorProgress(value: unknown, canRead: boolean, now = Date.now()): InvestorProgress | null {
  if (!canRead) return null;
  const input = record(value), publishedAt = timestamp(input.publishedAt, now), evidenceKeys: string[] = [];
  const entries: ProgressEntry[] = list(input.entries, 500).map(item => {
    const e = record(item), proof = evidence(e.evidence, now);
    const product = text(e.product, 30), status = text(e.status, 20);
    if (!(progressProducts as readonly string[]).includes(product) || !(progressStates as readonly string[]).includes(status)) throw Error('Unknown product or progress status.');
    if (status === 'Released' && (!proof.some(p => p.kind === 'deployment') || !proof.some(p => p.kind === 'merge'))) throw Error('Released work requires merge and deployment evidence.');
    if (status === 'Merged' && !proof.some(p => p.kind === 'merge')) throw Error('Merged work requires merge evidence.');
    if (status === 'Research' && !proof.some(p => p.kind === 'research')) throw Error('Research requires a research source.');
    evidenceKeys.push(...proof.map(p => p.key));
    const date = day(e.date, now), entryPublishedAt = timestamp(e.publishedAt, now);
    if (Date.parse(date) > Date.parse(entryPublishedAt) || Date.parse(entryPublishedAt) > Date.parse(publishedAt)) throw Error('Milestone publication predates the event or feed.');
    return { id: text(e.id, 100), date, publishedAt: entryPublishedAt, product, status, title: text(e.title, 130), summary: text(e.summary, 600), detail: text(e.detail, 1200), sourceLabel: text(e.sourceLabel, 150) };
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  unique(entries.map(e => e.id)); unique(evidenceKeys);
  const metrics: ProgressMetric[] = list(input.metrics, 12).map(item => {
    const m = record(item), status = m.status;
    if (status !== 'measured' && status !== 'unavailable') throw Error('Invalid metric status.');
    if (status === 'measured' && !evidence(m.evidence, now).some(e => e.kind === 'measurement')) throw Error('Metrics require measurement evidence.');
    const value = m.value;
    if ((status === 'unavailable' && value !== null) || (status === 'measured' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))) throw Error('A measurement must be real and nonnegative; unavailable is null.');
    const periodStart = timestamp(m.periodStart, now), periodEnd = timestamp(m.periodEnd, now), measuredAt = timestamp(m.measuredAt, now);
    if (periodStart >= periodEnd || periodEnd > measuredAt) throw Error('Invalid metric period.');
    const history = list(m.history, 7).map(item => { const h = record(item); if (typeof h.value !== 'number' || !Number.isFinite(h.value) || h.value < 0) throw Error('Invalid metric history.'); return { date: day(h.date, now), value: h.value }; });
    unique(history.map(h => h.date));
    history.sort((a, b) => a.date.localeCompare(b.date));
    if (history.some(h => h.date > periodEnd.slice(0, 10))) throw Error('Metric history exceeds the observation window.');
    return { id: text(m.id, 100), label: text(m.label, 70), value: value as number | null, unit: text(m.unit, 30), definition: text(m.definition, 600), periodStart, periodEnd, measuredAt, status, history };
  });
  unique(metrics.map(m => m.id));
  return { publishedAt, entries, metrics };
}
