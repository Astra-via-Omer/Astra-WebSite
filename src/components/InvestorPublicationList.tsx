'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import type { InvestorDocument } from './InvestorExperience';
import { loadPdfPreviewRenderer } from '@/investors/pdfPreview';

type Props = {
  documents: InvestorDocument[];
  busy: boolean;
  loadPreview: (document: InvestorDocument, signal: AbortSignal) => Promise<Blob>;
  onOpen: (document: InvestorDocument) => void;
  onPublish: (document: InvestorDocument) => void;
};
type ActivePreview = { document: InvestorDocument; left: number; top: number; width: number; height: number };

export default function InvestorPublicationList({ documents, busy, loadPreview, onOpen, onPublish }: Props) {
  const id = useId();
  const [active, setActive] = useState<ActivePreview | null>(null);
  const [renderedId, setRenderedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimers = useCallback(() => { clearTimeout(opening.current); clearTimeout(closing.current); }, []);
  const close = useCallback(() => { clearTimers(); setActive(null); }, [clearTimers]);

  function show(document: InvestorDocument, target: HTMLElement, delay: number) {
    clearTimers();
    if (busy) return;
    opening.current = setTimeout(() => {
      const bounds = target.getBoundingClientRect();
      const width = Math.min(420, window.innerWidth - 32);
      const height = Math.min(500, window.innerHeight - 32);
      // Keep the card in view even for the last publication row on the page.
      const left = Math.min(Math.max(16, bounds.left), window.innerWidth - width - 16);
      const top = bounds.bottom + height + 8 <= window.innerHeight - 16
        ? bounds.bottom + 8
        : Math.max(16, bounds.top - height - 8);
      setActive(current => current?.document.id === document.id ? current : { document, left, top, width, height });
    }, delay);
  }
  function hide() {
    clearTimers();
    closing.current = setTimeout(close, 180);
  }
  function open(document: InvestorDocument) { close(); onOpen(document); }

  const activeDocument = active?.document;
  useEffect(() => {
    if (!activeDocument) return;
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined, render: RenderTask | undefined;
    setRenderedId(null); setError('');
    async function draw() {
      const [pdfjs, blob] = await Promise.all([loadPdfPreviewRenderer(), loadPreview(activeDocument!, controller.signal)]);
      if (controller.signal.aborted) return;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (controller.signal.aborted) return;
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const target = canvas.current;
      if (controller.signal.aborted || !target?.parentElement) return;
      const context = target.getContext('2d');
      if (!context) throw Error('The document preview could not be displayed.');
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min((target.parentElement.clientWidth - 32) / original.width, (target.parentElement.clientHeight - 32) / original.height);
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * density });
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      target.style.width = `${viewport.width / density}px`; target.style.height = `${viewport.height / density}px`;
      render = page.render({ canvas: target, canvasContext: context, viewport });
      await render.promise;
      if (!controller.signal.aborted) setRenderedId(activeDocument!.id);
    }
    draw().catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The preview could not be loaded.');
    });
    return () => { controller.abort(); render?.cancel(); void task?.destroy().catch(() => {}); };
  }, [activeDocument, loadPreview]);

  useEffect(() => {
    if (busy) close();
  }, [busy, close]);
  useEffect(() => () => clearTimers(), [clearTimers]);
  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const scroll = (event: Event) => {
      // Scrolling inside the PDF/card should not dismiss it.
      if (event.target instanceof Element && event.target.closest('.ir-publication-preview')) return;
      close();
    };
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [active, close]);

  return <div className="ir-publications">
    <p className="ir-small ir-preview-help">Hover over a document to preview it, or select its title to open it.</p>
    {documents.map(document => {
      const expanded = active?.document.id === document.id;
      return <div key={document.id} className="ir-list-row ir-publication-row">
        <div className="ir-publication-target"
          onPointerEnter={event => { if (event.pointerType === 'mouse') show(document, event.currentTarget, 300); }}
          onPointerLeave={hide}
          onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget)) show(document, event.currentTarget, 0); }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}>
          <button type="button" className="ir-publication-title" disabled={busy}
            aria-label={`Preview ${document.title}, version ${document.version}`}
            aria-expanded={expanded} aria-controls={expanded ? id : undefined}
            onClick={() => open(document)}>
            <span>{document.title} <span className="ir-publication-version">· {document.version}</span></span>
            <span className="ir-preview-label"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg> Preview</span>
          </button>
          {expanded && <section id={id} className="ir-publication-preview" role="region" aria-label={`${document.title} preview`}
            style={{ left: active.left, top: active.top, width: active.width, height: active.height }}
            onPointerEnter={clearTimers} onPointerLeave={hide}>
            <div className="ir-publication-preview-header"><div><span className="ir-code-label">{document.published ? 'Published' : 'Draft'} · {document.pages} {document.pages === 1 ? 'page' : 'pages'}</span><h3>{document.title}</h3></div><button type="button" aria-label="Close document preview" onClick={close}>×</button></div>
            <div className="ir-publication-page" aria-busy={renderedId !== document.id && !error}>
              <canvas ref={canvas} role="img" aria-label={`First page of ${document.title}`} style={{ visibility: renderedId === document.id ? 'visible' : 'hidden' }} />
              {renderedId !== document.id && <div className="ir-publication-preview-status" role="status">{error ? 'The preview could not be loaded. Select Open full preview to try again.' : 'Loading document preview…'}</div>}
            </div>
            <button type="button" className="ir-publication-open" onClick={() => open(document)}>Open full preview <span aria-hidden="true">↗</span></button>
          </section>}
        </div>
        <button type="button" disabled={busy} onClick={() => { close(); onPublish(document); }}>{document.published ? 'Withdraw document' : 'Publish document'}</button>
      </div>;
    })}
  </div>;
}
