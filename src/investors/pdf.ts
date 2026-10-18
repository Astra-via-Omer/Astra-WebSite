import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import { RoomError } from './policy';

export async function preparePdf(bytes: Uint8Array) {
  if (bytes.length > 25 * 1024 * 1024 || !Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from('%PDF-'))) throw new RoomError(400, 'Upload a PDF of at most 25 MB.');
  let source: PDFDocument;
  try { source = await PDFDocument.load(bytes); } catch { throw new RoomError(400, 'The PDF cannot be opened. Remove encryption or repair the file before uploading.'); }
  if (source.isEncrypted || source.getPageCount() < 1 || source.getPageCount() > 200) throw new RoomError(400, 'Use an unencrypted PDF with 1–200 pages.');
  // Copy page content into a fresh catalog; omit source attachments, forms,
  // catalog scripts and actions. Remove page annotations/actions as well.
  const clean = await PDFDocument.create();
  for (const page of await clean.copyPages(source, source.getPageIndices())) {
    for (const name of ['Annots', 'AA', 'A']) page.node.delete(PDFName.of(name));
    const { width, height } = page.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 72 || height < 72 || width > 14400 || height > 14400) throw new RoomError(400, 'The PDF contains unsupported page dimensions.');
    clean.addPage(page);
  }
  return { bytes: Buffer.from(await clean.save()), pages: clean.getPageCount() };
}

export async function watermarkPdf(bytes: Uint8Array, email: string, date: string, version: string, copyId: string) {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // Standard PDF fonts are ASCII here; the verified original email remains in
  // the audit record even when its display needs escaping.
  const ascii = (value: string) => value.replace(/[^\x20-\x7e]/g, '?');
  const label = ascii(`CONFIDENTIAL | ${email} | ${date} | Version ${version} | Copy ${copyId}`);
  for (const [index, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    const size = Math.max(2, Math.min(8, (width - 24) / font.widthOfTextAtSize(label, 1)));
    page.drawRectangle({ x: 0, y: 0, width, height: 20, color: rgb(1, 1, 1), opacity: 0.96 });
    page.drawText(label, { x: 12, y: 7, size, font, color: rgb(0.12, 0.2, 0.3) });
    const diagonal = ascii(`${email} | ${copyId}`);
    const large = Math.max(4, Math.min(23, width * 0.7 / font.widthOfTextAtSize(diagonal, 1)));
    for (const fraction of [0.25, 0.52, 0.78]) page.drawText(diagonal, {
      x: width * 0.08, y: height * fraction, size: large, font, rotate: degrees(25), color: rgb(0.2, 0.35, 0.42), opacity: 0.18,
    });
    page.drawText(`${index + 1} / ${pdf.getPageCount()}`, { x: 12, y: height - 12, size: 7, font, color: rgb(0.3, 0.4, 0.5) });
  }
  pdf.setTitle('Astra-via confidential investor copy'); pdf.setSubject(label);
  return Buffer.from(await pdf.save());
}
