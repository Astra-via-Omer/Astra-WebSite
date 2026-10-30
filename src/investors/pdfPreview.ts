export async function loadPdfPreviewRenderer() {
  // The modern build requires newer APIs (including Map upsert) that are absent
  // in supported investor browsers such as Chromium/Edge 132. The renderer and
  // worker must both use the matching compatibility build and its polyfills.
  const renderer = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') {
    renderer.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
  return renderer;
}
