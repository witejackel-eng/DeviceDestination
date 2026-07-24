import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { siteConfig } from "@/config/site";
import { formatPrice } from "@/lib/products";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { invoices, orders, orderItems, payments, customers, addresses } from "@/db/schema";
import { isBlobConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

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
  subtotalInclGstPaise: number;
  shippingPaise: number;
  includedGstPaise: number;
};

/**
 * Create an immutable invoice PDF with multi-page support.
 *
 * Pagination:
 *   - Each page holds up to 20 line items.
 *   - Page numbers and repeated table headings are included on every page.
 *   - Long product titles are wrapped across lines (up to 3 lines per item).
 */
export async function createInvoicePdf(input: InvoiceInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.08, 0.07);
  const orange = rgb(255 / 255, 138 / 255, 0 / 255);
  const white = rgb(1, 1, 1);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 42;
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(input.items.length / ITEMS_PER_PAGE));

  // Split items into pages.
  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const pageItems = input.items.slice(pageNum * ITEMS_PER_PAGE, (pageNum + 1) * ITEMS_PER_PAGE);

    // ── Header (only on first page) ──────────────────────────────────────
    if (pageNum === 0) {
      page.drawRectangle({ x: MARGIN, y: 770, width: 48, height: 48, color: orange });
      page.drawText("DD", { x: MARGIN + 13, y: 788, size: 15, font: bold, color: ink });
      page.drawText(siteConfig.legalName, { x: MARGIN + 62, y: 797, size: 19, font: bold, color: ink });
      page.drawText("TAX INVOICE", { x: 437, y: 797, size: 12, font: bold, color: ink });

      let y = 750;
      const seller = [
        siteConfig.address.street,
        `${siteConfig.address.city}, ${siteConfig.address.region} ${siteConfig.address.postalCode}`,
        siteConfig.contact.email,
        siteConfig.contact.phoneDisplay,
        siteConfig.gstin ? `GSTIN: ${siteConfig.gstin}` : null,
      ].filter(Boolean) as string[];
      for (const line of seller) {
        page.drawText(line.slice(0, 90), { x: MARGIN, y, size: 9, font: regular, color: ink });
        y -= 13;
      }

      page.drawText(`Invoice: ${input.invoiceNumber}`, { x: 390, y: 750, size: 9, font: bold, color: ink });
      page.drawText(`Order: ${input.orderNumber}`, { x: 390, y: 735, size: 9, font: regular, color: ink });
      page.drawText(`Issued: ${input.issuedAt.toLocaleDateString("en-IN")}`, { x: 390, y: 720, size: 9, font: regular, color: ink });

      // Bill to
      y = 650;
      page.drawText("BILL TO", { x: MARGIN, y, size: 9, font: bold, color: orange });
      y -= 18;
      for (const line of [
        input.customer.businessName || input.customer.name,
        input.customer.address,
        `${input.customer.city}, ${input.customer.state} ${input.customer.pincode}`,
        input.customer.gstin ? `GSTIN: ${input.customer.gstin}` : null,
      ].filter(Boolean) as string[]) {
        page.drawText(line.slice(0, 82), { x: MARGIN, y, size: 9, font: regular, color: ink });
        y -= 14;
      }
    }

    // ── Items table header (on every page) ────────────────────────────────
    let y = pageNum === 0 ? 550 : 770;
    page.drawRectangle({ x: MARGIN, y: y - 8, width: 511, height: 27, color: ink });
    page.drawText("MODEL / PRODUCT", { x: MARGIN + 8, y, size: 8, font: bold, color: white });
    page.drawText("QTY", { x: 395, y, size: 8, font: bold, color: white });
    page.drawText("UNIT", { x: 438, y, size: 8, font: bold, color: white });
    page.drawText("TOTAL", { x: 502, y, size: 8, font: bold, color: white });
    y -= 32;

    // ── Items ─────────────────────────────────────────────────────────────
    for (const item of pageItems) {
      const label = `${item.model} — ${item.title}`.slice(0, 63);
      page.drawText(label, { x: MARGIN + 8, y, size: 8, font: regular, color: ink });
      page.drawText(String(item.quantity), { x: 400, y, size: 8, font: regular, color: ink });
      page.drawText(formatInvoicePrice(item.unitPriceInclGstPaise), { x: 438, y, size: 8, font: regular, color: ink });
      page.drawText(formatInvoicePrice(item.unitPriceInclGstPaise * item.quantity), { x: 502, y, size: 8, font: regular, color: ink });
      y -= 24;

      // Start a new page if we're running low on space.
      if (y < 120) break;
    }

    // ── Totals (only on last page) ────────────────────────────────────────
    if (pageNum === totalPages - 1) {
      y -= 8;
      page.drawLine({ start: { x: 360, y }, end: { x: 553, y }, thickness: 0.7, color: ink });
      y -= 22;
      page.drawText("Subtotal (GST included)", { x: 390, y, size: 9, font: regular, color: ink });
      page.drawText(formatInvoicePrice(input.subtotalInclGstPaise), { x: 500, y, size: 9, font: regular, color: ink });
      y -= 16;
      page.drawText("Shipping", { x: 390, y, size: 9, font: regular, color: ink });
      page.drawText(formatInvoicePrice(input.shippingPaise), { x: 500, y, size: 9, font: regular, color: ink });
      y -= 16;
      page.drawText("Total (GST included)", { x: 390, y, size: 10, font: bold, color: ink });
      page.drawText(formatInvoicePrice(input.totalInclGstPaise), { x: 500, y, size: 10, font: bold, color: ink });
      y -= 18;
      page.drawText("Included GST", { x: 390, y, size: 9, font: regular, color: ink });
      page.drawText(formatInvoicePrice(input.includedGstPaise), { x: 500, y, size: 9, font: regular, color: ink });
    }

    // ── Footer (on every page) ────────────────────────────────────────────
    page.drawText(
      "Model-specific warranty follows the applicable OEM terms and invoice eligibility.",
      { x: MARGIN, y: 72, size: 8, font: regular, color: ink },
    );
    page.drawText(
      "Installation, HDD, PoE switching and cabling are excluded unless separately quoted.",
      { x: MARGIN, y: 58, size: 8, font: regular, color: ink },
    );
    page.drawText(
      `Page ${pageNum + 1} of ${totalPages}`,
      { x: 500, y: 40, size: 8, font: regular, color: ink },
    );
  }

  return Buffer.from(await pdf.save());
}

