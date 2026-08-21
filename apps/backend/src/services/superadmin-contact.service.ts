import logger from "src/utils/logger";
import type { CreateWebContactRequestInput } from "src/services/contact-us.service";

// Give the panel a few seconds and no more: the forward runs off the request
// path, but an unbounded hang would pin the event loop's socket pool for
// nothing when the panel is unreachable.
const FORWARD_TIMEOUT_MS = 5_000;

/**
 * Best-effort mirror of public contact-us submissions into the SuperAdmin
 * panel's CRM intake. The panel's /api/contact accepts the contact-web body
 * VERBATIM (it maps fullName/type/phone itself), authenticated by a shared
 * secret in the x-contact-key header, so no field mapping happens here.
 *
 * Two public forms reach this path, not one: /contact-us and the accessibility
 * report at /accessibility/report both POST to /v1/contact-us/contact-web, so
 * both are mirrored by this single forward.
 *
 * The product database remains the source of truth for the submission - a
 * missing or failing forward loses nothing and must never surface to the
 * visitor. Unconfigured (either env var absent) means mirroring is off.
 */
export const SuperadminContactService = {
  async forwardWebContact(
    payload: CreateWebContactRequestInput,
  ): Promise<void> {
    const url = process.env.SUPERADMIN_CONTACT_INTAKE_URL;
    const key = process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
    if (!url || !key) return;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-contact-key": key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.warn("SuperAdmin contact intake rejected the forward", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to forward contact submission to SuperAdmin", {
        error,
      });
    }
  },
};
