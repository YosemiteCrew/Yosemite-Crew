import crypto from "crypto";
import { signRequest } from "src/utils/http-signature";

const fetchRemoteActor = jest.fn();
const getActorByOrgId = jest.fn();
const getOrCreateActor = jest.fn();
const isLicenseTokenValid = jest.fn();

jest.mock("src/services/activitypub.service", () => ({
  fetchRemoteActor: (uri: string) => fetchRemoteActor(uri),
  getActorByOrgId: (orgId: string) => getActorByOrgId(orgId),
  getOrCreateActor: (orgId: string) => getOrCreateActor(orgId),
}));
jest.mock("src/services/ap-license.service", () => ({
  isLicenseTokenValid: (token: unknown, uri: string) =>
    isLicenseTokenValid(token, uri),
}));
jest.mock("src/queues/ap-delivery.queue", () => ({
  ApDeliveryQueue: { add: jest.fn() },
}));

const prismaMock = {
  aPActivity: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  aPFollower: {
    upsert: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  aPFollowing: {
    updateMany: jest.fn(),
  },
  aPReferral: {
    upsert: jest.fn(),
  },
};

jest.mock("@yosemite-crew/database", () => ({
  prisma: prismaMock,
  Prisma: {},
}));

jest.mock("src/utils/activitypub-builder", () => ({
  buildAcceptActivity: jest.fn(() => ({ type: "Accept" })),
  buildFollowActivity: jest.fn(() => ({ type: "Follow" })),
  generateActivityId: jest.fn(() => "urn:generated:id"),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  verifyInboundRequest,
  dispatchInboundActivity,
} from "src/services/ap-inbox.service";
import { ApDeliveryQueue } from "src/queues/ap-delivery.queue";

const ApDeliveryQueueAdd = ApDeliveryQueue.add as jest.Mock;

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

  it("rejects when fetching the remote actor throws (network error)", async () => {
    fetchRemoteActor.mockRejectedValue(new Error("actor unreachable"));
    const result = await verifyInboundRequest({
      method: "POST",
      url: URL,
      headers: signedHeaders(keys.privateKey),
      body: BODY,
    });
    expect(result).toEqual({ ok: false });
  });
});

const ORG_ID = "org-local";
const LOCAL_ACTOR = {
  id: "local-actor-1",
  uri: "https://local.example/ap/organizations/org-local",
};

function resetAll() {
  jest.clearAllMocks();
  getOrCreateActor.mockResolvedValue(LOCAL_ACTOR);
  getActorByOrgId.mockResolvedValue(LOCAL_ACTOR);
  prismaMock.aPActivity.findUnique.mockResolvedValue(null);
  prismaMock.aPActivity.create.mockResolvedValue({});
  prismaMock.aPActivity.update.mockResolvedValue({});
  prismaMock.aPFollower.upsert.mockResolvedValue({});
  prismaMock.aPFollower.update.mockResolvedValue({});
  prismaMock.aPFollower.deleteMany.mockResolvedValue({});
  prismaMock.aPFollowing.updateMany.mockResolvedValue({});
  prismaMock.aPReferral.upsert.mockResolvedValue({});
  fetchRemoteActor.mockResolvedValue({
    uri: "https://remote.example/actor",
    inboxUri: "https://remote.example/inbox",
    sharedInboxUri: "https://remote.example/shared-inbox",
    licenseToken: "tok",
  });
  isLicenseTokenValid.mockResolvedValue(true);
}

describe("dispatchInboundActivity", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.AP_AUTO_APPROVE_FOLLOWS;
  });

  it("drops an activity without an id (no row created, no handler run)", async () => {
    await dispatchInboundActivity(ORG_ID, {
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.aPActivity.create).not.toHaveBeenCalled();
    expect(prismaMock.aPActivity.update).not.toHaveBeenCalled();
    expect(prismaMock.aPFollower.upsert).not.toHaveBeenCalled();
  });

  it("drops an activity with an empty-string id", async () => {
    await dispatchInboundActivity(ORG_ID, {
      id: "",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.create).not.toHaveBeenCalled();
  });

  it("skips (idempotent) when the activity is already processed", async () => {
    prismaMock.aPActivity.findUnique.mockResolvedValue({ processed: true });
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:1",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.create).not.toHaveBeenCalled();
    expect(prismaMock.aPActivity.update).not.toHaveBeenCalled();
    expect(prismaMock.aPFollower.upsert).not.toHaveBeenCalled();
  });

  it("creates the row, runs the handler, and marks processed on first sight", async () => {
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:2",
      type: "Follow",
      actor: "https://remote.example/actor",
      object: { type: "Note" },
      to: ["a"],
      cc: "b",
    });
    expect(prismaMock.aPActivity.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.aPActivity.create.mock.calls[0][0];
    expect(createArg.data.uri).toBe("urn:a:2");
    expect(createArg.data.toAddresses).toEqual(["a"]);
    expect(createArg.data.ccAddresses).toEqual(["b"]);
    expect(prismaMock.aPFollower.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.aPActivity.update).toHaveBeenCalledWith({
      where: { uri: "urn:a:2" },
      data: { processed: true },
    });
  });

  it("stores a string object as objectUri", async () => {
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:str",
      type: "Announce",
      actor: "https://remote.example/actor",
      object: "https://remote.example/note/1",
    });
    const createArg = prismaMock.aPActivity.create.mock.calls[0][0];
    expect(createArg.data.objectUri).toBe("https://remote.example/note/1");
    expect(createArg.data.objectJson).toBeUndefined();
  });

  it("retries (does not re-create) when an unprocessed row already exists", async () => {
    prismaMock.aPActivity.findUnique.mockResolvedValue({ processed: false });
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:3",
      type: "Announce",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.create).not.toHaveBeenCalled();
    expect(prismaMock.aPActivity.update).toHaveBeenCalledWith({
      where: { uri: "urn:a:3" },
      data: { processed: true },
    });
  });

  it("swallows a P2002 race on create and still marks processed", async () => {
    prismaMock.aPActivity.create.mockRejectedValue({ code: "P2002" });
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:4",
      type: "Announce",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });

  it("rethrows a non-P2002 create error", async () => {
    prismaMock.aPActivity.create.mockRejectedValue({ code: "P2003" });
    await expect(
      dispatchInboundActivity(ORG_ID, {
        id: "urn:a:5",
        type: "Announce",
        actor: "https://remote.example/actor",
      }),
    ).rejects.toEqual({ code: "P2003" });
    expect(prismaMock.aPActivity.update).not.toHaveBeenCalled();
  });

  it("routes an unknown activity type through the default branch", async () => {
    await dispatchInboundActivity(ORG_ID, {
      id: "urn:a:6",
      type: "Like",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });
});

