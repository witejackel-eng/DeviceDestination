import { describe, expect, it } from "vitest";
import { createInvoicePdf } from "@/lib/invoice";
import { sendPaidOrderNotifications } from "@/lib/notifications";

const notificationInput = {
  orderNumber: "DD-20260722-ABC123",
  invoiceNumber: "INV-DD-20260722-ABC123",
  customerName: "Test Buyer",
  customerEmail: "buyer@example.com",
  customerMobile: "9876543210",
  total: "₹3,658",
  invoicePdf: Buffer.from("test"),
};

describe("paid-order fulfilment", () => {
  it("creates a real PDF invoice", async () => {
    const pdf = await createInvoicePdf({
      invoiceNumber: notificationInput.invoiceNumber,
      orderNumber: notificationInput.orderNumber,
      issuedAt: new Date("2026-07-22"),
      customer: {
        name: "Test Buyer",
        address: "Sector 13, Dwarka",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110075",
      },
      items: [
        {
          model: "CP-UNC-DA41L3C-D-Q",
          title: "4 MP IP Dome Camera",
          quantity: 1,
          unitPriceInclGstPaise: 365800,
        },
      ],
      totalInclGstPaise: 365800,
      subtotalInclGstPaise: 365800,
      shippingPaise: 0,
      includedGstPaise: 55800,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
  it("tracks email and WhatsApp failures independently", async () => {
    const result = await sendPaidOrderNotifications(notificationInput, {
      sendEmail: async () => {
        throw new Error("email unavailable");
      },
      sendWhatsapp: async () => undefined,
    });
    expect(result).toEqual({ emailStatus: "failed", whatsappStatus: "sent" });
  });
  it("does not invent notification success when channels are unconfigured", async () => {
    const result = await sendPaidOrderNotifications(notificationInput);
    expect(result).toEqual({ emailStatus: "skipped", whatsappStatus: "skipped" });
  });
});
