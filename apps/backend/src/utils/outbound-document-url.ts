import type { AxiosRequestConfig } from "axios";
import { buildPinnedAgent, resolvePublicAddresses } from "@yosemite-crew/lib";

/**
 * Stored document links (an object-store URL on a rendered document, a signing
 * provider's download link) are operator- and provider-supplied rather than
 * hard-coded, so they are treated as untrusted input on both legs of the round
 * trip: the host is resolved and checked before anything is derived from the
 * URL, the request itself is bounded, and the response is confirmed to be a PDF
 * before its bytes are handed back to a caller.
 *
 * The address classification, hostname resolution and connection pinning all
 * come from `@yosemite-crew/lib`, which is the single implementation shared
 * with the PDF renderer's branding fetch. The response check follows the same
 * shape that renderer already applies to a fetched branding asset.
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

export const UNEXPECTED_DOCUMENT_RESPONSE_MESSAGE =
  "Fetched document is not a PDF";

export class OutboundDocumentResponseError extends Error {
  constructor(message: string = UNEXPECTED_DOCUMENT_RESPONSE_MESSAGE) {
    super(message);
    this.name = "OutboundDocumentResponseError";
  }
}

/** Media types a PDF is legitimately served as. */
const PDF_CONTENT_TYPES = new Set(["application/pdf", "application/x-pdf"]);

/**
 * Media types that say "some bytes" and nothing more. Object stores routinely
 * serve stored files this way (and presigned URLs often carry no type at all),
 * so turning these down would break ordinary deployments. They are accepted,
 * but only on the strength of the leading bytes checked below - the byte check
 * is the real gate, and the media type only rules out a response that openly
 * declares itself to be something else.
 */
const GENERIC_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
]);

/** Every PDF begins with this marker at offset 0. */
const PDF_LEADING_BYTES = "%PDF-";

export type OutboundDocumentResponse = {
  data: ArrayBuffer | ArrayBufferView | Buffer;
  /** Raw axios response headers, or omitted for bytes read from our own store. */
  headers?: unknown;
};

const readContentType = (headers: unknown): string => {
  if (typeof headers !== "object" || headers === null) {
    return "";
  }

  const value = (headers as Record<string, unknown>)["content-type"];
  if (typeof value !== "string") {
    return "";
  }

  // Drop any parameters, e.g. `application/pdf; charset=binary`.
  return value.split(";")[0].trim().toLowerCase();
};

const toBuffer = (data: OutboundDocumentResponse["data"]): Buffer => {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  return Buffer.from(data);
};

/**
 * Confirm a fetched document really is a PDF before its bytes are returned.
 *
 * Two independent checks, because either one alone is weak: a declared media
 * type says nothing about the body, and the body alone would let a response
 * that openly declares itself as something else through. A missing or generic
 * media type is allowed and settled by the leading bytes.
 */
export const readValidatedPdfResponse = (
  response: OutboundDocumentResponse,
): Buffer => {
  const contentType = readContentType(response.headers);
  if (
    contentType &&
    !PDF_CONTENT_TYPES.has(contentType) &&
    !GENERIC_CONTENT_TYPES.has(contentType)
  ) {
    throw new OutboundDocumentResponseError();
  }

  const pdf = toBuffer(response.data);
  if (
    pdf.subarray(0, PDF_LEADING_BYTES.length).toString("latin1") !==
    PDF_LEADING_BYTES
  ) {
    throw new OutboundDocumentResponseError();
  }

  return pdf;
};
