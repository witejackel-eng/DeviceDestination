import { toNextJsHandler } from "better-auth/next-js";
import { getAuth, isAuthConfigured } from "@/lib/auth";

async function handler(request: Request) {
  if (!isAuthConfigured())
    return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  return getAuth().handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