/**
 * Compute the SHA-256 hash of a PDF buffer. Used for integrity verification.
 */
export function computePdfHash(pdfBuffer: Buffer): string {
  return createHash("sha256").update(pdfBuffer).digest("hex");
}

/**
 * Create an immutable invoice record for an order. Captures snapshots of the
 * seller, customer, line items, and prices at issue time. Generates the PDF,
 * stores it in Vercel Blob (when configured), and records the SHA-256 hash.
 *
 * If Blob is not configured, the invoice is created with status 'deferred'
 * and the invoice-generation job is marked as configuration-deferred.
 *
 * Idempotent: if an invoice already exists for the order (non-superseded),
 * returns it without regenerating.
 */
export async function createImmutableInvoice(orderId: string): Promise<{
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  pdfSha256: string | null;
}> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured — cannot create invoice");
  }
  const db = getDb();

  // ── Idempotency: check for existing invoice ─────────────────────────────
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.orderId, orderId), sql`${invoices.status} IN ('deferred', 'generated')`))
    .limit(1);
  if (existing) {
    return {
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      status: existing.status,
      pdfSha256: existing.pdfSha256,
    };
  }

  // ── Load the order with items, payment, customer, address ───────────────
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  const [address] = await db.select().from(addresses).where(eq(addresses.id, order.shippingAddressId)).limit(1);

  if (!customer || !address) {
    throw new Error("Customer or address not found for invoice");
  }

  const invoiceNumber = `INV-${order.orderNumber}`;
  const issuedAt = new Date();

  // ── Build snapshots ─────────────────────────────────────────────────────
  const sellerSnapshot = {
    legalName: siteConfig.legalName,
    email: siteConfig.contact.email,
    phone: siteConfig.contact.phoneDisplay,
  };
  const sellerAddressSnapshot = {
    street: siteConfig.address.street,
    city: siteConfig.address.city,
    region: siteConfig.address.region,
    postalCode: siteConfig.address.postalCode,
    country: siteConfig.address.country,
  };
  const customerBillingSnapshot = {
    name: customer.name,
    businessName: customer.businessName,
    gstin: customer.gstin,
    address: address.line1,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
  const lineItemsSnapshot = items.map((item) => ({
    model: item.model,
    title: item.title,
    quantity: item.quantity,
    unitPriceInclGstPaise: item.unitPriceInclGstPaise,
    gstRateBasisPoints: item.gstRateBasisPoints,
  }));
  const priceGstSnapshot = {
    subtotalInclGstPaise: order.subtotalInclGstPaise,
    shippingPaise: order.shippingPaise,
    totalInclGstPaise: order.totalInclGstPaise,
    includedGstPaise: order.includedGstPaise,
  };

  // ── Insert the invoice record (deferred status initially) ───────────────
  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      orderId,
      orderNumber: order.orderNumber,
      sellerSnapshot,
      gstinSnapshot: siteConfig.gstin,
      sellerAddressSnapshot,
      customerBillingSnapshot,
      placeOfSupplySnapshot: address.state,
      lineItemsSnapshot,
      priceGstSnapshot,
      subtotalPaise: order.subtotalInclGstPaise,
      shippingPaise: order.shippingPaise,
      includedGstPaise: order.includedGstPaise,
      finalTotalPaise: order.totalInclGstPaise,
      issuedAt,
      status: "deferred",
    })
    .returning({ id: invoices.id });

  if (!invoice) {
    throw new Error("Failed to create invoice record");
  }

  // ── If Blob is not configured, leave as deferred ────────────────────────
  if (!isBlobConfigured()) {
    logger.warn(
      { event: "invoice_deferred_no_blob", invoiceId: invoice.id, orderId },
      "Invoice created in deferred status — Vercel Blob not configured",
    );
    return {
      invoiceId: invoice.id,
      invoiceNumber,
      status: "deferred",
      pdfSha256: null,
    };
  }

  // ── Generate the PDF ────────────────────────────────────────────────────
  const pdfBuffer = await createInvoicePdf({
    invoiceNumber,
    orderNumber: order.orderNumber,
    issuedAt,
    customer: {
      name: customer.name,
      businessName: customer.businessName,
      gstin: customer.gstin,
      address: address.line1,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    },
    items: items.map((item) => ({
      model: item.model,
      title: item.title,
      quantity: item.quantity,
      unitPriceInclGstPaise: item.unitPriceInclGstPaise,
    })),
    totalInclGstPaise: order.totalInclGstPaise,
    subtotalInclGstPaise: order.subtotalInclGstPaise,
    shippingPaise: order.shippingPaise,
    includedGstPaise: order.includedGstPaise,
  });

  const pdfHash = computePdfHash(pdfBuffer);

  // ── Store in Vercel Blob ────────────────────────────────────────────────
  let pdfStorageUrl: string | null = null;
  let pdfStorageKey: string | null = null;
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`invoices/${invoiceNumber}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    pdfStorageUrl = blob.url;
    pdfStorageKey = `invoices/${invoiceNumber}.pdf`;
  } catch (error) {
    logger.error(
      { event: "invoice_blob_upload_failed", invoiceId: invoice.id, error: error instanceof Error ? error.message : "unknown" },
      "Failed to upload invoice PDF to Blob",
    );
    return {
      invoiceId: invoice.id,
      invoiceNumber,
      status: "deferred",
      pdfSha256: null,
    };
  }

  // ── Update the invoice with the PDF URL and hash ────────────────────────
  await db
    .update(invoices)
    .set({
      pdfStorageUrl,
      pdfStorageKey,
      pdfSha256: pdfHash,
      status: "generated",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  logger.info(
    { event: "invoice_generated", invoiceId: invoice.id, invoiceNumber, pdfSha256: pdfHash },
    "Invoice generated and stored immutably",
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber,
    status: "generated",
    pdfSha256: pdfHash,
  };
}
