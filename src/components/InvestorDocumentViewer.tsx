'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfPreviewRenderer } from '@/investors/pdfPreview';

export default function InvestorDocumentViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1), [zoom, setZoom] = useState(1), [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [textView, setTextView] = useState(false), [text, setText] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    setPdf(null); setLoading(true); setError(''); setPage(1);
    async function load() {
      const [renderer, response] = await Promise.all([loadPdfPreviewRenderer(), fetch(url, { signal: controller.signal })]);
      if (!response.ok) throw Error('Document unavailable.');
      const data = new Uint8Array(await response.arrayBuffer());
      if (controller.signal.aborted) return;
      task = renderer.getDocument({ data });
      const document = await task.promise;
      if (!controller.signal.aborted) setPdf(document);
    }
    load().catch(() => { if (!controller.signal.aborted) { setError('This document could not be displayed. Please try again.'); setLoading(false); } });
    return () => { controller.abort(); void task?.destroy().catch(() => {}); };
  }, [url, attempt]);

  useEffect(() => {
    const target = viewport.current;
    if (!target) return;
    const resize = new ResizeObserver(() => setWidth(target.clientWidth));
    setWidth(target.clientWidth); resize.observe(target);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !width || !canvas.current) return;
    let cancelled = false, render: RenderTask | undefined;
    setLoading(true); setError(''); setText(null);
    async function draw() {
      const documentPage = await pdf!.getPage(page);
      if (cancelled || !canvas.current) return;
      void documentPage.getTextContent().then(content => {
        if (!cancelled) setText(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''));
      }).catch(() => { if (!cancelled) setText(''); });
      const target = canvas.current, context = target.getContext('2d');
      if (!context) throw Error('Canvas unavailable.');
      const base = documentPage.getViewport({ scale: 1 });
      const scale = Math.max(0.1, (Math.min(width, 1100) - 32) / base.width) * zoom;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const size = documentPage.getViewport({ scale: scale * density });
      target.width = Math.ceil(size.width); target.height = Math.ceil(size.height);
      target.style.width = `${size.width / density}px`; target.style.height = `${size.height / density}px`;
      render = documentPage.render({ canvas: target, canvasContext: context, viewport: size });
      await render.promise;
      if (!cancelled) setLoading(false);
    }
    draw().catch(() => { if (!cancelled) { setLoading(false); setError('This page could not be displayed. Please try again.'); } });
    return () => { cancelled = true; render?.cancel(); };
  }, [pdf, page, width, zoom]);

  function goTo(next: number) { setPage(next); viewport.current?.scrollTo({ top: 0, left: 0 }); }
  return <section className="ir-modal ir-reader" role="dialog" aria-modal="true" aria-labelledby="ir-preview-title" onKeyDown={event => {
    if (event.target instanceof HTMLSelectElement || !pdf) return;
    if (event.key === 'PageDown' && page < pdf.numPages) { event.preventDefault(); goTo(page + 1); }
    if (event.key === 'PageUp' && page > 1) { event.preventDefault(); goTo(page - 1); }
  }}>
    <div className="ir-modal-header"><div><span className="ir-code-label">DOCUMENT READER</span><h2 id="ir-preview-title">{title}</h2></div><button autoFocus type="button" onClick={onClose}>Close <span aria-hidden="true">×</span></button></div>
    <div className="ir-reader-controls" aria-label="Document controls"><div className="ir-reader-pages"><button type="button" disabled={!pdf || page <= 1} onClick={() => goTo(page - 1)} aria-label="Previous page">← Previous</button><label>Page<select aria-label="Select document page" disabled={!pdf} value={page} onChange={event => goTo(Number(event.target.value))}>{Array.from({ length: pdf?.numPages || 1 }, (_, index) => <option key={index} value={index + 1}>{index + 1} of {pdf?.numPages || '…'}</option>)}</select></label><button type="button" disabled={!pdf || page >= pdf.numPages} onClick={() => goTo(page + 1)} aria-label="Next page">Next →</button></div><button className="ir-reader-mode" type="button" aria-pressed={textView} onClick={() => setTextView(value => !value)}>{textView ? 'Page view' : 'Text view'}</button><label className="ir-reader-zoom">Zoom<select aria-label="Document zoom" disabled={textView} value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value={1}>Fit to width</option><option value={1.25}>125%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label></div>
    <div className="ir-reader-viewport" ref={viewport} tabIndex={0} aria-label="Document page. Scroll to read; use Page Up and Page Down to change pages."><div className="ir-reader-page" style={{ display: textView ? 'none' : undefined }}><canvas ref={canvas} role="img" aria-label={`Page ${page}${pdf ? ` of ${pdf.numPages}` : ''}: ${title}`} style={{ visibility: loading || error ? 'hidden' : 'visible' }} /></div>{textView && <article className="ir-reader-text" aria-label={`Text of page ${page}`}><h3>Page {page}</h3><p>{text === null ? 'Loading page text…' : text.trim() || 'This page has no selectable text. Switch to Page view to read the original document.'}</p></article>}{loading && !textView && <p className="ir-reader-status" role="status">Loading page…</p>}{error && <div className="ir-reader-status" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}</div>
    <p className="ir-reader-footer" aria-live="polite">{pdf ? `Page ${page} of ${pdf.numPages} · ` : ''}Your personalized document copy</p>
  </section>;
}
