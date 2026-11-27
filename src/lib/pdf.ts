import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

// Epic E — Print Review: a stamp field is one configurable label/value box
// on the overlay (e.g. "MASTER COPY", "Reviewed By", "Next Review Date"),
// positioned in PDF points from the page's bottom-left origin. This mirrors
// real controlled-copy stamping conventions (see the reference stamped-SOP
// image: MASTER COPY / REVIEWED – NO CHANGE / Next Review Date / Reviewed
// By / Date) instead of our previous hardcoded teal footer text.
export interface StampField {
  key: string;
  label: string;
  value: string;
  page?: 'first' | 'all'; // defaults to 'all'
  x: number;
  y: number;
  fontSize?: number; // defaults to 9
  bold?: boolean;
}

export interface OverlayProfileInput {
  logoBytes?: Uint8Array | null; // PNG or JPEG bytes
  logoX?: number;
  logoY?: number;
  logoWidth?: number;
  logoHeight?: number;
  stampFields: StampField[];
}

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
  // Epic E — optional configurable overlay (logo + stamp fields) assigned to
  // the document at registration time. Omitted entirely, this function's
  // behavior is unchanged from before Epic E existed — existing callers
  // (seed.ts, the pre-Epic-E issue flow) keep working with no changes.
  overlayProfile?: OverlayProfileInput | null;
  // Epic E6 — render-only preview for the Document Controller to review
  // before committing to print. Adds a visible, unmistakable "PREVIEW —
  // NOT FOR PRINT" watermark; does not otherwise change the output, so the
  // Controller is reviewing the actual layout, not a mockup of it.
  previewOnly?: boolean;
}

const FOOTER_HEIGHT = 92;

/**
 * Builds the controlled-print PDF. If the customer has a real source PDF, every
 * page gets the PrintAssure controlled-copy footer + QR stamped on it. If this is
 * a paper-only registration with no digital source, we generate a single-page
 * "Controlled Print Cover Sheet" that is explicit about pointing to the physical
 * signed master rather than pretending to be the regulated document itself.
 *
 * When `overlayProfile` is supplied, its logo and stamp fields are layered on
 * top of every page in addition to the standard footer (which stays, since
 * it's what carries the QR verification code and copy ID — those aren't
 * configurable).
 */
