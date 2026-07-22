"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { catalogue } from "@/data/catalog";
import { useCartStore } from "@/lib/cart-store";
import { calculateCartTotals, formatPrice } from "@/lib/products";
import { getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};

async function loadRazorpay() {
  if (window.Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm() {
  const router = useRouter();
  const { items, clear } = useCartStore();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resolved = items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product && getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible
      ? [{ product, quantity: line.quantity }]
      : [];
  });
  const totals = calculateCartTotals(resolved);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { installationRequested: false, policyConsent: false, website: "" },
  });
  const input = "h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3";

  const onSubmit = handleSubmit(async (customer) => {
    setSubmitting(true);
    setServerError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ customer, items }),
      });
      const data = (await response.json()) as {
        error?: string;
        mode?: "test" | "razorpay";
        verified?: boolean;
        orderNumber?: string;
        confirmationToken?: string;
        keyId?: string;
        razorpayOrderId?: string;
        amount?: number;
      };
      if (!response.ok || !data.orderNumber)
        throw new Error(data.error ?? "Checkout could not be completed.");
      if (data.mode === "test" && data.verified && data.confirmationToken) {
        clear();
        router.push(`/order/${data.orderNumber}/success?mode=test&token=${data.confirmationToken}`);
        return;
      }
      if (!data.keyId || !data.razorpayOrderId || !data.amount)
        throw new Error("Payment configuration is incomplete.");
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay)
        throw new Error("Payment window could not load. Please retry.");
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        name: "DeviceDestination",
        description: `Order ${data.orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: { name: customer.name, email: customer.email, contact: customer.mobile },
        handler: async (payment) => {
          const verification = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              orderNumber: data.orderNumber,
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
            }),
          });
          const verified = (await verification.json()) as { confirmationToken?: string };
          if (!verification.ok || !verified.confirmationToken) {
            setServerError(
              "Payment was received but verification is pending. Do not pay again; contact support with your payment ID.",
            );
            return;
          }
          clear();
          router.push(`/order/${data.orderNumber}/success?token=${verified.confirmationToken}`);
        },
        modal: {
          ondismiss: () =>
            setServerError("Payment was not completed. Your cart is still available."),
        },
      });
      checkout.open();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setSubmitting(false);
    }
  });

  if (resolved.length === 0)
    return (
      <div className="surface-card grid min-h-[420px] place-content-center p-8 text-center">
        <h2 className="font-display text-3xl font-semibold">Your cart is empty.</h2>
        <Link href="/products" className="button-primary mt-6">
          Browse products
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
      <div className="surface-card grid gap-5 p-6 sm:p-8">
        <h2 className="font-display text-3xl font-semibold">Delivery and invoice</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" error={errors.name?.message}>
            <input className={input} {...register("name")} autoComplete="name" />
          </Field>
          <Field label="Mobile" error={errors.mobile?.message}>
            <input className={input} {...register("mobile")} inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input className={input} {...register("email")} type="email" autoComplete="email" />
          </Field>
          <Field label="Business name (optional)" error={errors.businessName?.message}>
            <input className={input} {...register("businessName")} />
          </Field>
          <Field label="GSTIN (optional)" error={errors.gstin?.message}>
            <input className={input} {...register("gstin")} />
          </Field>
          <Field label="PIN code" error={errors.pincode?.message}>
            <input className={input} {...register("pincode")} inputMode="numeric" maxLength={6} />
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white p-3"
            {...register("address")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            <input className={input} {...register("city")} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <input className={input} {...register("state")} defaultValue="Delhi" />
          </Field>
        </div>
        <Field label="Delivery instructions (optional)" error={errors.instructions?.message}>
          <textarea
            className="min-h-20 w-full rounded-xl border border-[var(--line)] bg-white p-3"
            {...register("instructions")}
          />
        </Field>
        <input
          {...register("website")}
          tabIndex={-1}
          autoComplete="off"
          className="absolute -left-[9999px]"
          aria-hidden="true"
        />
        <label className="flex min-h-12 items-start gap-3 rounded-xl bg-[var(--canvas-alt)] p-4 text-sm">
          <input
            type="checkbox"
            {...register("installationRequested")}
            className="mt-0.5 h-5 w-5 accent-[var(--tangerine)]"
          />
          <span>
            <strong>Request installation help</strong>
            <br />
            <span className="text-[var(--muted)]">
              A third-party installer will quote separately after checking the site.
            </span>
          </span>
        </label>
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input
            type="checkbox"
            {...register("policyConsent")}
            className="mt-0.5 h-5 w-5 accent-[var(--tangerine)]"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>
            ,{" "}
            <Link href="/shipping-policy" className="underline">
              shipping
            </Link>{" "}
            and{" "}
            <Link href="/refund-policy" className="underline">
              return policy
            </Link>
            .
          </span>
        </label>
        {errors.policyConsent?.message && (
          <p className="text-sm text-[var(--danger)]">{errors.policyConsent.message}</p>
        )}
      </div>
      <aside className="surface-card h-fit p-6 lg:sticky lg:top-28">
        <h2 className="font-display text-3xl font-semibold">Order summary</h2>
        <ul className="mt-5 grid gap-3 border-b border-[var(--line)] pb-5 text-sm">
          {resolved.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between gap-4">
              <span>
                {product.model} × {quantity}
              </span>
              <strong>{formatPrice((product.sellingPriceInclGstPaise ?? 0) * quantity)}</strong>
            </li>
          ))}
        </ul>
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt>Products subtotal</dt>
            <dd>{formatPrice(totals.subtotalInclGstPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>₹0</dd>
          </div>
          <div className="flex justify-between">
            <dt>Installation</dt>
            <dd>Quoted separately</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--line)] pt-4 text-lg">
            <dt className="font-bold">Grand total</dt>
            <dd className="font-bold">{formatPrice(totals.grandTotalInclGstPaise)}</dd>
          </div>
          <div className="flex justify-between text-[var(--muted)]">
            <dt>Includes GST</dt>
            <dd>{formatPrice(totals.includedGstPaise)}</dd>
          </div>
        </dl>
        {serverError && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-[var(--danger)]" role="alert">
            {serverError}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="button-primary mt-6 w-full disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Checking order…" : "Continue to secure payment"}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Cart prices are rechecked on the server before payment.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      {children}
      {error && <span className="text-xs font-medium text-[var(--danger)]">{error}</span>}
    </label>
  );
}
