import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export interface ControlledCopyStampInput {
  documentNumber: string;
  documentTitle: string;
  revisionLabel: string;
  copyIdentifier: string;
  markingLabel: string; // "CONTROLLED COPY" | "UNCONTROLLED REFERENCE COPY" | etc.
  issuedToLabel: string;
  printedDateLabel: string;
  verifyUrl: string;
  sourcePdfBytes?: Uint8Array | null; // if the customer uploaded the real document
}

const FOOTER_HEIGHT = 92;

/**
 * Builds the controlled-print PDF. If the customer has a real source PDF, every
 * page gets the NeuraTrace controlled-copy footer + QR stamped on it. If this is
 * a paper-only registration with no digital source, we generate a single-page
 * "Controlled Print Cover Sheet" that is explicit about pointing to the physical
 * signed master rather than pretending to be the regulated document itself.
 */
export async function buildControlledCopyPdf(input: ControlledCopyStampInput): Promise<Uint8Array> {
  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: 220 });
  const qrPngBytes = dataUrlToBytes(qrDataUrl);

  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await outDoc.embedPng(qrPngBytes);

  let pages: { width: number; height: number }[] = [];

  if (input.sourcePdfBytes && input.sourcePdfBytes.length > 0) {
    const srcDoc = await PDFDocument.load(input.sourcePdfBytes);
    const copiedPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => outDoc.addPage(p));
    pages = outDoc.getPages().map((p) => ({ width: p.getWidth(), height: p.getHeight() }));
  } else {
    const page = outDoc.addPage([595.28, 841.89]); // A4
    pages = [{ width: page.getWidth(), height: page.getHeight() }];
    const p = outDoc.getPages()[0];
    p.drawText('NEURATRACE', { x: 50, y: 760, size: 22, font: fontBold, color: rgb(0.12, 0.89, 0.76) });
    p.drawText('Controlled Print Cover Sheet', { x: 50, y: 735, size: 13, font, color: rgb(0.9, 0.95, 0.95) });
    p.drawText(
      'This is a controlled-print cover sheet. The authoritative, signed master of this',
      { x: 50, y: 700, size: 10, font, color: rgb(0.55, 0.64, 0.63) }
    );
    p.drawText(
      'document remains the physical paper master held under document control.',
      { x: 50, y: 686, size: 10, font, color: rgb(0.55, 0.64, 0.63) }
    );
    p.drawText(`Document: ${input.documentNumber} — ${input.documentTitle}`, { x: 50, y: 650, size: 12, font: fontBold, color: rgb(1, 1, 1) });
    p.drawText(`Revision: ${input.revisionLabel}`, { x: 50, y: 630, size: 12, font, color: rgb(1, 1, 1) });
    p.drawText(`Copy ID: ${input.copyIdentifier}`, { x: 50, y: 610, size: 12, font, color: rgb(1, 1, 1) });
  }

  const allPages = outDoc.getPages();
  const totalPages = allPages.length;
  const isUncontrolled = input.markingLabel.toUpperCase().includes('UNCONTROLLED');
  const isSuperseded = input.markingLabel.toUpperCase().includes('SUPERSEDED');

  allPages.forEach((page, idx) => {
    const { width, height } = page.getSize();

    // Header overlay: uncontrolled/superseded copies are visually unmistakable,
    // not just footer text — matching (and exceeding, with SUPERSEDED too) the
    // red "COPY" header stamp pattern used by comparable eQMS products.
    if (isUncontrolled || isSuperseded) {
      const label = isSuperseded ? 'SUPERSEDED — DO NOT USE' : 'UNCONTROLLED REFERENCE COPY';
      page.drawRectangle({ x: 0, y: height - 26, width, height: 26, color: rgb(0.95, 0.35, 0.31), opacity: 0.92 });
      page.drawText(label, { x: 16, y: height - 18, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    }

    // Footer band
    page.drawRectangle({ x: 0, y: 0, width, height: FOOTER_HEIGHT, color: rgb(0.016, 0.031, 0.039) });
    page.drawRectangle({ x: 0, y: FOOTER_HEIGHT - 1, width, height: 1, color: rgb(0.12, 0.89, 0.76) });

    const textX = 18;
    let textY = FOOTER_HEIGHT - 16;
    const lineGap = 12;

    page.drawText('NEURATRACE CONTROLLED COPY', {
      x: textX,
      y: textY,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.89, 0.76),
    });
    textY -= lineGap;
    page.drawText(`Document: ${input.documentNumber}   Revision: ${input.revisionLabel}`, {
      x: textX,
      y: textY,
      size: 8,
      font,
      color: rgb(0.9, 0.95, 0.95),
    });
    textY -= lineGap;
    page.drawText(`Copy ID: ${input.copyIdentifier}`, { x: textX, y: textY, size: 8, font, color: rgb(0.9, 0.95, 0.95) });
    textY -= lineGap;
    page.drawText(`Printed: ${input.printedDateLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.56, 0.64, 0.63) });
    textY -= lineGap;
    page.drawText(`Issued To: ${input.issuedToLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.56, 0.64, 0.63) });
    textY -= lineGap;
    page.drawText(`Page ${idx + 1} of ${totalPages}  |  Marking: ${input.markingLabel}`, {
      x: textX,
      y: textY,
      size: 8,
      font,
      color: rgb(0.56, 0.64, 0.63),
    });

    const qrSize = 68;
    page.drawImage(qrImage, {
      x: width - qrSize - 18,
      y: (FOOTER_HEIGHT - qrSize) / 2,
      width: qrSize,
      height: qrSize,
    });
  });

  return outDoc.save();
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}
