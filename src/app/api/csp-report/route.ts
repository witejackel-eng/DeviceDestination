import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * CSP violation reporting endpoint.
 *
 * Receives violation reports from the browser (via `report-uri` and the
 * Reporting API). Logs them at warn level so they surface in monitoring
 * without flooding the error stream. The reports are NOT persisted — they
 * are observational only.
 *
 * Returns 204 No Content so the browser does not expect a body.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body) {
      // The report format is either a single object (report-uri) or an
      // array of { type, body } objects (Reporting API). Handle both.
      const reports = Array.isArray(body) ? body : [body];
      for (const report of reports) {
        const r = report.body ?? report;
        logger.warn(
          {
            event: "csp_violation",
            documentUri: r["document-uri"] ?? r.documentUri,
            violatedDirective: r["violated-directive"] ?? r.violatedDirective,
            blockedUri: r["blocked-uri"] ?? r.blockedUri,
            sourceFile: r["source-file"] ?? r.sourceFile,
            lineNumber: r["line-number"] ?? r.lineNumber,
          },
          "CSP violation reported by browser",
        );
      }
    }
  } catch {
    // Ignore parse errors — the report is observational only.
  }
  return new NextResponse(null, { status: 204 });
}
