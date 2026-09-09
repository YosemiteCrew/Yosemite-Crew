import logger from "src/utils/logger";

// Give the panel a few seconds and no more: the forward runs off the request
// path, but an unbounded hang would pin the event loop's socket pool for
// nothing when the panel is unreachable.
const FORWARD_TIMEOUT_MS = 5_000;

export type ConsentCategory = "analytics" | "marketing";

export interface ConsentDecision {
  category: ConsentCategory;
  granted: boolean;
}

export interface SuperadminConsentPayload {
  consentId: string;
  source: "web" | "mobile";
  decisions: ConsentDecision[];
  email?: string;
  userId?: string;
  policyVersion?: string;
}

/**
 * Best-effort mirror of web consent decisions into the SuperAdmin panel's
 * consent ledger (GDPR audit trail). The panel's /api/consent is an append-only
 * record of banner/preference decisions, authenticated by a shared secret in
 * the x-consent-key header.
 *
 * The product web app owns no consent ledger of its own - this forward IS the
 * durable record, so it is wired from the cookie banner's accept/reject action
 * through a public relay route (see consent.router.ts) that holds the shared
 * key server-side. The panel being down or unconfigured must never fail the
 * visitor's decision, so the forward is fire-and-forget: it returns immediately
 * and a missing or rejected forward surfaces only in the log.
 *
 * Unconfigured (either env var absent) means mirroring is off, exactly as on
 * the contact side.
 */
export const SuperadminConsentService = {
  async forwardConsentDecision(
    payload: SuperadminConsentPayload,
    userAgent?: string,
  ): Promise<void> {
    const url = process.env.SUPERADMIN_CONSENT_INTAKE_URL;
    const key = process.env.SUPERADMIN_CONSENT_INTAKE_KEY;
    if (!url || !key) return;

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-consent-key": key,
      };
      // The browser's user-agent is what the panel's consent event wants; the
      // server's undici default would otherwise be recorded.
      if (userAgent) headers["user-agent"] = userAgent;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.warn("SuperAdmin consent intake rejected the forward", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to forward consent decision to SuperAdmin", {
        error,
      });
    }
  },
};
