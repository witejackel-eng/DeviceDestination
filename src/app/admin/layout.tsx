import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, isAuthConfigured } from "@/lib/auth";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured()) return <>{children}</>;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login?next=/admin");
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(session.user.email.toLowerCase())) redirect("/account");
  return <>{children}</>;
}
