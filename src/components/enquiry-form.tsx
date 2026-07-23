"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { enquirySchema, type EnquiryInput } from "@/lib/validation";

export function EnquiryForm({
  type,
  title,
  buttonLabel,
  initialMessage = "",
}: {
  type: EnquiryInput["type"];
  title: string;
  buttonLabel: string;
  initialMessage?: string;
}) {
  const [result, setResult] = useState<{ reference: string; mode: string } | null>(null);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { type, website: "", message: initialMessage },
  });
  const input = "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";
  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as { error?: string; reference?: string; mode?: string };
    if (!response.ok || !data.reference) {
      setServerError(data.error ?? "Your message could not be sent.");
      return;
    }
    setResult({ reference: data.reference, mode: data.mode ?? "live" });
    reset({ type, website: "", message: initialMessage });
  });
  if (result)
    return (
      <div className="surface-card grid min-h-[430px] place-content-center p-8 text-center">
        <p className="eyebrow">Message confirmed</p>
        <h2 className="mt-4 font-display text-3xl font-semibold">We have your request.</h2>
        <p className="mt-4 text-[var(--text-muted)]">
          Reference <strong className="text-[var(--text-primary)]">{result.reference}</strong>
        </p>
        {result.mode === "local-test" && (
          <p className="mt-3 max-w-md text-sm text-[var(--text-muted)]">
            Local test mode confirmed the workflow; email, database and WhatsApp delivery activate
            with production credentials.
          </p>
        )}
        <button
          type="button"
          className="button-secondary mx-auto mt-7"
          onClick={() => setResult(null)}
        >
          Send another
        </button>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="surface-card grid gap-5 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <label className="grid gap-2 text-sm font-semibold">
        Name
        <input className={input} {...register("name")} autoComplete="name" />
        {errors.name && <span className="text-xs text-[var(--error)]">{errors.name.message}</span>}
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <input className={input} {...register("email")} type="email" autoComplete="email" />
          {errors.email && (
            <span className="text-xs text-[var(--error)]">{errors.email.message}</span>
          )}
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Mobile
          <input className={input} {...register("mobile")} inputMode="tel" autoComplete="tel" />
          {errors.mobile && (
            <span className="text-xs text-[var(--error)]">{errors.mobile.message}</span>
          )}
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        What do you need?
        <textarea
          className="min-h-36 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
          {...register("message")}
        />
        {errors.message && (
          <span className="text-xs text-[var(--error)]">{errors.message.message}</span>
        )}
      </label>
      <input {...register("type")} type="hidden" />
      <input
        {...register("website")}
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px]"
        aria-hidden="true"
      />
      {serverError && (
        <p className="rounded-[var(--radius-btn)] bg-red-50 p-4 text-sm text-[var(--error)]" role="alert">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="button-primary w-full disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : buttonLabel}
      </button>
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        We use these details only to respond to this request. No success message is shown unless the
        server accepts it.
      </p>
    </form>
  );
}
