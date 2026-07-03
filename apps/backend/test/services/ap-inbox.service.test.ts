import crypto from "crypto";
import { signRequest } from "src/utils/http-signature";

const fetchRemoteActor = jest.fn();

jest.mock("src/services/activitypub.service", () => ({
  fetchRemoteActor: (uri: string) => fetchRemoteActor(uri),
  getActorByOrgId: jest.fn(),
  getOrCreateActor: jest.fn(),
}));
jest.mock("src/services/ap-license.service", () => ({
  isLicenseTokenValid: jest.fn(),
}));
jest.mock("src/queues/ap-delivery.queue", () => ({
  ApDeliveryQueue: { add: jest.fn() },
}));
jest.mock("@yosemite-crew/database", () => ({
  prisma: {},
  Prisma: {},
}));

import { verifyInboundRequest } from "src/services/ap-inbox.service";

const KEY_ID = "https://remote.example/ap/organizations/org-1#main-key";
const ACTOR_URI = "https://remote.example/ap/organizations/org-1";
const URL = "https://local.example/ap/organizations/local/inbox";
const BODY = JSON.stringify({ type: "Follow", actor: ACTOR_URI });

function makeKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

function signedHeaders(privateKeyPem: string) {
  const signed = signRequest({
    privateKeyPem,
    keyId: KEY_ID,
    method: "POST",
    url: URL,
    body: BODY,
  });
  const url = new global.URL(URL);
  return {
    signature: signed.Signature,
    digest: signed.Digest as string,
    date: signed.Date,
    host: url.host,
  };
}

describe("verifyInboundRequest", () => {
  let keys: { publicKey: string; privateKey: string };

  beforeEach(() => {
    keys = makeKeys();
    fetchRemoteActor.mockReset();
    fetchRemoteActor.mockResolvedValue({
      uri: ACTOR_URI,
      publicKeyPem: keys.publicKey,
      publicKeyId: KEY_ID,
    });
  });

  it("returns { ok: true, signerUri } on a valid signed request", async () => {
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: signedHeaders(keys.privateKey),
      body: BODY,
    });
    expect(result).toEqual({ ok: true, signerUri: ACTOR_URI });
  });

  it("rejects when the Digest header is missing", async () => {
    const h = signedHeaders(keys.privateKey);
    delete (h as Record<string, string>).digest;
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: h,
      body: BODY,
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects when the body does not match the Digest", async () => {
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: signedHeaders(keys.privateKey),
      body: BODY + "tampered",
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects a stale Date outside the replay window", async () => {
    const h = signedHeaders(keys.privateKey);
    h.date = new Date(Date.now() - 10 * 60 * 1000).toUTCString();
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: h,
      body: BODY,
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects when keyId is not the actor's advertised key (impersonation)", async () => {
    fetchRemoteActor.mockResolvedValue({
      uri: ACTOR_URI,
      publicKeyPem: keys.publicKey,
      publicKeyId: "https://remote.example/ap/organizations/org-1#other-key",
    });
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: signedHeaders(keys.privateKey),
      body: BODY,
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects when the signature is missing", async () => {
    const h = signedHeaders(keys.privateKey);
    delete (h as Record<string, string>).signature;
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: h,
      body: BODY,
    });
    expect(result).toEqual({ ok: false });
  });
});
