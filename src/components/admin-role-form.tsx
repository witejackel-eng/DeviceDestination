"use client";

import { useActionState } from "react";
import { updateStaffRoleAction, type ActionResult } from "@/app/admin/actions";

const initial: ActionResult = { ok: false, message: "" };

const roles = [
  ["customer", "Customer"],
  ["operations", "Staff — operations"],
  ["catalogue_manager", "Staff — catalogue"],
  ["admin", "Admin"],
  ["owner", "Owner"],
] as const;

export function AdminRoleForm({
  userId,
  email,
  current,
  isSelf,
}: {
  userId: string;
  email: string;
  current: string;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => updateStaffRoleAction(formData),
    initial,
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const value = String(new FormData(event.currentTarget).get("role"));
        if (!window.confirm(`Set ${email} to ${value.replaceAll("_", " ")}?`)) event.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role for {email}
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={current}
        disabled={isSelf}
        className="h-9 rounded-[10px] border border-[var(--line)] bg-white px-2 text-sm disabled:opacity-50"
      >
        {roles.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isSelf || pending}
        className="button-secondary min-h-9 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : "Apply"}
      </button>
      {state.message && (
        <span
          role={state.ok ? "status" : "alert"}
          className={`text-xs ${state.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
