import logger from "src/utils/logger";

/**
 * Base URL of the ActivityPub licence authority.
 *
 * The authority is SuperAdmin, not this API: it serves the licence JWKS, the
 * revocation list and the federation clinic directory. Every consumer must
 * resolve it the same way, which is why this lives in one place.
 *
 * It did not, and the divergence was not cosmetic. `ap-license.service` defaulted
 * to the authority while `activitypub.service` still defaulted to this API's own
 * host, which serves none of those routes - so with the variable unset, licence
 * verification and the directory pointed at two different hosts and the directory
 * fetched a 404. One variable, two destinations, and only one of them was fixed
 * when the default was corrected.
 *
 * `??` is not enough either. It falls back only on `null`/`undefined`, and
 * `apps/backend/.env.example` ships `AP_LICENSE_AUTHORITY_URL=""`, so a
 * deployment that copied it gets the empty string passed straight through. The
 * result is not a wrong host - it is `fetch("/api/ap/signing-key.json")`, which
 * throws `TypeError: Failed to parse URL` and surfaces three layers down as
 * `[AP license] token invalid`. An empty value must mean "not configured".
 */
export const DEFAULT_AP_AUTHORITY_URL = "https://admin.yosemitecrew.com";

/**
 * Resolves the configured authority, or the default when it is absent, blank or
 * unusable.
 *
 * A value that does not parse as a URL falls back rather than propagating, and
 * says so once at the point of the decision. Propagating it only moves the
 * failure to whichever fetch happens first, where the message names a URL rather
 * than a variable. The value is not logged: an authority URL is not a secret,
 * but a mistyped one can carry `user:password@host`, and this is the wrong place
 * to find out.
 */
export function apAuthorityBase(): string {
  const configured = process.env.AP_LICENSE_AUTHORITY_URL?.trim();
  if (!configured) return DEFAULT_AP_AUTHORITY_URL;

  try {
    new URL(configured);
  } catch {
    logger.warn(
      "[AP authority] AP_LICENSE_AUTHORITY_URL is not a valid URL - using the default authority",
      { default: DEFAULT_AP_AUTHORITY_URL },
    );
    return DEFAULT_AP_AUTHORITY_URL;
  }

  return configured.replace(/\/$/, "");
}
