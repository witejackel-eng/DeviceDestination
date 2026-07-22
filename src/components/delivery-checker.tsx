"use client";

import { useState } from "react";

export function DeliveryChecker() {
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(
          /^\d{6}$/.test(pincode)
            ? "Delivery timing will be confirmed before dispatch."
            : "Enter a valid 6-digit PIN code.",
        );
      }}
      className="mt-5"
    >
      <label htmlFor="delivery-pin" className="text-sm font-bold">
        Check delivery PIN
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="delivery-pin"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))}
          className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3"
          placeholder="110075"
        />
        <button type="submit" className="button-secondary">
          Check
        </button>
      </div>
      {message && (
        <p className="mt-2 text-sm text-[var(--muted)]" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}
