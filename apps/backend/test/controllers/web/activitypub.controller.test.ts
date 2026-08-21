import type { Request, Response } from "express";

// ─── Service-layer mocks ──────────────────────────────────────────────────────
const svc = {
  buildActorResponse: jest.fn(),
  resolveWebFinger: jest.fn(),
  getFollowersCollection: jest.fn(),
  getFollowingCollection: jest.fn(),
  getOutboxCollection: jest.fn(),
  sendFollow: jest.fn(),
  sendUnfollow: jest.fn(),
  approveFollower: jest.fn(),
  rejectFollower: jest.fn(),
  sendReferral: jest.fn(),
  sendNote: jest.fn(),
  announceEmergency: jest.fn(),
  listInboundReferrals: jest.fn(),
  listOutboundReferrals: jest.fn(),
  listFollowers: jest.fn(),
  listFollowing: jest.fn(),
  getOrCreateActor: jest.fn(),
  updateLicenseToken: jest.fn(),
  getLicenseTokenStatus: jest.fn(),
  respondToReferral: jest.fn(),
  updateActorProfile: jest.fn(),
  getActorSettingsData: jest.fn(),
  listFollowerOrgIdsFor: jest.fn(),
  setDirectoryListing: jest.fn(),
  listDirectory: jest.fn(),
};

jest.mock("src/services/activitypub.service", () => svc);

const inboxAdd = jest.fn();
jest.mock("src/queues/ap-inbox.queue", () => ({
  ApInboxQueue: { add: (...a: unknown[]) => inboxAdd(...a) },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock("@yosemite-crew/database", () => ({ prisma: {}, Prisma: {} }));

import {
  ActivityPubController,
  WellKnownController,
} from "src/controllers/web/activitypub.controller";

// ─── Fake req/res helpers ───────────────────────────────────────────────────
function makeRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
    sent?: string;
    ended?: boolean;
  } = { headers: {} };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response["status"];
  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res as Response;
  }) as unknown as Response["json"];
  res.set = jest.fn((k: string | Record<string, string>, v?: string) => {
    if (typeof k === "string") res.headers[k] = v ?? "";
    else Object.assign(res.headers, k);
    return res as Response;
  }) as unknown as Response["set"];
  res.send = jest.fn((payload: unknown) => {
    res.sent = payload as string;
    return res as Response;
  }) as unknown as Response["send"];
  res.end = jest.fn(() => {
    res.ended = true;
    return res as Response;
  }) as unknown as Response["end"];
  return res as Response & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
    sent?: string;
    ended?: boolean;
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    method: "GET",
    originalUrl: "/ap/x",
    ...overrides,
  } as unknown as Request;
}

function withOrg(overrides: Partial<Request> = {}): Request {
  const req = makeReq(overrides);
  (req as unknown as { organisationId: string }).organisationId = "org-1";
  return req;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AP_BASE_URL = "https://local.example";
});

