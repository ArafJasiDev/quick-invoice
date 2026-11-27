import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatDisplayDate } from "./dates";
import { formatINR } from "./money";

export interface PdfInvoiceData {
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "overdue";
  issueDate: string;
  dueDate: string;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  businessName: string;
  businessLogo: string | null;
  businessAddress: string;
  businessGstin: string;
  businessPhone: string;
  businessEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  terms: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
}

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

function loadCustomFonts(): { regular: Uint8Array; bold: Uint8Array } | null {
  const regularPath = path.join(FONT_DIR, "NotoSans-Regular.ttf");
  const boldPath = path.join(FONT_DIR, "NotoSans-Bold.ttf");
  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    return {
      regular: new Uint8Array(fs.readFileSync(regularPath)),
      bold: new Uint8Array(fs.readFileSync(boldPath)),
    };
  }
  return null;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.replaceAll("\r\n", "\n").split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Break overly long single words if needed
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, fontSize) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

async function embedLogo(doc: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const [, kind, b64] = match;
  if (!b64) return null;
  const bytes = Buffer.from(b64, "base64");
  try {
    return kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(data: PdfInvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const customFonts = loadCustomFonts();
  const hasUnicodeRupee = Boolean(customFonts);

  const regularFont = customFonts
    ? await doc.embedFont(customFonts.regular)
    : await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = customFonts
    ? await doc.embedFont(customFonts.bold)
    : await doc.embedFont(StandardFonts.HelveticaBold);

  const formatMoney = (paise: number): string => {
    const formatted = formatINR(paise);
    return hasUnicodeRupee ? formatted : formatted.replace("₹", "Rs. ");
  };

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  const slate900 = rgb(0.06, 0.09, 0.16);
  const slate600 = rgb(0.28, 0.33, 0.41);
  const slate400 = rgb(0.58, 0.64, 0.72);
  const borderLight = rgb(0.89, 0.91, 0.94);
  const bgSoft = rgb(0.97, 0.98, 0.99);
  const emerald600 = rgb(0.02, 0.59, 0.41);
  const emeraldBg = rgb(0.93, 0.99, 0.96);

  let page: PDFPage = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 24) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Top Header: Logo + Business Info on left, INVOICE + Number + PAID badge on right
  const logoImage = await embedLogo(doc, data.businessLogo);
  let leftHeaderBottom = y;

  if (logoImage) {
    const maxLogoW = 96;
    const maxLogoH = 44;
    const scale = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height, 1);
    const drawW = logoImage.width * scale;
    const drawH = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: margin,
      y: y - drawH,
      width: drawW,
      height: drawH,
    });
    leftHeaderBottom = y - drawH - 10;
  }

  page.drawText(data.businessName, {
    x: margin,
    y: leftHeaderBottom - 14,
    size: 14,
    font: boldFont,
    color: slate900,
  });
  leftHeaderBottom -= 20;

  const bizDetailLines: string[] = [];
  if (data.businessAddress.trim()) {
    bizDetailLines.push(...wrapText(data.businessAddress.trim(), regularFont, 9, 270));
  }
  if (data.businessGstin.trim()) bizDetailLines.push(`GSTIN: ${data.businessGstin.trim()}`);
  if (data.businessPhone.trim()) bizDetailLines.push(`Phone: ${data.businessPhone.trim()}`);
  if (data.businessEmail.trim()) bizDetailLines.push(`Email: ${data.businessEmail.trim()}`);

  for (const line of bizDetailLines) {
    leftHeaderBottom -= 13;
    page.drawText(line, {
      x: margin,
      y: leftHeaderBottom,
      size: 9,
      font: regularFont,
      color: slate600,
    });
  }

  // Right header
  const rightAlignX = (text: string, font: PDFFont, size: number) =>
    pageWidth - margin - font.widthOfTextAtSize(text, size);

  let rightY = y - 18;
  page.drawText("INVOICE", {
    x: rightAlignX("INVOICE", boldFont, 20),
    y: rightY,
    size: 20,
    font: boldFont,
    color: slate900,
  });
  rightY -= 18;
  page.drawText(data.invoiceNumber, {
    x: rightAlignX(data.invoiceNumber, boldFont, 11),
    y: rightY,
    size: 11,
    font: boldFont,
    color: slate600,
  });

  if (data.status === "paid") {
    rightY -= 26;
    const badgeW = 68;
    const badgeH = 22;
    const badgeX = pageWidth - margin - badgeW;
    page.drawRectangle({
      x: badgeX,
      y: rightY,
      width: badgeW,
      height: badgeH,
      color: emeraldBg,
      borderColor: emerald600,
      borderWidth: 1.5,
    });
    const paidLabel = "PAID";
    const paidTextW = boldFont.widthOfTextAtSize(paidLabel, 11);
    page.drawText(paidLabel, {
      x: badgeX + (badgeW - paidTextW) / 2,
      y: rightY + 6,
      size: 11,
      font: boldFont,
      color: emerald600,
    });
  }

  y = Math.min(leftHeaderBottom, rightY) - 22;

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: borderLight,
  });
  y -= 20;

  // Bill To & Invoice Dates row
  const billToTop = y;
  page.drawText("BILL TO", {
    x: margin,
    y: billToTop,
    size: 8.5,
    font: boldFont,
    color: slate400,
  });
  let billY = billToTop - 15;
  page.drawText(data.customerName, {
    x: margin,
    y: billY,
    size: 11,
    font: boldFont,
    color: slate900,
  });
  billY -= 14;
  if (data.customerEmail) {
    page.drawText(data.customerEmail, {
      x: margin,
      y: billY,
      size: 9.5,
      font: regularFont,
      color: slate600,
    });
    billY -= 13;
  }
  if (data.customerPhone) {
    page.drawText(data.customerPhone, {
      x: margin,
      y: billY,
      size: 9.5,
      font: regularFont,
      color: slate600,
    });
    billY -= 13;
  }

  const issueLabel = `Invoice Date: ${formatDisplayDate(data.issueDate)}`;
  const dueLabel = `Due Date: ${formatDisplayDate(data.dueDate)}`;
  page.drawText(issueLabel, {
    x: rightAlignX(issueLabel, regularFont, 9.5),
    y: billToTop - 15,
    size: 9.5,
    font: regularFont,
    color: slate600,
  });
  page.drawText(dueLabel, {
    x: rightAlignX(dueLabel, boldFont, 9.5),
    y: billToTop - 30,
    size: 9.5,
    font: boldFont,
    color: slate900,
  });

  y = Math.min(billY, billToTop - 42) - 18;

  // Items table header
  const colDescX = margin + 8;
  const colQtyRight = margin + contentWidth * 0.62;
  const colRateRight = margin + contentWidth * 0.8;
  const colTotalRight = pageWidth - margin - 8;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 22,
      width: contentWidth,
      height: 22,
      color: bgSoft,
      borderColor: borderLight,
      borderWidth: 0.75,
    });
    const headerTextY = y - 14.5;
    page.drawText("DESCRIPTION", {
      x: colDescX,
      y: headerTextY,
      size: 8.5,
      font: boldFont,
      color: slate600,
    });
    page.drawText("QTY", {
      x: colQtyRight - boldFont.widthOfTextAtSize("QTY", 8.5),
      y: headerTextY,
      size: 8.5,
      font: boldFont,
      color: slate600,
    });
    page.drawText("RATE", {
      x: colRateRight - boldFont.widthOfTextAtSize("RATE", 8.5),
      y: headerTextY,
      size: 8.5,
      font: boldFont,
      color: slate600,
    });
    page.drawText("AMOUNT", {
      x: colTotalRight - boldFont.widthOfTextAtSize("AMOUNT", 8.5),
      y: headerTextY,
      size: 8.5,
      font: boldFont,
      color: slate600,
    });
    y -= 22;
  };

  drawTableHeader();

  for (const item of data.items) {
    const descLines = wrapText(item.description, regularFont, 9.5, contentWidth * 0.5);
    const rowHeight = Math.max(24, descLines.length * 13 + 10);

    if (y - rowHeight < margin + 80) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawTableHeader();
    }

    let lineY = y - 15;
    for (const dLine of descLines) {
      page.drawText(dLine, {
        x: colDescX,
        y: lineY,
        size: 9.5,
        font: regularFont,
        color: slate900,
      });
      lineY -= 13;
    }

    const qtyText = String(item.quantity);
    const rateText = formatMoney(item.unitPricePaise);
    const totalText = formatMoney(item.lineTotalPaise);

    page.drawText(qtyText, {
      x: colQtyRight - regularFont.widthOfTextAtSize(qtyText, 9.5),
      y: y - 15,
      size: 9.5,
      font: regularFont,
      color: slate600,
    });
    page.drawText(rateText, {
      x: colRateRight - regularFont.widthOfTextAtSize(rateText, 9.5),
      y: y - 15,
      size: 9.5,
      font: regularFont,
      color: slate600,
    });
    page.drawText(totalText, {
      x: colTotalRight - boldFont.widthOfTextAtSize(totalText, 9.5),
      y: y - 15,
      size: 9.5,
      font: boldFont,
      color: slate900,
    });

    y -= rowHeight;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: borderLight,
    });
  }

  // Totals section
  ensureSpace(90);
  y -= 16;

  const totalsLabelX = margin + contentWidth * 0.62;
  const drawTotalRow = (label: string, value: string, isBold: boolean) => {
    const f = isBold ? boldFont : regularFont;
    const size = isBold ? 11 : 9.5;
    const color = isBold ? slate900 : slate600;
    page.drawText(label, { x: totalsLabelX, y, size, font: f, color });
    page.drawText(value, {
      x: colTotalRight - f.widthOfTextAtSize(value, size),
      y,
      size,
      font: f,
      color,
    });
    y -= isBold ? 20 : 16;
  };

  drawTotalRow("Subtotal", formatMoney(data.subtotalPaise), false);
  drawTotalRow(`GST (${data.gstRate}%)`, formatMoney(data.gstPaise), false);
  page.drawLine({
    start: { x: totalsLabelX, y: y + 10 },
    end: { x: pageWidth - margin, y: y + 10 },
    thickness: 0.75,
    color: borderLight,
  });
  drawTotalRow("Total", formatMoney(data.totalPaise), true);

  // Notes & Terms
  if (data.notes.trim() || data.terms.trim()) {
    y -= 12;
    if (data.notes.trim()) {
      const noteLines = wrapText(data.notes.trim(), regularFont, 9, contentWidth);
      ensureSpace(noteLines.length * 13 + 24);
      page.drawText("NOTES", {
        x: margin,
        y,
        size: 8.5,
        font: boldFont,
        color: slate400,
      });
      y -= 14;
      for (const line of noteLines) {
        page.drawText(line, { x: margin, y, size: 9, font: regularFont, color: slate600 });
        y -= 13;
      }
      y -= 8;
    }

    if (data.terms.trim()) {
      const termLines = wrapText(data.terms.trim(), regularFont, 9, contentWidth);
      ensureSpace(termLines.length * 13 + 24);
      page.drawText("TERMS & CONDITIONS", {
        x: margin,
        y,
        size: 8.5,
        font: boldFont,
        color: slate400,
      });
      y -= 14;
      for (const line of termLines) {
        page.drawText(line, { x: margin, y, size: 9, font: regularFont, color: slate600 });
        y -= 13;
      }
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
