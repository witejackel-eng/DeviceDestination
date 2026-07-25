/**
 * Normalises a caller-supplied `next` destination into a same-origin path.
 *
 * Anything that could leave the site — an absolute URL, a protocol-relative
 * `//evil.example`, a backslash-escaped variant that some browsers normalise to
 * `//`, or a control character — collapses to the fallback. Returning a path
 * (never a URL) means callers cannot accidentally build an open redirect.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/account") {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 512) return fallback;
  // Browsers strip control characters and whitespace while parsing a URL, so a
  // value containing them cannot be validated by inspection — reject it.
  if ([...candidate].some((character) => character.charCodeAt(0) <= 0x20)) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  // `//host`, `/\host` and `/\/host` all resolve to a different origin.
  if (/^\/[/\\]/.test(candidate)) return fallback;

  return candidate;
}

/** Routes that must never become the post-sign-in landing page. */
const disallowed = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

export function postLoginRedirect(value: string | null | undefined, fallback = "/account") {
  const path = safeRedirectPath(value, fallback);
  return disallowed.has(path.split("?")[0]) ? fallback : path;
}
