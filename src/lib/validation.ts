import { z } from "zod";

export const cartLineSchema = z.object({
  productId: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.email(),
  businessName: z.string().trim().max(150).optional(),
  gstin: z
    .string()
    .trim()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, "Enter a valid GSTIN")
    .optional(),
  address: z.string().trim().min(8).max(300),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
  instructions: z.string().trim().max(500).optional(),
  installationRequested: z.boolean(),
  policyConsent: z.boolean().refine((value) => value, "You must accept the policies"),
  website: z.string().max(0).optional(),
});

export const orderRequestSchema = z.object({
  customer: checkoutSchema,
  items: z.array(cartLineSchema).min(1).max(50),
});

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/),
  message: z.string().trim().min(10).max(2000),
  type: z.enum(["contact", "quote", "installation"]),
  website: z.string().max(0).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;