async function dispatch(activity: {
  id: string;
  type: string;
  actor: string;
  object?: unknown;
}) {
  await dispatchInboundActivity(ORG_ID, activity);
}

describe("handleFollow", () => {
  beforeEach(() => {
    resetAll();
    delete process.env.AP_AUTO_APPROVE_FOLLOWS;
  });

  it("upserts a PENDING follower for a verified license (auto-approve off)", async () => {
    isLicenseTokenValid.mockResolvedValue(true);
    await dispatch({
      id: "urn:f:1",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollower.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.aPFollower.update).not.toHaveBeenCalled();
    expect(ApDeliveryQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects a Follow from an unverified instance (no upsert)", async () => {
    isLicenseTokenValid.mockResolvedValue(false);
    await dispatch({
      id: "urn:f:2",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollower.upsert).not.toHaveBeenCalled();
  });

  it("auto-approves and enqueues an Accept when AP_AUTO_APPROVE_FOLLOWS=true", async () => {
    process.env.AP_AUTO_APPROVE_FOLLOWS = "true";
    isLicenseTokenValid.mockResolvedValue(true);
    await dispatch({
      id: "urn:f:3",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollower.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.aPFollower.update.mock.calls[0][0].data.state).toBe(
      "APPROVED",
    );
    expect(ApDeliveryQueueAdd).toHaveBeenCalledTimes(1);
    expect(ApDeliveryQueueAdd.mock.calls[0][1].inboxUri).toBe(
      "https://remote.example/shared-inbox",
    );
  });

  it("falls back to the direct inbox when there is no shared inbox", async () => {
    process.env.AP_AUTO_APPROVE_FOLLOWS = "true";
    fetchRemoteActor.mockResolvedValue({
      uri: "https://remote.example/actor",
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
      licenseToken: "tok",
    });
    isLicenseTokenValid.mockResolvedValue(true);
    await dispatch({
      id: "urn:f:4",
      type: "Follow",
      actor: "https://remote.example/actor",
    });
    expect(ApDeliveryQueueAdd.mock.calls[0][1].inboxUri).toBe(
      "https://remote.example/inbox",
    );
  });

  it("swallows errors thrown while handling a Follow", async () => {
    fetchRemoteActor.mockRejectedValue(new Error("network down"));
    await expect(
      dispatch({
        id: "urn:f:5",
        type: "Follow",
        actor: "https://remote.example/actor",
      }),
    ).resolves.toBeUndefined();
    expect(prismaMock.aPFollower.upsert).not.toHaveBeenCalled();
    // handler swallowed the error, so the activity is still marked processed
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });
});

describe("handleAccept / handleReject", () => {
  beforeEach(resetAll);

  it("flips following state to ACCEPTED keyed on activity.actor", async () => {
    await dispatch({
      id: "urn:ac:1",
      type: "Accept",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollowing.updateMany).toHaveBeenCalledWith({
      where: {
        localActorId: LOCAL_ACTOR.id,
        remoteActorUri: "https://remote.example/actor",
      },
      data: { state: "ACCEPTED" },
    });
  });

  it("Accept is a no-op when the local actor is unknown", async () => {
    getActorByOrgId.mockResolvedValue(null);
    await dispatch({
      id: "urn:ac:2",
      type: "Accept",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollowing.updateMany).not.toHaveBeenCalled();
  });

  it("flips following state to REJECTED keyed on activity.actor", async () => {
    await dispatch({
      id: "urn:rj:1",
      type: "Reject",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollowing.updateMany).toHaveBeenCalledWith({
      where: {
        localActorId: LOCAL_ACTOR.id,
        remoteActorUri: "https://remote.example/actor",
      },
      data: { state: "REJECTED" },
    });
  });

  it("Reject is a no-op when the local actor is unknown", async () => {
    getActorByOrgId.mockResolvedValue(null);
    await dispatch({
      id: "urn:rj:2",
      type: "Reject",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollowing.updateMany).not.toHaveBeenCalled();
  });
});

describe("handleUndo", () => {
  beforeEach(resetAll);

  it("deletes the follower when undoing a Follow", async () => {
    await dispatch({
      id: "urn:u:1",
      type: "Undo",
      actor: "https://remote.example/actor",
      object: { type: "Follow" },
    });
    expect(prismaMock.aPFollower.deleteMany).toHaveBeenCalledWith({
      where: {
        localActorId: LOCAL_ACTOR.id,
        remoteActorUri: "https://remote.example/actor",
      },
    });
  });

  it("does nothing when the inner object is not a Follow", async () => {
    await dispatch({
      id: "urn:u:2",
      type: "Undo",
      actor: "https://remote.example/actor",
      object: { type: "Like" },
    });
    expect(prismaMock.aPFollower.deleteMany).not.toHaveBeenCalled();
  });

  it("does nothing when there is no inner object", async () => {
    await dispatch({
      id: "urn:u:3",
      type: "Undo",
      actor: "https://remote.example/actor",
    });
    expect(prismaMock.aPFollower.deleteMany).not.toHaveBeenCalled();
  });
});

describe("handleOffer", () => {
  beforeEach(resetAll);

  it("creates a referral for a yc:VetReferral offer", async () => {
    await dispatch({
      id: "urn:o:1",
      type: "Offer",
      actor: "https://remote.example/actor",
      object: {
        type: "yc:VetReferral",
        "yc:urgency": "URGENT",
        "yc:patientSummary": { name: "Rex" },
        "yc:clinicalContext": "limping",
      },
    });
    expect(prismaMock.aPReferral.upsert).toHaveBeenCalledTimes(1);
    const arg = prismaMock.aPReferral.upsert.mock.calls[0][0];
    expect(arg.where.activityUri).toBe("urn:o:1");
    expect(arg.create.urgency).toBe("URGENT");
    expect(arg.create.patientSummary).toEqual({ name: "Rex" });
    expect(arg.create.clinicalContext).toBe("limping");
    expect(arg.create.state).toBe("PENDING");
  });

  it("defaults urgency and patientSummary when omitted", async () => {
    await dispatch({
      id: "urn:o:2",
      type: "Offer",
      actor: "https://remote.example/actor",
      object: { type: "yc:VetReferral" },
    });
    const arg = prismaMock.aPReferral.upsert.mock.calls[0][0];
    expect(arg.create.urgency).toBe("ROUTINE");
    expect(arg.create.patientSummary).toEqual({});
  });

  it("ignores an Offer whose object is not a yc:VetReferral", async () => {
    await dispatch({
      id: "urn:o:3",
      type: "Offer",
      actor: "https://remote.example/actor",
      object: { type: "Note" },
    });
    expect(prismaMock.aPReferral.upsert).not.toHaveBeenCalled();
  });
});

describe("handleCreate / handleAnnounce", () => {
  beforeEach(resetAll);

  it("processes a Create Note (no throw, marks processed)", async () => {
    await dispatch({
      id: "urn:c:1",
      type: "Create",
      actor: "https://remote.example/actor",
      object: { type: "Note", content: "hello" },
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });

  it("ignores a Create whose object is not a Note", async () => {
    await dispatch({
      id: "urn:c:2",
      type: "Create",
      actor: "https://remote.example/actor",
      object: { type: "Article", content: "hi" },
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });

  it("ignores a Create Note with no content", async () => {
    await dispatch({
      id: "urn:c:3",
      type: "Create",
      actor: "https://remote.example/actor",
      object: { type: "Note" },
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });

  it("processes an Announce (no throw, marks processed)", async () => {
    await dispatch({
      id: "urn:an:1",
      type: "Announce",
      actor: "https://remote.example/actor",
      object: "https://remote.example/note/1",
    });
    expect(prismaMock.aPActivity.update).toHaveBeenCalledTimes(1);
  });
});
