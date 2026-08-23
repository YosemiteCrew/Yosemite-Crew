import crypto, { createHash } from "node:crypto";
import {
  signRequest,
  parseSignatureHeader,
  verifySignature,
  verifyBodyDigest,
} from "src/utils/http-signature";

const KEY_ID = "https://remote.example/ap/organizations/org-1#main-key";
const URL = "https://local.example/ap/organizations/local/inbox?x=1";
const BODY = JSON.stringify({ type: "Follow", actor: "https://a.example" });
const FIXED_DATE = "Wed, 02 Jul 2026 00:00:00 GMT";

function makeKeys() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

describe("http-signature", () => {
  let keys: { publicKey: string; privateKey: string };

  beforeEach(() => {
    keys = makeKeys();
  });

  describe("signRequest", () => {
    it("produces a Signature header with a digest when a body is given", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "POST",
        url: URL,
        body: BODY,
        date: FIXED_DATE,
      });

      expect(signed.Date).toBe(FIXED_DATE);
      expect(signed.Digest).toBe(
        `SHA-256=${createHash("sha256").update(BODY, "utf8").digest("base64")}`,
      );
      expect(signed.Signature).toContain(`keyId="${KEY_ID}"`);
      expect(signed.Signature).toContain('algorithm="rsa-sha256"');
      expect(signed.Signature).toContain(
        'headers="(request-target) host date digest"',
      );
      expect(signed.Signature).toMatch(/signature="[^"]+"/);
    });

    it("omits the digest header when no body is given", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "GET",
        url: URL,
        date: FIXED_DATE,
      });
      expect(signed.Digest).toBeUndefined();
      expect(signed.Signature).toContain(
        'headers="(request-target) host date"',
      );
    });

    it("defaults the date when none is provided", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "GET",
        url: URL,
      });
      expect(typeof signed.Date).toBe("string");
      expect(new Date(signed.Date).toString()).not.toBe("Invalid Date");
    });
  });

  describe("parseSignatureHeader", () => {
    it("parses keyId, algorithm, headers and signature", () => {
      const header = [
        `keyId="${KEY_ID}"`,
        `algorithm="rsa-sha256"`,
        `headers="(request-target) host date digest"`,
        `signature="AbC123=="`,
      ].join(",");

      const parsed = parseSignatureHeader(header);
      expect(parsed.keyId).toBe(KEY_ID);
      expect(parsed.algorithm).toBe("rsa-sha256");
      expect(parsed.headers).toEqual([
        "(request-target)",
        "host",
        "date",
        "digest",
      ]);
      expect(parsed.signature).toBe("AbC123==");
    });

    it("skips malformed parts without an equals sign", () => {
      const header = `garbage,keyId="k1",signature="s1"`;
      const parsed = parseSignatureHeader(header);
      expect(parsed.keyId).toBe("k1");
      expect(parsed.signature).toBe("s1");
    });

    it("applies defaults when fields are missing", () => {
      const parsed = parseSignatureHeader(`signature="only"`);
      expect(parsed.keyId).toBe("");
      expect(parsed.algorithm).toBe("rsa-sha256");
      expect(parsed.headers).toEqual(["date"]);
      expect(parsed.signature).toBe("only");
    });

    it("defaults the signature to empty when absent", () => {
      const parsed = parseSignatureHeader(`keyId="k1"`);
      expect(parsed.signature).toBe("");
    });
  });

  describe("verifySignature", () => {
    it("round-trips a signed request", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "POST",
        url: URL,
        body: BODY,
        date: FIXED_DATE,
      });
      const parsed = parseSignatureHeader(signed.Signature);
      const url = new global.URL(URL);

      const ok = verifySignature({
        publicKeyPem: keys.publicKey,
        method: "POST",
        url: URL,
        headers: {
          host: url.host,
          date: signed.Date,
          digest: signed.Digest,
        },
        sigComponents: parsed,
      });
      expect(ok).toBe(true);
    });

    it("fails verification with the wrong public key", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "POST",
        url: URL,
        body: BODY,
        date: FIXED_DATE,
      });
      const parsed = parseSignatureHeader(signed.Signature);
      const url = new global.URL(URL);
      const other = makeKeys();

      const ok = verifySignature({
        publicKeyPem: other.publicKey,
        method: "POST",
        url: URL,
        headers: { host: url.host, date: signed.Date, digest: signed.Digest },
        sigComponents: parsed,
      });
      expect(ok).toBe(false);
    });

    it("returns false when a signed header is missing from the request", () => {
      const signed = signRequest({
        privateKeyPem: keys.privateKey,
        keyId: KEY_ID,
        method: "POST",
        url: URL,
        body: BODY,
        date: FIXED_DATE,
      });
      const parsed = parseSignatureHeader(signed.Signature);
      const url = new global.URL(URL);

      const ok = verifySignature({
        publicKeyPem: keys.publicKey,
        method: "POST",
        url: URL,
        // digest deliberately omitted although it was signed
        headers: { host: url.host, date: signed.Date },
        sigComponents: parsed,
      });
      expect(ok).toBe(false);
    });

    it("resolves lowercased header names and joins array values", () => {
      const url = new global.URL(URL);
      const date = FIXED_DATE;
      // Signed header names are capitalized ("Host"/"Date"); verify looks them
      // up first as-is, then lowercased. The request supplies lowercase keys and
      // an array value, exercising both the lowercase-fallback and array-join
      // branches. The signing string uses the header names verbatim.
      const signingString = [
        `(request-target): post ${url.pathname}${url.search}`,
        `Host: ${url.host}`,
        `Date: ${date}`,
      ].join("\n");
      const signature = crypto
        .createSign("RSA-SHA256")
        .update(signingString)
        .sign(crypto.createPrivateKey(keys.privateKey), "base64");

      const ok = verifySignature({
        publicKeyPem: keys.publicKey,
        method: "POST",
        url: URL,
        headers: {
          host: [url.host],
          date,
        },
        sigComponents: {
          keyId: KEY_ID,
          algorithm: "rsa-sha256",
          headers: ["(request-target)", "Host", "Date"],
          signature,
        },
      });
      expect(ok).toBe(true);
    });

    it("returns false on an invalid public key PEM", () => {
      const ok = verifySignature({
        publicKeyPem: "not-a-real-pem",
        method: "GET",
        url: URL,
        headers: { host: "local.example", date: FIXED_DATE },
        sigComponents: {
          keyId: KEY_ID,
          algorithm: "rsa-sha256",
          headers: ["date"],
          signature: "AAAA",
        },
      });
      expect(ok).toBe(false);
    });
  });

  describe("verifyBodyDigest", () => {
    it("accepts a correct SHA-256 base64 digest", () => {
      const digest = `SHA-256=${createHash("sha256")
        .update(BODY, "utf8")
        .digest("base64")}`;
      expect(verifyBodyDigest(BODY, digest)).toBe(true);
    });

    it("rejects a wrong digest value", () => {
      expect(verifyBodyDigest(BODY, "SHA-256=wrongvalue")).toBe(false);
    });

    it("rejects a digest with no equals sign", () => {
      expect(verifyBodyDigest(BODY, "SHA-256")).toBe(false);
    });

    it("rejects a non-SHA-256 algorithm", () => {
      const md5ish = createHash("sha256").update(BODY, "utf8").digest("base64");
      expect(verifyBodyDigest(BODY, `SHA-512=${md5ish}`)).toBe(false);
    });
  });
});
