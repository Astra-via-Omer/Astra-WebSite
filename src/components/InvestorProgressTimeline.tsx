'use client';

import { useState } from 'react';
import type { InvestorProgress, ProgressMetric } from '@/investors/dispatch';

const date = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);

function Metric({ metric }: { metric: ProgressMetric }) {
  const max = Math.max(...metric.history.map(p => p.value), 1);
  return <article className="ir-progress-metric">
    <h3>{metric.label}</h3>
    <p className="ir-progress-value">{metric.value === null ? <span className="ir-metric-pending">Not measured yet</span> : <>{number(metric.value)} <span>{metric.unit}</span></>}</p>
    <p className="ir-progress-period">{metric.status === 'measured' ? `${date(metric.periodStart)} · UTC day` : 'Measurement pending'}</p>
    {metric.history.length > 1 && <div className="ir-metric-bars" role="img" aria-label={`${metric.label}, ${metric.history.length} daily observations. Exact values in measurement details.`}>{metric.history.map(p => <span key={p.date} style={{ height: `${Math.max(3, p.value / max * 100)}%` }} title={`${date(p.date)}: ${number(p.value)} ${metric.unit}`} />)}</div>}
    <details><summary>Measurement details</summary><p>{metric.definition}</p>{metric.status === 'measured' && <p>Period: {date(metric.periodStart)} 00:00–{date(metric.periodEnd)} 00:00 UTC. Collected {date(metric.measuredAt)}.</p>}{metric.history.length > 0 && <table><caption>Daily observations ({metric.unit})</caption><tbody>{metric.history.map(p => <tr key={p.date}><th scope="row">{date(p.date)}</th><td>{number(p.value)}</td></tr>)}</tbody></table>}</details>
  </article>;
}

export default function InvestorProgressTimeline({ progress, compact = false }: { progress: InvestorProgress; compact?: boolean }) {
  const [product, setProduct] = useState('All products'), [limit, setLimit] = useState(6);
  const products = [...new Set(progress.entries.map(e => e.product))].sort();
  const entries = progress.entries.filter(e => product === 'All products' || e.product === product);
  const visible = entries.slice(0, compact ? 3 : limit);
  return <div className={`ir-progress${compact ? ' ir-progress-compact' : ''}`}>
    {!compact && <>
      <div className="ir-progress-intro"><p>A dated record of what we build, test, and learn.</p><span>Updated {date(progress.publishedAt)}</span></div>
      <div className="ir-progress-summary" aria-label="Timeline coverage"><div><strong>{progress.entries.length}</strong><span>documented milestones</span></div><div><strong>{products.length}</strong><span>product & research areas</span></div><div><strong>{progress.entries.filter(e => e.status === 'Research' || e.status === 'Experiment').length}</strong><span>research & experiment milestones</span></div></div>
      {progress.metrics.length > 0 && <section className="ir-progress-activity" aria-labelledby="ir-activity-title"><div className="ir-progress-section-label"><h3 id="ir-activity-title">Activity in numbers</h3><span>Dated measurements</span></div><div className="ir-progress-metrics">{progress.metrics.map(metric => <Metric key={metric.id} metric={metric} />)}</div><p className="ir-progress-measurement-note">Infrastructure totals include internal calls, staff activity and automated checks. They are not unique-user or customer-traction counts.</p></section>}
      <div className="ir-progress-toolbar"><div><h3>Progress timeline</h3><p>Released work, merged improvements, and research each have their own label.</p></div><label>Filter by area<select aria-label="Filter by area" value={product} onChange={e => { setProduct(e.target.value); setLimit(6); }}><option>All products</option>{products.map(p => <option key={p}>{p}</option>)}</select></label></div>
      <p className="ir-progress-count" aria-live="polite">{entries.length} {entries.length === 1 ? 'milestone' : 'milestones'}{product !== 'All products' ? ` · ${product}` : ''} · newest first</p>
    </>}
    <ol className="ir-progress-timeline">{visible.map(entry => <li key={entry.id}>
      <div className="ir-progress-date"><time dateTime={entry.date}>{date(entry.date)}</time>{entry.publishedAt.slice(0, 10) !== entry.date && <span>Earlier milestone</span>}</div>
      <article className="ir-progress-entry"><div className="ir-progress-entry-meta"><span>{entry.product}</span><span className={`ir-progress-status ir-progress-status-${entry.status.toLowerCase()}`}>{entry.status}</span></div><h3>{entry.title}</h3><p>{entry.summary}</p><details><summary>Why it matters & what’s verified</summary><p>{entry.detail}</p><p className="ir-progress-source">{entry.sourceLabel}</p></details></article>
    </li>)}</ol>
    {!compact && visible.length < entries.length && <button className="ir-progress-more" onClick={() => setLimit(n => n + 6)}>Show earlier milestones ({entries.length - visible.length}) <span aria-hidden="true">↓</span></button>}
  </div>;
}
