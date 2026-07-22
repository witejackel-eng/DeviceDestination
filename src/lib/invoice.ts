import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { siteConfig } from "@/config/site";
import { formatPrice } from "@/lib/products";

function formatInvoicePrice(paise: number) {
  return formatPrice(paise).replace("₹", "Rs. ");
}

export type InvoiceInput = {
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: Date;
  customer: {
    name: string;
    businessName?: string | null;
    gstin?: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ model: string; title: string; quantity: number; unitPriceInclGstPaise: number }>;
  totalInclGstPaise: number;
  includedGstPaise: number;
};

export async function createInvoicePdf(input: InvoiceInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.08, 0.07);
  const orange = rgb(1, 0.54, 0);
  let y = 790;
  page.drawRectangle({ x: 42, y: 770, width: 48, height: 48, color: orange });
  page.drawText("DD", { x: 55, y: 788, size: 15, font: bold, color: ink });
  page.drawText(siteConfig.legalName, { x: 104, y: 797, size: 19, font: bold, color: ink });
  page.drawText("TAX INVOICE", { x: 437, y: 797, size: 12, font: bold, color: ink });
  y = 750;
  const seller = [
    siteConfig.address.street,
    `${siteConfig.address.city}, ${siteConfig.address.region} ${siteConfig.address.postalCode}`,
    siteConfig.contact.email,
    siteConfig.contact.phoneDisplay,
    siteConfig.gstin ? `GSTIN: ${siteConfig.gstin}` : null,
  ].filter(Boolean) as string[];
  for (const line of seller) {
    page.drawText(line, { x: 42, y, size: 9, font: regular, color: ink });
    y -= 13;
  }
  page.drawText(`Invoice: ${input.invoiceNumber}`, {
    x: 390,
    y: 750,
    size: 9,
    font: bold,
    color: ink,
  });
  page.drawText(`Order: ${input.orderNumber}`, {
    x: 390,
    y: 735,
    size: 9,
    font: regular,
    color: ink,
  });
  page.drawText(`Issued: ${input.issuedAt.toLocaleDateString("en-IN")}`, {
    x: 390,
    y: 720,
    size: 9,
    font: regular,
    color: ink,
  });
  y = 650;
  page.drawText("BILL TO", { x: 42, y, size: 9, font: bold, color: orange });
  y -= 18;
  for (const line of [
    input.customer.businessName || input.customer.name,
    input.customer.address,
    `${input.customer.city}, ${input.customer.state} ${input.customer.pincode}`,
    input.customer.gstin ? `GSTIN: ${input.customer.gstin}` : null,
  ].filter(Boolean) as string[]) {
    page.drawText(line.slice(0, 82), { x: 42, y, size: 9, font: regular, color: ink });
    y -= 14;
  }
  y -= 18;
  page.drawRectangle({ x: 42, y: y - 8, width: 511, height: 27, color: ink });
  page.drawText("MODEL / PRODUCT", { x: 50, y, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("QTY", { x: 395, y, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("UNIT", { x: 438, y, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("TOTAL", { x: 502, y, size: 8, font: bold, color: rgb(1, 1, 1) });
  y -= 32;
  for (const item of input.items) {
    page.drawText(`${item.model} — ${item.title}`.slice(0, 63), {
      x: 50,
      y,
      size: 8,
      font: regular,
      color: ink,
    });
    page.drawText(String(item.quantity), { x: 400, y, size: 8, font: regular, color: ink });
    page.drawText(formatInvoicePrice(item.unitPriceInclGstPaise), {
      x: 438,
      y,
      size: 8,
      font: regular,
      color: ink,
    });
    page.drawText(formatInvoicePrice(item.unitPriceInclGstPaise * item.quantity), {
      x: 502,
      y,
      size: 8,
      font: regular,
      color: ink,
    });
    y -= 24;
  }
  y -= 8;
  page.drawLine({ start: { x: 360, y }, end: { x: 553, y }, thickness: 0.7, color: ink });
  y -= 22;
  page.drawText("Total (GST included)", { x: 390, y, size: 10, font: bold, color: ink });
  page.drawText(formatInvoicePrice(input.totalInclGstPaise), {
    x: 500,
    y,
    size: 10,
    font: bold,
    color: ink,
  });
  y -= 18;
  page.drawText("Included GST", { x: 390, y, size: 9, font: regular, color: ink });
  page.drawText(formatInvoicePrice(input.includedGstPaise), {
    x: 500,
    y,
    size: 9,
    font: regular,
    color: ink,
  });
  page.drawText(
    "Model-specific warranty follows the applicable OEM terms and invoice eligibility.",
    { x: 42, y: 72, size: 8, font: regular, color: ink },
  );
  page.drawText(
    "Installation, HDD, PoE switching and cabling are excluded unless separately quoted.",
    { x: 42, y: 58, size: 8, font: regular, color: ink },
  );
  return Buffer.from(await pdf.save());
}