// ─── WellKnownController ──────────────────────────────────────────────────────
describe("WellKnownController.webfinger", () => {
  it("400 when resource param missing", async () => {
    const res = makeRes();
    await WellKnownController.webfinger(makeReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "resource param required" });
  });

  it("404 when actor not resolvable", async () => {
    svc.resolveWebFinger.mockResolvedValue(null);
    const res = makeRes();
    await WellKnownController.webfinger(
      makeReq({ query: { resource: "acct:x@local" } }),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Actor not found" });
  });

  it("200 with jrd+json when resolved", async () => {
    svc.resolveWebFinger.mockResolvedValue({ subject: "acct:x@local" });
    const res = makeRes();
    await WellKnownController.webfinger(
      makeReq({ query: { resource: "acct:x@local" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/jrd+json");
    expect(res.body).toEqual({ subject: "acct:x@local" });
    expect(svc.resolveWebFinger).toHaveBeenCalledWith("acct:x@local");
  });
});

describe("WellKnownController.hostMeta", () => {
  it("emits XRD xml with the base url template", () => {
    const res = makeRes();
    WellKnownController.hostMeta(makeReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/xrd+xml");
    expect(res.sent).toContain(
      "https://local.example/.well-known/webfinger?resource={uri}",
    );
  });

  it("tolerates a missing AP_BASE_URL (empty base)", () => {
    delete process.env.AP_BASE_URL;
    const res = makeRes();
    WellKnownController.hostMeta(makeReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.sent).toContain('template="/.well-known/webfinger');
  });
});

// ─── ActivityPubController: actor & collections ───────────────────────────────
describe("ActivityPubController.getActor", () => {
  it("200 with the actor document and AP content-type", async () => {
    svc.buildActorResponse.mockResolvedValue({ id: "actor" });
    const res = makeRes();
    await ActivityPubController.getActor(
      makeReq({ params: { orgId: "org-1" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/activity+json");
    expect(res.body).toEqual({ id: "actor" });
  });

  it("404 when the service throws", async () => {
    svc.buildActorResponse.mockRejectedValue(new Error("nope"));
    const res = makeRes();
    await ActivityPubController.getActor(
      makeReq({ params: { orgId: "org-1" } }),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Actor not found" });
  });
});

describe("ActivityPubController collections", () => {
  it("getOutbox returns the collection", async () => {
    svc.getOutboxCollection.mockResolvedValue({ type: "OrderedCollection" });
    const res = makeRes();
    await ActivityPubController.getOutbox(
      makeReq({ params: { orgId: "org-1" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/activity+json");
    expect(res.body).toEqual({ type: "OrderedCollection" });
  });

  it("getFollowers returns the collection", async () => {
    svc.getFollowersCollection.mockResolvedValue({ totalItems: 3 });
    const res = makeRes();
    await ActivityPubController.getFollowers(
      makeReq({ params: { orgId: "org-1" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ totalItems: 3 });
  });

  it("getFollowing returns the collection", async () => {
    svc.getFollowingCollection.mockResolvedValue({ totalItems: 1 });
    const res = makeRes();
    await ActivityPubController.getFollowing(
      makeReq({ params: { orgId: "org-1" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ totalItems: 1 });
  });
});

// ─── Inbox ────────────────────────────────────────────────────────────────────
describe("ActivityPubController.postInbox", () => {
  it("202 and queues the job for a valid JSON body (Buffer)", async () => {
    inboxAdd.mockResolvedValue({ id: "job1" });
    const res = makeRes();
    const req = makeReq({
      params: { orgId: "org-1" },
      method: "POST",
      originalUrl: "/ap/organizations/org-1/inbox",
      body: Buffer.from(JSON.stringify({ type: "Follow" })),
    });
    await ActivityPubController.postInbox(req, res);
    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
    expect(inboxAdd).toHaveBeenCalledWith(
      "process",
      expect.objectContaining({
        targetOrgId: "org-1",
        requestUrl: "https://local.example/ap/organizations/org-1/inbox",
        requestMethod: "POST",
      }),
    );
  });

  it("accepts a plain string body", async () => {
    inboxAdd.mockResolvedValue({ id: "job1" });
    const res = makeRes();
    await ActivityPubController.postInbox(
      makeReq({
        params: { orgId: "org-2" },
        method: "POST",
        body: '{"type":"Create"}',
      }),
      res,
    );
    expect(res.statusCode).toBe(202);
  });

  it("accepts an object body (serialized)", async () => {
    inboxAdd.mockResolvedValue({ id: "job1" });
    const res = makeRes();
    await ActivityPubController.postInbox(
      makeReq({ params: { orgId: "o" }, method: "POST", body: { type: "X" } }),
      res,
    );
    expect(res.statusCode).toBe(202);
  });

  it("400 on invalid JSON body", async () => {
    const res = makeRes();
    await ActivityPubController.postInbox(
      makeReq({
        params: { orgId: "org-1" },
        method: "POST",
        body: "not json{",
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body" });
    expect(inboxAdd).not.toHaveBeenCalled();
  });

  it("uses an empty base when AP_BASE_URL is unset", async () => {
    delete process.env.AP_BASE_URL;
    inboxAdd.mockResolvedValue({ id: "job1" });
    const res = makeRes();
    await ActivityPubController.postInbox(
      makeReq({
        params: { orgId: "org-1" },
        method: "POST",
        originalUrl: "/ap/organizations/org-1/inbox",
        body: '{"type":"Follow"}',
      }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(inboxAdd).toHaveBeenCalledWith(
      "process",
      expect.objectContaining({
        requestUrl: "/ap/organizations/org-1/inbox",
      }),
    );
  });

  it("500 when the queue add rejects", async () => {
    inboxAdd.mockRejectedValue(new Error("redis down"));
    const res = makeRes();
    await ActivityPubController.postInbox(
      makeReq({
        params: { orgId: "org-1" },
        method: "POST",
        body: '{"type":"Follow"}',
      }),
      res,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
  });
});

describe("ActivityPubController.postSharedInbox", () => {
  it("202 and fans out to org ids parsed from to/object.to", async () => {
    inboxAdd.mockResolvedValue({ id: "j" });
    const res = makeRes();
    const body = JSON.stringify({
      to: ["https://local.example/ap/organizations/org-a"],
      object: {
        to: [
          "https://local.example/ap/organizations/org-b",
          "https://other.example/users/mastodon",
        ],
      },
    });
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body, originalUrl: "/ap/shared-inbox" }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
    // org-a and org-b are recognised; the mastodon URL is filtered out
    expect(inboxAdd).toHaveBeenCalledTimes(2);
    const targets = inboxAdd.mock.calls.map(
      (c) => (c[1] as { targetOrgId: string }).targetOrgId,
    );
    expect(targets).toEqual(expect.arrayContaining(["org-a", "org-b"]));
  });

  it("resolves recipients from the follow graph for a public broadcast", async () => {
    // Emergency announcements are addressed to Public with the SENDER's
    // followers collection in cc, so nothing in the addressing names a local
    // organisation. Before this the shared inbox queued nothing and returned
    // 202, and approved followers on a shared inbox never got the broadcast.
    inboxAdd.mockResolvedValue({ id: "j" });
    svc.listFollowerOrgIdsFor.mockResolvedValue(["org-follower"]);
    const res = makeRes();
    const body = JSON.stringify({
      actor: "https://remote.example/ap/organizations/org-sender",
      type: "Announce",
      to: ["https://www.w3.org/ns/activitystreams#Public"],
      cc: ["https://remote.example/ap/organizations/org-sender/followers"],
    });

    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body, originalUrl: "/ap/shared-inbox" }),
      res,
    );

    expect(svc.listFollowerOrgIdsFor).toHaveBeenCalledWith(
      "https://remote.example/ap/organizations/org-sender",
    );
    expect(inboxAdd).toHaveBeenCalledTimes(1);
    expect(
      (inboxAdd.mock.calls[0][1] as { targetOrgId: string }).targetOrgId,
    ).toBe("org-follower");
  });

  it("prefers explicit addressing over the follow graph", async () => {
    inboxAdd.mockResolvedValue({ id: "j" });
    svc.listFollowerOrgIdsFor.mockResolvedValue(["org-follower"]);
    const res = makeRes();
    const body = JSON.stringify({
      actor: "https://remote.example/ap/organizations/org-sender",
      to: ["https://local.example/ap/organizations/org-addressed"],
    });

    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body, originalUrl: "/ap/shared-inbox" }),
      res,
    );

    expect(svc.listFollowerOrgIdsFor).not.toHaveBeenCalled();
    expect(
      (inboxAdd.mock.calls[0][1] as { targetOrgId: string }).targetOrgId,
    ).toBe("org-addressed");
  });

  it("collects array-valued and empty-array headers (first element / fallback)", async () => {
    inboxAdd.mockResolvedValue({ id: "j" });
    const res = makeRes();
    const req = makeReq({
      method: "POST",
      body: JSON.stringify({
        to: "https://local.example/ap/organizations/org-d",
      }),
    });
    (req as unknown as { headers: Record<string, unknown> }).headers = {
      "content-type": "application/activity+json",
      forwarded: ["a.example", "b.example"],
      "x-empty": [],
      "x-number": 42,
    };
    await ActivityPubController.postSharedInbox(req, res);
    expect(res.statusCode).toBe(202);
    const queuedHeaders = (
      inboxAdd.mock.calls[0][1] as { headers: Record<string, string> }
    ).headers;
    expect(queuedHeaders.forwarded).toBe("a.example");
    expect(queuedHeaders["x-empty"]).toBe("");
    expect(queuedHeaders["x-number"]).toBeUndefined();
  });

  it("handles scalar (non-array) to fields", async () => {
    inboxAdd.mockResolvedValue({ id: "j" });
    const res = makeRes();
    const body = JSON.stringify({
      to: "https://local.example/ap/organizations/org-c",
    });
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(inboxAdd).toHaveBeenCalledTimes(1);
  });

  it("202 with no queue adds when no addressable org uris", async () => {
    const res = makeRes();
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body: JSON.stringify({ to: [] }) }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(inboxAdd).not.toHaveBeenCalled();
  });

  it("202 when both to and object.to are absent (nullish fallbacks)", async () => {
    const res = makeRes();
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body: JSON.stringify({ type: "Create" }) }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(inboxAdd).not.toHaveBeenCalled();
  });

  it("handles a scalar object.to and uses an empty base when AP_BASE_URL unset", async () => {
    delete process.env.AP_BASE_URL;
    inboxAdd.mockResolvedValue({ id: "j" });
    const res = makeRes();
    const body = JSON.stringify({
      object: { to: "https://local.example/ap/organizations/org-e" },
    });
    await ActivityPubController.postSharedInbox(
      makeReq({
        method: "POST",
        body,
        originalUrl: "/ap/shared-inbox",
      }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(inboxAdd).toHaveBeenCalledTimes(1);
    expect(inboxAdd).toHaveBeenCalledWith(
      "process",
      expect.objectContaining({
        targetOrgId: "org-e",
        requestUrl: "/ap/shared-inbox",
      }),
    );
  });

  it("400 on invalid JSON body", async () => {
    const res = makeRes();
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body: "}{" }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body" });
  });

  it("500 when extractRawBody/JSON.stringify throws (circular body)", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const res = makeRes();
    await ActivityPubController.postSharedInbox(
      makeReq({ method: "POST", body: circular }),
      res,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
  });
});

// ─── requireOrgId gate (via getActorSettings and the list handlers) ───────────
describe("requireOrgId gate", () => {
  it("403 when organisationId is absent", async () => {
    const res = makeRes();
    await ActivityPubController.getActorSettings(makeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Organisation context required" });
  });

  it("listFollowers 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.listFollowers(makeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(svc.listFollowers).not.toHaveBeenCalled();
  });
});

// ─── getActorSettings ─────────────────────────────────────────────────────────
describe("ActivityPubController.getActorSettings", () => {
  it("200 with mapped actor + license status + directory flags", async () => {
    svc.getActorSettingsData.mockResolvedValue({
      actor: {
        uri: "u",
        preferredUsername: "pu",
        publicKeyId: "k",
        inboxUri: "in",
        outboxUri: "out",
        followersUri: "fr",
        followingUri: "fg",
        sharedInboxUri: "si",
        summary: "s",
        iconUrl: "i",
        createdAt: "2020",
      },
      licenseTokenStatus: "VALID",
      isVerified: true,
      directoryListed: true,
    });
    const res = makeRes();
    await ActivityPubController.getActorSettings(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      uri: "u",
      preferredUsername: "pu",
      licenseTokenStatus: "VALID",
      isVerified: true,
      directoryListed: true,
    });
  });

  it("500 when a service throws", async () => {
    svc.getActorSettingsData.mockRejectedValue(new Error("db"));
    const res = makeRes();
    await ActivityPubController.getActorSettings(withOrg(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.getActorSettings(makeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(svc.getActorSettingsData).not.toHaveBeenCalled();
  });
});

// ─── toggleDirectoryListing ───────────────────────────────────────────────────
describe("ActivityPubController.toggleDirectoryListing", () => {
  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      makeReq({ body: { listed: true } }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(svc.setDirectoryListing).not.toHaveBeenCalled();
  });

  it("400 when listed is not a boolean", async () => {
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: { listed: "yes" } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "listed (boolean) required" });
    expect(svc.setDirectoryListing).not.toHaveBeenCalled();
  });

  it("400 when listed is missing", async () => {
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: {} }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("200 with the result on success", async () => {
    svc.setDirectoryListing.mockResolvedValue({ listed: true });
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: { listed: true } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ listed: true });
    expect(svc.setDirectoryListing).toHaveBeenCalledWith("org-1", true);
  });

  it("accepts listed: false", async () => {
    svc.setDirectoryListing.mockResolvedValue({ listed: false });
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: { listed: false } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ listed: false });
  });

  it("422 with the error message when the service throws (Error)", async () => {
    svc.setDirectoryListing.mockRejectedValue(new Error("must be verified"));
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: { listed: true } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "must be verified" });
  });

  it("422 with fallback message when the rejection is not an Error", async () => {
    svc.setDirectoryListing.mockRejectedValue("boom");
    const res = makeRes();
    await ActivityPubController.toggleDirectoryListing(
      withOrg({ body: { listed: true } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "Internal error" });
  });
});

// ─── getDirectory ─────────────────────────────────────────────────────────────
describe("ActivityPubController.getDirectory", () => {
  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.getDirectory(makeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(svc.listDirectory).not.toHaveBeenCalled();
  });

  it("200 with the clinics list", async () => {
    svc.listDirectory.mockResolvedValue({ clinics: [{ actorUri: "a" }] });
    const res = makeRes();
    await ActivityPubController.getDirectory(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ clinics: [{ actorUri: "a" }] });
    expect(svc.listDirectory).toHaveBeenCalledWith("org-1");
  });

  it("500 when the service throws", async () => {
    svc.listDirectory.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ActivityPubController.getDirectory(withOrg(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
  });
});

// ─── updateLicenseToken ───────────────────────────────────────────────────────
describe("ActivityPubController.updateLicenseToken", () => {
  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.updateLicenseToken(
      makeReq({ body: { token: "t" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it("400 when token missing", async () => {
    const res = makeRes();
    await ActivityPubController.updateLicenseToken(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "token required" });
  });

  it("200 on success", async () => {
    svc.updateLicenseToken.mockResolvedValue(undefined);
    const res = makeRes();
    await ActivityPubController.updateLicenseToken(
      withOrg({ body: { token: "good" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(svc.updateLicenseToken).toHaveBeenCalledWith("org-1", "good");
  });

  it("422 with the error message when the service rejects (Error)", async () => {
    svc.updateLicenseToken.mockRejectedValue(new Error("expired token"));
    const res = makeRes();
    await ActivityPubController.updateLicenseToken(
      withOrg({ body: { token: "bad" } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "expired token" });
  });

  it("422 with fallback message when the rejection is not an Error", async () => {
    svc.updateLicenseToken.mockRejectedValue("boom");
    const res = makeRes();
    await ActivityPubController.updateLicenseToken(
      withOrg({ body: { token: "bad" } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "Invalid token" });
  });
});

// ─── follow / unfollow / approve / reject ─────────────────────────────────────
describe("follow-family handlers", () => {
  it("follow 400 when remoteActorUri missing", async () => {
    const res = makeRes();
    await ActivityPubController.follow(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "remoteActorUri required" });
  });

  it("follow 202 with the activity", async () => {
    svc.sendFollow.mockResolvedValue({ type: "Follow" });
    const res = makeRes();
    await ActivityPubController.follow(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ type: "Follow" });
  });

  it("follow 500 on service error", async () => {
    svc.sendFollow.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.follow(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("follow 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.follow(
      makeReq({ body: { remoteActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it("unfollow 400 when uri missing", async () => {
    const res = makeRes();
    await ActivityPubController.unfollow(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it("unfollow 404 when not following", async () => {
    svc.sendUnfollow.mockResolvedValue(null);
    const res = makeRes();
    await ActivityPubController.unfollow(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Not following that actor" });
  });

  it("unfollow 202 with the activity", async () => {
    svc.sendUnfollow.mockResolvedValue({ type: "Undo" });
    const res = makeRes();
    await ActivityPubController.unfollow(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ type: "Undo" });
  });

  it("unfollow 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.unfollow(
      makeReq({ body: { remoteActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(svc.sendUnfollow).not.toHaveBeenCalled();
  });

  it("unfollow 500 on error", async () => {
    svc.sendUnfollow.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.unfollow(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("approveFollower 400 when uri missing", async () => {
    const res = makeRes();
    await ActivityPubController.approveFollower(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it("approveFollower 200 on success", async () => {
    svc.approveFollower.mockResolvedValue(undefined);
    const res = makeRes();
    await ActivityPubController.approveFollower(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("approveFollower 500 on error", async () => {
    svc.approveFollower.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.approveFollower(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("approveFollower 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.approveFollower(
      makeReq({ body: { remoteActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it("rejectFollower 400 when uri missing", async () => {
    const res = makeRes();
    await ActivityPubController.rejectFollower(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it("rejectFollower 200 on success", async () => {
    svc.rejectFollower.mockResolvedValue(undefined);
    const res = makeRes();
    await ActivityPubController.rejectFollower(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejectFollower 500 on error", async () => {
    svc.rejectFollower.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.rejectFollower(
      withOrg({ body: { remoteActorUri: "https://r/actor" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("rejectFollower 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.rejectFollower(
      makeReq({ body: { remoteActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ─── list handlers ────────────────────────────────────────────────────────────
describe("list handlers", () => {
  it("listFollowers 200 rows", async () => {
    svc.listFollowers.mockResolvedValue([{ id: 1 }]);
    const res = makeRes();
    await ActivityPubController.listFollowers(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });

  it("listFollowing 200 rows", async () => {
    svc.listFollowing.mockResolvedValue([{ id: 2 }]);
    const res = makeRes();
    await ActivityPubController.listFollowing(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 2 }]);
  });

  it("listFollowing 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.listFollowing(makeReq(), res);
    expect(res.statusCode).toBe(403);
  });

  it("listInboundReferrals 200 rows", async () => {
    svc.listInboundReferrals.mockResolvedValue([{ id: 3 }]);
    const res = makeRes();
    await ActivityPubController.listInboundReferrals(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 3 }]);
  });

  it("listInboundReferrals 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.listInboundReferrals(makeReq(), res);
    expect(res.statusCode).toBe(403);
  });

  it("listOutboundReferrals 200 rows", async () => {
    svc.listOutboundReferrals.mockResolvedValue([{ id: 4 }]);
    const res = makeRes();
    await ActivityPubController.listOutboundReferrals(withOrg(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 4 }]);
  });

  it("listOutboundReferrals 403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.listOutboundReferrals(makeReq(), res);
    expect(res.statusCode).toBe(403);
  });
});

// ─── sendReferral ─────────────────────────────────────────────────────────────
describe("ActivityPubController.sendReferral", () => {
  const patientSummary = { species: "dog", chiefComplaint: "limp" };

  it("400 when the payload fails validation", async () => {
    const res = makeRes();
    await ActivityPubController.sendReferral(
      withOrg({ body: { toActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe(
      "Invalid referral payload",
    );
    expect(svc.sendReferral).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a non-string patientSummary",
      { toActorUri: "https://r.example/a", patientSummary: "dog" },
    ],
    [
      "an unknown urgency",
      {
        toActorUri: "https://r.example/a",
        patientSummary: { species: "dog", chiefComplaint: "limp" },
        urgency: "WHENEVER",
      },
    ],
    [
      "non-string medication entries",
      {
        toActorUri: "https://r.example/a",
        patientSummary: {
          species: "dog",
          chiefComplaint: "limp",
          currentMedications: [{ name: "x" }],
        },
      },
    ],
    [
      "a toActorUri that is not a URL",
      {
        toActorUri: "not-a-url",
        patientSummary: { species: "dog", chiefComplaint: "limp" },
      },
    ],
    [
      "oversized clinical context",
      {
        toActorUri: "https://r.example/a",
        patientSummary: { species: "dog", chiefComplaint: "limp" },
        clinicalContext: "x".repeat(5001),
      },
    ],
  ])("400 for %s, without reaching the service", async (_label, body) => {
    // These used to be cast straight through to Prisma and the payload
    // builder, producing 500s or malformed clinical messages on the wire.
    const res = makeRes();
    await ActivityPubController.sendReferral(withOrg({ body }), res);
    expect(res.statusCode).toBe(400);
    expect(svc.sendReferral).not.toHaveBeenCalled();
  });

  it("202 with default urgency ROUTINE", async () => {
    svc.sendReferral.mockResolvedValue({ type: "Offer" });
    const res = makeRes();
    await ActivityPubController.sendReferral(
      withOrg({ body: { toActorUri: "https://r/a", patientSummary } }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(svc.sendReferral).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: "ROUTINE", fromOrgId: "org-1" }),
    );
  });

  it("passes an explicit urgency through", async () => {
    svc.sendReferral.mockResolvedValue({ type: "Offer" });
    const res = makeRes();
    await ActivityPubController.sendReferral(
      withOrg({
        body: {
          toActorUri: "https://r/a",
          patientSummary,
          urgency: "EMERGENCY",
          clinicalContext: "ctx",
        },
      }),
      res,
    );
    expect(svc.sendReferral).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: "EMERGENCY", clinicalContext: "ctx" }),
    );
  });

  it("500 on service error", async () => {
    svc.sendReferral.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.sendReferral(
      withOrg({ body: { toActorUri: "https://r/a", patientSummary } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.sendReferral(
      makeReq({ body: { toActorUri: "x", patientSummary } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ─── sendNote ─────────────────────────────────────────────────────────────────
describe("ActivityPubController.sendNote", () => {
  it("400 when toActorUri or content missing", async () => {
    const res = makeRes();
    await ActivityPubController.sendNote(
      withOrg({ body: { toActorUri: "x" } }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("202 with the activity", async () => {
    svc.sendNote.mockResolvedValue({ type: "Create" });
    const res = makeRes();
    await ActivityPubController.sendNote(
      withOrg({
        body: { toActorUri: "https://r/a", content: "hi", inReplyTo: "z" },
      }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ type: "Create" });
  });

  it("500 on service error", async () => {
    svc.sendNote.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.sendNote(
      withOrg({ body: { toActorUri: "https://r/a", content: "hi" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.sendNote(
      makeReq({ body: { toActorUri: "x", content: "y" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ─── announceEmergency ────────────────────────────────────────────────────────
describe("ActivityPubController.announceEmergency", () => {
  it("400 when content missing", async () => {
    const res = makeRes();
    await ActivityPubController.announceEmergency(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "content required" });
  });

  it("202 with the activity", async () => {
    svc.announceEmergency.mockResolvedValue({ type: "Announce" });
    const res = makeRes();
    await ActivityPubController.announceEmergency(
      withOrg({ body: { content: "help", urgency: "EMERGENCY" } }),
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ type: "Announce" });
  });

  it("500 on service error", async () => {
    svc.announceEmergency.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.announceEmergency(
      withOrg({ body: { content: "help" } }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.announceEmergency(
      makeReq({ body: { content: "help" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ─── respondToReferral ────────────────────────────────────────────────────────
describe("ActivityPubController.respondToReferral", () => {
  it("400 when action invalid", async () => {
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      withOrg({ params: { referralId: "r1" }, body: { action: "maybe" } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "action must be 'accept' or 'decline'" });
  });

  it("400 when action missing", async () => {
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      withOrg({ params: { referralId: "r1" }, body: {} }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("200 on accept", async () => {
    svc.respondToReferral.mockResolvedValue({ status: "ACCEPTED" });
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      withOrg({ params: { referralId: "r1" }, body: { action: "accept" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ACCEPTED" });
    expect(svc.respondToReferral).toHaveBeenCalledWith("org-1", "r1", "accept");
  });

  it("422 with error message when service throws (Error)", async () => {
    svc.respondToReferral.mockRejectedValue(new Error("already responded"));
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      withOrg({ params: { referralId: "r1" }, body: { action: "decline" } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "already responded" });
  });

  it("422 with fallback when rejection is not an Error", async () => {
    svc.respondToReferral.mockRejectedValue("boom");
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      withOrg({ params: { referralId: "r1" }, body: { action: "accept" } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: "Internal error" });
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.respondToReferral(
      makeReq({ params: { referralId: "r1" }, body: { action: "accept" } }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ─── updateActorProfile ───────────────────────────────────────────────────────
describe("ActivityPubController.updateActorProfile", () => {
  it("200 with mapped fields", async () => {
    svc.updateActorProfile.mockResolvedValue({ summary: "s2", iconUrl: "i2" });
    const res = makeRes();
    await ActivityPubController.updateActorProfile(
      withOrg({ body: { summary: "s2", iconUrl: "i2" } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ summary: "s2", iconUrl: "i2" });
    expect(svc.updateActorProfile).toHaveBeenCalledWith("org-1", {
      summary: "s2",
      iconUrl: "i2",
    });
  });

  it("500 on service error", async () => {
    svc.updateActorProfile.mockRejectedValue(new Error("x"));
    const res = makeRes();
    await ActivityPubController.updateActorProfile(withOrg({ body: {} }), res);
    expect(res.statusCode).toBe(500);
  });

  it("403 without org", async () => {
    const res = makeRes();
    await ActivityPubController.updateActorProfile(makeReq({ body: {} }), res);
    expect(res.statusCode).toBe(403);
  });
});
