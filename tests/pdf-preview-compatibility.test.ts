import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { loadPdfPreviewRenderer } from '../src/investors/pdfPreview';
import { watermarkPdf } from '../src/investors/pdf';

test('the preview renders a personalized PDF when newer browser APIs are unavailable', async () => {
  const features: [object, string][] = [[Map.prototype, 'getOrInsertComputed'], [Promise, 'try']];
  const originals = features.map(([target, name]) => Object.getOwnPropertyDescriptor(target, name));
  features.forEach(([target, name]) => Object.defineProperty(target, name, { value: undefined, writable: true, configurable: true }));
  try {
    const renderer = await loadPdfPreviewRenderer();
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    source.addPage([400, 500]).drawText('Synthetic investor preview', { x: 30, y: 420, size: 18, font });
    const bytes = await watermarkPdf(await source.save(), 'preview@example.invalid', '2026-10-30T00:00:00Z', '1', 'compatibility-check');
    const task = renderer.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    try {
      const pdf = await task.promise, page = await pdf.getPage(1);
      const text = await page.getTextContent();
      assert(text.items.some(item => 'str' in item && item.str.includes('Synthetic investor preview')));
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(viewport.width, viewport.height), context = canvas.getContext('2d');
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      assert(pixels.some((value, index) => index % 4 !== 3 && value < 200), 'The PDF page must contain visible content');
    } finally { await task.destroy(); }
  } finally {
    features.forEach(([target, name], index) => {
      if (originals[index]) Object.defineProperty(target, name, originals[index]!);
      else Reflect.deleteProperty(target, name);
    });
  }
});
