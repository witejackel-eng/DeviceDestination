"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--canvas-alt)] hover:text-[var(--ink)]"
    >
      <LogOut size={15} /> Sign out
    </button>
  );
}
