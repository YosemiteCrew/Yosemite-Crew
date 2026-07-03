import crypto, { createHash } from "crypto";

export interface SignatureComponents {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}

export interface SignRequestOptions {
  privateKeyPem: string;
  keyId: string;
  method: string;
  url: string;
  body?: string;
  date?: string;
}

export interface SignedHeaders {
  Date: string;
  Digest?: string;
  Signature: string;
}

function buildDigest(body: string): string {
  const hash = createHash("sha256").update(body, "utf8").digest("base64");
  return `SHA-256=${hash}`;
}

function buildSigningString(
  method: string,
  path: string,
  host: string,
  date: string,
  digest: string | undefined,
): { signingString: string; headers: string[] } {
  const headers: string[] = ["(request-target)", "host", "date"];
  const lines: string[] = [
    `(request-target): ${method.toLowerCase()} ${path}`,
    `host: ${host}`,
    `date: ${date}`,
  ];

  if (digest !== undefined) {
    headers.push("digest");
    lines.push(`digest: ${digest}`);
  }

  return { signingString: lines.join("\n"), headers };
}

export function signRequest(opts: SignRequestOptions): SignedHeaders {
  const url = new URL(opts.url);
  const date = opts.date ?? new Date().toUTCString();
  const digest = opts.body !== undefined ? buildDigest(opts.body) : undefined;

  const { signingString, headers } = buildSigningString(
    opts.method,
    url.pathname + url.search,
    url.host,
    date,
    digest,
  );

  const privateKey = crypto.createPrivateKey(opts.privateKeyPem);
  const sig = crypto
    .createSign("RSA-SHA256")
    .update(signingString)
    .sign(privateKey, "base64");

  const sigHeader = [
    `keyId="${opts.keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headers.join(" ")}"`,
    `signature="${sig}"`,
  ].join(",");

  const result: SignedHeaders = { Date: date, Signature: sigHeader };
  if (digest !== undefined) result.Digest = digest;
  return result;
}

export function parseSignatureHeader(header: string): SignatureComponents {
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, "");
    parts[key] = val;
  }

  return {
    keyId: parts.keyId ?? "",
    algorithm: parts.algorithm ?? "rsa-sha256",
    headers: (parts.headers ?? "date").split(" "),
    signature: parts.signature ?? "",
  };
}

export function verifySignature(opts: {
  publicKeyPem: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  sigComponents: SignatureComponents;
}): boolean {
  const url = new URL(opts.url);

  const lines: string[] = [];
  for (const name of opts.sigComponents.headers) {
    if (name === "(request-target)") {
      lines.push(
        `(request-target): ${opts.method.toLowerCase()} ${url.pathname}${url.search}`,
      );
    } else {
      const val = opts.headers[name] ?? opts.headers[name.toLowerCase()];
      if (val === undefined) return false;
      lines.push(`${name}: ${Array.isArray(val) ? val.join(", ") : val}`);
    }
  }

  const signingString = lines.join("\n");

  try {
    const publicKey = crypto.createPublicKey(opts.publicKeyPem);
    return crypto
      .createVerify("RSA-SHA256")
      .update(signingString)
      .verify(publicKey, opts.sigComponents.signature, "base64");
  } catch {
    return false;
  }
}

export function verifyBodyDigest(body: string, digestHeader: string): boolean {
  const eq = digestHeader.indexOf("=");
  if (eq === -1) return false;
  const algo = digestHeader.slice(0, eq);
  const expected = digestHeader.slice(eq + 1);
  if (algo.toUpperCase() !== "SHA-256") return false;
  const actual = createHash("sha256").update(body, "utf8").digest("base64");
  return actual === expected;
}
