import type { AxiosRequestConfig } from "axios";
import { buildPinnedAgent, resolvePublicAddresses } from "@yosemite-crew/lib";

/**
 * Stored document links (an object-store URL on a rendered document, a signing
 * provider's download link) are operator- and provider-supplied rather than
 * hard-coded, so they are treated as untrusted input: the host is resolved and
 * checked before anything is derived from the URL, and the request itself is
 * bounded.
 *
 * The address classification, hostname resolution and connection pinning all
 * come from `@yosemite-crew/lib`, which is the single implementation shared
 * with the PDF renderer's branding fetch.
 */

/** Documents are larger than branding assets, so the caps are set separately. */
const OUTBOUND_DOCUMENT_TIMEOUT_MS = 15_000;
const OUTBOUND_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE = "Invalid URL";
const UNRESOLVABLE_OUTBOUND_DOCUMENT_HOST_MESSAGE =
  "Document URL host did not resolve to a permitted address";

export class OutboundDocumentUrlError extends Error {
  constructor(message: string = INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE) {
    super(message);
    this.name = "OutboundDocumentUrlError";
  }
}

/**
 * Hosts a deployment has explicitly opted in, for installs that serve documents
 * from an internal endpoint (a self-hosted object store on a private address,
 * for example). Empty by default, so an install that has not opted anything in
 * only ever reaches hosts that resolve to a public address.
 *
 * Configured through `DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS` as a
 * comma-separated hostname list; see `apps/backend/.env.example`.
 */
const allowedInternalDocumentHosts = (): string[] =>
  (process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

/**
 * Redirect policy, timeout and response-size cap applied to every outbound
 * document fetch. Redirects are not followed, because a redirect target is not
 * covered by the check already performed on the original host.
 */
const boundedRequestOptions = (): AxiosRequestConfig => ({
  responseType: "arraybuffer",
  timeout: OUTBOUND_DOCUMENT_TIMEOUT_MS,
  maxRedirects: 0,
  maxContentLength: OUTBOUND_DOCUMENT_MAX_BYTES,
  maxBodyLength: OUTBOUND_DOCUMENT_MAX_BYTES,
});

export type OutboundDocumentRequest = {
  /** The normalised URL. Anything derived from the link must come from here. */
  url: string;
  requestOptions: AxiosRequestConfig;
};

/**
 * Validate and normalise a stored document URL, returning the normalised URL
 * plus the request options to fetch it with.
 *
 * Callers must await this before deriving an object key, a filename or
 * anything else from the link, and must use the returned `url` rather than the
 * value they passed in.
 */
export const resolveOutboundDocumentUrl = async (
  rawUrl: string,
): Promise<OutboundDocumentRequest> => {
  // Checked on the raw string, because `new URL()` resolves dot-segments away.
  if (
    typeof rawUrl !== "string" ||
    rawUrl.includes("/../") ||
    /\/%2e%2e\//i.test(rawUrl)
  ) {
    throw new OutboundDocumentUrlError();
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OutboundDocumentUrlError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new OutboundDocumentUrlError();
  }

  const hostname = parsed.hostname.toLowerCase();

  // An opted-in internal host is a deliberate deployment choice, so it skips
  // the address check. Everything else about the request stays bounded.
  if (allowedInternalDocumentHosts().includes(hostname)) {
    return { url: parsed.href, requestOptions: boundedRequestOptions() };
  }

  const addresses = await resolvePublicAddresses(hostname);
  if (!addresses) {
    throw new OutboundDocumentUrlError(
      UNRESOLVABLE_OUTBOUND_DOCUMENT_HOST_MESSAGE,
    );
  }

  // Pin the connection to the addresses just checked so the fetch cannot end up
  // somewhere the check never saw.
  const agent = buildPinnedAgent(parsed.protocol, addresses);

  return {
    url: parsed.href,
    requestOptions: {
      ...boundedRequestOptions(),
      httpAgent: agent,
      httpsAgent: agent,
    },
  };
};