export async function buildControlledCopyPdf(input: ControlledCopyStampInput): Promise<Uint8Array> {
  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: 220 });
  const qrPngBytes = dataUrlToBytes(qrDataUrl);

  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await outDoc.embedPng(qrPngBytes);

  let logoImage: Awaited<ReturnType<typeof outDoc.embedPng>> | null = null;
  if (input.overlayProfile?.logoBytes && input.overlayProfile.logoBytes.length > 0) {
    logoImage = await embedLogo(outDoc, input.overlayProfile.logoBytes);
  }

  if (input.sourcePdfBytes && input.sourcePdfBytes.length > 0) {
    const srcDoc = await PDFDocument.load(input.sourcePdfBytes);
    const copiedPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => outDoc.addPage(p));
  } else {
    const page = outDoc.addPage([595.28, 841.89]); // A4
    page.drawText('NEURATRACE', { x: 50, y: 760, size: 22, font: fontBold, color: rgb(0.12, 0.89, 0.76) });
    page.drawText('Controlled Print Cover Sheet', { x: 50, y: 735, size: 13, font, color: rgb(0.9, 0.95, 0.95) });
    page.drawText(
      'This is a controlled-print cover sheet. The authoritative, signed master of this',
      { x: 50, y: 700, size: 10, font, color: rgb(0.55, 0.64, 0.63) }
    );
    page.drawText(
      'document remains the physical paper master held under document control.',
      { x: 50, y: 686, size: 10, font, color: rgb(0.55, 0.64, 0.63) }
    );
    page.drawText(`Document: ${input.documentNumber} — ${input.documentTitle}`, { x: 50, y: 650, size: 12, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(`Revision: ${input.revisionLabel}`, { x: 50, y: 630, size: 12, font, color: rgb(1, 1, 1) });
    page.drawText(`Copy ID: ${input.copyIdentifier}`, { x: 50, y: 610, size: 12, font, color: rgb(1, 1, 1) });
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

    // Footer band — always present; this is the audit/verification surface
    // (QR + copy ID), not configurable by the overlay profile.
    page.drawRectangle({ x: 0, y: 0, width, height: FOOTER_HEIGHT, color: rgb(0.016, 0.031, 0.039) });
    page.drawRectangle({ x: 0, y: FOOTER_HEIGHT - 1, width, height: 1, color: rgb(0.12, 0.89, 0.76) });

    const textX = 18;
    let textY = FOOTER_HEIGHT - 16;
    const lineGap = 12;

    page.drawText('NEURATRACE CONTROLLED COPY', { x: textX, y: textY, size: 9, font: fontBold, color: rgb(0.12, 0.89, 0.76) });
    textY -= lineGap;
    page.drawText(`Document: ${input.documentNumber}   Revision: ${input.revisionLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.9, 0.95, 0.95) });
    textY -= lineGap;
    page.drawText(`Copy ID: ${input.copyIdentifier}`, { x: textX, y: textY, size: 8, font, color: rgb(0.9, 0.95, 0.95) });
    textY -= lineGap;
    page.drawText(`Printed: ${input.printedDateLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.56, 0.64, 0.63) });
    textY -= lineGap;
    page.drawText(`Issued To: ${input.issuedToLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.56, 0.64, 0.63) });
    textY -= lineGap;
    page.drawText(`Page ${idx + 1} of ${totalPages}  |  Marking: ${input.markingLabel}`, { x: textX, y: textY, size: 8, font, color: rgb(0.56, 0.64, 0.63) });

    const qrSize = 68;
    page.drawImage(qrImage, { x: width - qrSize - 18, y: (FOOTER_HEIGHT - qrSize) / 2, width: qrSize, height: qrSize });

    // Epic E — configurable overlay: logo + stamp fields, laid out wherever
    // the Document Controller positioned them (outside the footer band,
    // typically near the top, matching the reference stamped-SOP image).
    if (input.overlayProfile) {
      if (logoImage && idx === 0) {
        const logoWidth = input.overlayProfile.logoWidth ?? 90;
        const logoHeight = input.overlayProfile.logoHeight ?? 40;
        page.drawImage(logoImage, {
          x: input.overlayProfile.logoX ?? width - logoWidth - 20,
          y: input.overlayProfile.logoY ?? height - logoHeight - 20,
          width: logoWidth,
          height: logoHeight,
        });
      }
      for (const field of input.overlayProfile.stampFields) {
        const onThisPage = (field.page ?? 'all') === 'all' || (field.page === 'first' && idx === 0);
        if (!onThisPage) continue;
        drawStampField(page, field, field.bold ? fontBold : font);
      }
    }

    // Epic E6 — preview watermark. Diagonal, translucent, unmistakable: this
    // must never be confusable with an actual controlled print.
    if (input.previewOnly) {
      drawPreviewWatermark(page, fontBold, width, height);
    }
  });

  return outDoc.save();
}

async function embedLogo(doc: PDFDocument, bytes: Uint8Array) {
  try {
    return await doc.embedPng(bytes);
  } catch {
    return await doc.embedJpg(bytes);
  }
}

function drawStampField(page: PDFPage, field: StampField, font: PDFFont) {
  const text = field.label ? `${field.label}: ${field.value}` : field.value;
  page.drawText(text, {
    x: field.x,
    y: field.y,
    size: field.fontSize ?? 9,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function drawPreviewWatermark(page: PDFPage, font: PDFFont, width: number, height: number) {
  page.drawText('PREVIEW — NOT FOR PRINT', {
    x: width / 2 - 170,
    y: height / 2,
    size: 28,
    font,
    color: rgb(0.95, 0.35, 0.31),
    opacity: 0.35,
    rotate: degrees(35),
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}
