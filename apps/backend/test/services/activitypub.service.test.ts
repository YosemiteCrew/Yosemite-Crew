import { APFollowerState, APFollowingState, APDirection } from "@prisma/client";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const prisma = {
  aPActor: {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
  },
  speciality: {
    findMany: jest.fn(),
  },
  aPRemoteActor: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  aPFollower: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  aPFollowing: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  aPActivity: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  aPReferral: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("@yosemite-crew/database", () => ({
  prisma,
  Prisma: {},
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const generateRsaKeyPair = jest.fn();
const encryptPrivateKey = jest.fn();
const decryptPrivateKey = jest.fn();
jest.mock("src/services/activitypub-crypto.service", () => ({
  generateRsaKeyPair: () => generateRsaKeyPair(),
  encryptPrivateKey: (pem: string) => encryptPrivateKey(pem),
  decryptPrivateKey: (pem: string) => decryptPrivateKey(pem),
}));

jest.mock("src/utils/http-signature", () => ({
  signRequest: jest.fn(() => ({ Signature: "sig" })),
}));

const assertPublicHttpsUrl = jest.fn();
jest.mock("src/utils/ap-url-guard", () => ({
  assertPublicHttpsUrl: (uri: string) => assertPublicHttpsUrl(uri),
}));

const queueAdd = jest.fn();
jest.mock("src/queues/ap-delivery.queue", () => ({
  ApDeliveryQueue: { add: (...args: unknown[]) => queueAdd(...args) },
}));

const isLicenseTokenValid = jest.fn();
const verifyLicenseToken = jest.fn();
jest.mock("src/services/ap-license.service", () => ({
  isLicenseTokenValid: (...args: unknown[]) => isLicenseTokenValid(...args),
  verifyLicenseToken: (...args: unknown[]) => verifyLicenseToken(...args),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import axios from "axios";
import * as svc from "src/services/activitypub.service";

const mockAxios = axios as unknown as {
  get: jest.Mock;
  post: jest.Mock;
};

const BASE = "https://vet.example";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AP_BASE_URL = BASE;
  process.env.AP_LICENSE_AUTHORITY_URL = "https://authority.example";
  assertPublicHttpsUrl.mockResolvedValue(undefined);
  global.fetch = jest.fn();
});

const mockFetch = () => global.fetch as unknown as jest.Mock;

function makeActor(overrides: Record<string, unknown> = {}) {
  return {
    id: "actor-1",
    organisationId: "org-1",
    uri: `${BASE}/ap/organizations/org-1`,
    preferredUsername: "clinic",
    publicKeyPem: "PUBKEY",
    privateKeyPem: "ENC_PRIV",
    publicKeyId: `${BASE}/ap/organizations/org-1#main-key`,
    inboxUri: `${BASE}/ap/organizations/org-1/inbox`,
    outboxUri: `${BASE}/ap/organizations/org-1/outbox`,
    followersUri: `${BASE}/ap/organizations/org-1/followers`,
    followingUri: `${BASE}/ap/organizations/org-1/following`,
    sharedInboxUri: `${BASE}/ap/shared-inbox`,
    summary: "A clinic",
    iconUrl: null,
    licenseToken: "lic-token",
    directoryListed: false,
    ...overrides,
  };
}

// ─── getOrCreateActor ─────────────────────────────────────────────────────────

describe("getOrCreateActor", () => {
  it("returns the existing actor without creating", async () => {
    const actor = makeActor();
    prisma.aPActor.findUnique.mockResolvedValue(actor);

    const result = await svc.getOrCreateActor("org-1");

    expect(result).toBe(actor);
    expect(prisma.aPActor.create).not.toHaveBeenCalled();
    expect(prisma.organization.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("creates a new actor when none exists", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org-1",
      name: "Happy Paws!",
      imageUrl: "https://cdn.example/logo.png",
    });
    generateRsaKeyPair.mockReturnValue({
      publicKeyPem: "PUB",
      privateKeyPem: "PRIV",
    });
    encryptPrivateKey.mockReturnValue("ENCRYPTED");
    const created = makeActor();
    prisma.aPActor.create.mockResolvedValue(created);

    const result = await svc.getOrCreateActor("org-1");

    expect(result).toBe(created);
    expect(encryptPrivateKey).toHaveBeenCalledWith("PRIV");
    const arg = prisma.aPActor.create.mock.calls[0][0];
    expect(arg.data.organisationId).toBe("org-1");
    // Suffixed with a stable slice of the org id: organisation names are not
    // unique but preferredUsername is, and the trailing punctuation is trimmed.
    expect(arg.data.preferredUsername).toBe("happy_paws_org1");
    expect(arg.data.publicKeyPem).toBe("PUB");
    expect(arg.data.privateKeyPem).toBe("ENCRYPTED");
    expect(arg.data.iconUrl).toBe("https://cdn.example/logo.png");
    expect(arg.data.summary).toBe("Happy Paws! — Yosemite Crew");
  });

  it.each([
    ["org-a", "happy_paws_orga"],
    ["org-b", "happy_paws_orgb"],
  ])(
    "gives two identically named clinics distinct usernames (%s)",
    async (orgId, expected) => {
      prisma.aPActor.findUnique.mockResolvedValue(null);
      prisma.organization.findUniqueOrThrow.mockResolvedValue({
        id: orgId,
        name: "Happy Paws!",
        imageUrl: null,
      });
      generateRsaKeyPair.mockReturnValue({
        publicKeyPem: "PUB",
        privateKeyPem: "PRIV",
      });
      encryptPrivateKey.mockReturnValue("ENCRYPTED");
      prisma.aPActor.create.mockResolvedValue(makeActor());

      await svc.getOrCreateActor(orgId);

      const arg = prisma.aPActor.create.mock.calls[0][0];
      expect(arg.data.preferredUsername).toBe(expected);
    },
  );

  it("falls back to a usable username when the name normalises to nothing", async () => {
    // A name with no Latin characters used to normalise to an empty string.
    prisma.aPActor.findUnique.mockResolvedValue(null);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org-9",
      name: "\u732b\u306e\u75c5\u9662",
      imageUrl: null,
    });
    generateRsaKeyPair.mockReturnValue({
      publicKeyPem: "PUB",
      privateKeyPem: "PRIV",
    });
    encryptPrivateKey.mockReturnValue("ENCRYPTED");
    prisma.aPActor.create.mockResolvedValue(makeActor());

    await svc.getOrCreateActor("org-9");

    const arg = prisma.aPActor.create.mock.calls[0][0];
    expect(arg.data.preferredUsername).toBe("clinic_org9");
  });

  it("creates an actor with undefined icon when org has no imageUrl", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org-1",
      name: "Clinic",
      imageUrl: null,
    });
    generateRsaKeyPair.mockReturnValue({
      publicKeyPem: "PUB",
      privateKeyPem: "PRIV",
    });
    encryptPrivateKey.mockReturnValue("ENCRYPTED");
    prisma.aPActor.create.mockResolvedValue(makeActor());

    await svc.getOrCreateActor("org-1");

    const arg = prisma.aPActor.create.mock.calls[0][0];
    expect(arg.data.iconUrl).toBeUndefined();
  });
});

// ─── Actor lookups ──────────────────────────────────────────────────────────

describe("actor lookups", () => {
  it("getActorByOrgId queries by organisationId", async () => {
    const actor = makeActor();
    prisma.aPActor.findUnique.mockResolvedValue(actor);
    const result = await svc.getActorByOrgId("org-1");
    expect(result).toBe(actor);
    expect(prisma.aPActor.findUnique).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
    });
  });

  it("getActorByUri queries by uri", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    const result = await svc.getActorByUri("https://x/actor");
    expect(result).toBeNull();
    expect(prisma.aPActor.findUnique).toHaveBeenCalledWith({
      where: { uri: "https://x/actor" },
    });
  });

  it("getActorByUsername queries by preferredUsername", async () => {
    const actor = makeActor();
    prisma.aPActor.findUnique.mockResolvedValue(actor);
    const result = await svc.getActorByUsername("clinic");
    expect(result).toBe(actor);
    expect(prisma.aPActor.findUnique).toHaveBeenCalledWith({
      where: { preferredUsername: "clinic" },
    });
  });
});

// ─── buildActorResponse ───────────────────────────────────────────────────────

describe("buildActorResponse", () => {
  it("builds the actor object from actor + org", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor({ summary: "S" }));
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org-1",
      name: "Clinic",
    });

    const result = (await svc.buildActorResponse("org-1")) as Record<
      string,
      unknown
    >;

    expect(result.id).toBe(`${BASE}/ap/organizations/org-1`);
    expect(result.preferredUsername).toBe("clinic");
    expect(result.name).toBe("Clinic");
    expect(result.summary).toBe("S");
    expect((result.publicKey as { publicKeyPem: string }).publicKeyPem).toBe(
      "PUBKEY",
    );
  });
});

// ─── resolveWebFinger ─────────────────────────────────────────────────────────

describe("resolveWebFinger", () => {
  it("returns null for a non-acct resource", async () => {
    const result = await svc.resolveWebFinger("https://not-acct");
    expect(result).toBeNull();
  });

  it("returns null when no actor matches the username", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    const result = await svc.resolveWebFinger("acct:ghost@vet.example");
    expect(result).toBeNull();
  });

  it("returns a WebFinger response for a matching actor", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const result = (await svc.resolveWebFinger(
      "acct:clinic@vet.example",
    )) as Record<string, unknown>;
    expect(result.subject).toBe("acct:clinic@vet.example");
    expect(result.aliases).toContain(`${BASE}/ap/organizations/org-1`);
  });

  it("returns null when the matched actor has no organisationId", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(
      makeActor({ organisationId: null }),
    );
    const result = await svc.resolveWebFinger("acct:clinic@vet.example");
    expect(result).toBeNull();
  });
});

// ─── fetchRemoteActor ─────────────────────────────────────────────────────────

describe("fetchRemoteActor", () => {
  const REMOTE = "https://remote.example/ap/organizations/o2";

  function remoteDoc(overrides: Record<string, unknown> = {}) {
    return {
      id: REMOTE,
      preferredUsername: "remoteclinic",
      inbox: `${REMOTE}/inbox`,
      endpoints: { sharedInbox: "https://remote.example/ap/shared-inbox" },
      publicKey: {
        id: `${REMOTE}#main-key`,
        publicKeyPem: "REMOTE_PUB",
      },
      "yc:licenseToken": "remote-lic",
      ...overrides,
    };
  }

  it("returns the cached actor when fresh (cache-hit)", async () => {
    const cached = { uri: REMOTE, fetchedAt: new Date() };
    prisma.aPRemoteActor.findUnique.mockResolvedValue(cached);

    const result = await svc.fetchRemoteActor(REMOTE);

    expect(result).toBe(cached);
    expect(assertPublicHttpsUrl).not.toHaveBeenCalled();
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it("fetches fresh when cache is stale and origins match", async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: REMOTE,
      fetchedAt: staleDate,
    });
    mockAxios.get.mockResolvedValue({ data: remoteDoc() });
    const upserted = { uri: REMOTE };
    prisma.aPRemoteActor.upsert.mockResolvedValue(upserted);

    const result = await svc.fetchRemoteActor(REMOTE);

    expect(assertPublicHttpsUrl).toHaveBeenCalledWith(REMOTE);
    expect(result).toBe(upserted);
    const arg = prisma.aPRemoteActor.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ uri: REMOTE });
    expect(arg.create.publicKeyPem).toBe("REMOTE_PUB");
    expect(arg.create.sharedInboxUri).toBe(
      "https://remote.example/ap/shared-inbox",
    );
    expect(arg.create.licenseToken).toBe("remote-lic");

    // Axios defaults these to unlimited, so a remote-controlled URL could
    // stream a huge body inside the timeout and exhaust worker memory.
    const [, opts] = mockAxios.get.mock.calls[0] as [
      string,
      {
        maxContentLength?: number;
        maxBodyLength?: number;
        maxRedirects?: number;
      },
    ];
    expect(opts.maxContentLength).toBe(256 * 1024);
    expect(opts.maxBodyLength).toBe(256 * 1024);
    expect(opts.maxRedirects).toBe(0);
  });

  it("fetches fresh when there is no cache entry, handles missing sharedInbox/license", async () => {
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);
    mockAxios.get.mockResolvedValue({
      data: remoteDoc({ endpoints: undefined, "yc:licenseToken": undefined }),
    });
    prisma.aPRemoteActor.upsert.mockResolvedValue({ uri: REMOTE });

    await svc.fetchRemoteActor(REMOTE);

    const arg = prisma.aPRemoteActor.upsert.mock.calls[0][0];
    expect(arg.create.sharedInboxUri).toBeNull();
    expect(arg.create.licenseToken).toBeNull();
  });

  it("throws on origin mismatch between fetched URL and declared id/key", async () => {
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);
    mockAxios.get.mockResolvedValue({
      data: remoteDoc({ id: "https://evil.example/actor" }),
    });

    await expect(svc.fetchRemoteActor(REMOTE)).rejects.toThrow(
      /origin mismatch/,
    );
    expect(prisma.aPRemoteActor.upsert).not.toHaveBeenCalled();
  });

  it("throws when the declared id or key id is malformed", async () => {
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);
    mockAxios.get.mockResolvedValue({
      data: remoteDoc({
        id: "not a url",
        publicKey: { id: "also bad", publicKeyPem: "x" },
      }),
    });

    await expect(svc.fetchRemoteActor(REMOTE)).rejects.toThrow(
      /malformed id or key/,
    );
  });
});

// ─── Collections ──────────────────────────────────────────────────────────────

describe("collections", () => {
  it("getFollowersCollection returns approved followers", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findMany.mockResolvedValue([
      { remoteActorUri: "https://a/1" },
      { remoteActorUri: "https://a/2" },
    ]);

    const result = (await svc.getFollowersCollection("org-1")) as {
      totalItems: number;
      orderedItems: unknown[];
    };

    expect(result.totalItems).toBe(2);
    expect(result.orderedItems).toEqual(["https://a/1", "https://a/2"]);
    expect(prisma.aPFollower.findMany.mock.calls[0][0].where.state).toBe(
      APFollowerState.APPROVED,
    );
  });

  it("getFollowingCollection returns accepted following", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findMany.mockResolvedValue([
      { remoteActorUri: "https://b/1" },
    ]);

    const result = (await svc.getFollowingCollection("org-1")) as {
      totalItems: number;
    };

    expect(result.totalItems).toBe(1);
    expect(prisma.aPFollowing.findMany.mock.calls[0][0].where.state).toBe(
      APFollowingState.ACCEPTED,
    );
  });

  const AS_PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

  it("getOutboxCollection serves activities addressed to the public collection", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const announce = { type: "Announce", to: [AS_PUBLIC], cc: ["followers"] };
    prisma.aPActivity.findMany.mockResolvedValue([
      { rawJson: announce, published: new Date() },
    ]);

    const result = (await svc.getOutboxCollection("org-1")) as {
      totalItems: number;
      orderedItems: unknown[];
    };

    expect(result.totalItems).toBe(1);
    expect(result.orderedItems).toEqual([announce]);
    expect(prisma.aPActivity.findMany.mock.calls[0][0].where.direction).toBe(
      APDirection.OUTBOUND,
    );
  });

  it("getOutboxCollection never exposes directed clinical activities", async () => {
    // The outbox is unauthenticated. A referral Offer carries the patient
    // summary, so it must not be reachable by anyone who knows an org id.
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const referral = {
      type: "Offer",
      to: ["https://remote.example/actor"],
      object: {
        type: "Note",
        content: "species: dog, allergies: penicillin, complaint: limp",
      },
    };
    prisma.aPActivity.findMany.mockResolvedValue([
      { rawJson: referral, published: new Date() },
      {
        rawJson: { type: "Create", to: ["https://remote.example/actor"] },
        published: new Date(),
      },
      { rawJson: { type: "Follow" }, published: new Date() },
    ]);

    const result = (await svc.getOutboxCollection("org-1")) as {
      totalItems: number;
      orderedItems: unknown[];
    };

    expect(result.totalItems).toBe(0);
    expect(result.orderedItems).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("penicillin");
  });

  it("getOutboxCollection scans past directed activities to find public ones", async () => {
    // Filtering after a take:20 would let a burst of directed activities push
    // every public one off the page.
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const directed = Array.from({ length: 50 }, () => ({
      rawJson: { type: "Offer", to: ["https://remote.example/actor"] },
      published: new Date(),
    }));
    prisma.aPActivity.findMany.mockResolvedValue([
      ...directed,
      { rawJson: { type: "Announce", to: [AS_PUBLIC] }, published: new Date() },
    ]);

    const result = (await svc.getOutboxCollection("org-1")) as {
      totalItems: number;
    };

    expect(result.totalItems).toBe(1);
    expect(prisma.aPActivity.findMany.mock.calls[0][0].take).toBeGreaterThan(
      20,
    );
  });
});

// ─── sendFollow ───────────────────────────────────────────────────────────────

describe("sendFollow", () => {
  it("throws when the instance has no valid license", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    isLicenseTokenValid.mockResolvedValue(false);

    await expect(
      svc.sendFollow("org-1", "https://remote.example/actor"),
    ).rejects.toThrow(/valid federation license/);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("upserts following, records activity, and enqueues delivery", async () => {
    const actor = makeActor();
    prisma.aPActor.findUnique.mockResolvedValue(actor);
    isLicenseTokenValid.mockResolvedValue(true);
    // fetchRemoteActor path: cached fresh
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/actor/inbox",
      sharedInboxUri: "https://remote.example/shared",
    });
    prisma.aPFollowing.upsert.mockResolvedValue({});
    prisma.aPActivity.create.mockResolvedValue({});

    const activity = (await svc.sendFollow(
      "org-1",
      "https://remote.example/actor",
    )) as { type: string };

    expect(activity.type).toBe("Follow");
    expect(prisma.aPFollowing.upsert).toHaveBeenCalled();
    expect(prisma.aPActivity.create).toHaveBeenCalled();
    const followingArg = prisma.aPFollowing.upsert.mock.calls[0][0];
    expect(followingArg.create.state).toBe(APFollowingState.PENDING);
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        actorId: "actor-1",
        inboxUri: "https://remote.example/shared",
      }),
    );
  });
});

// ─── sendReferral ─────────────────────────────────────────────────────────────

describe("sendReferral", () => {
  const opts = {
    fromOrgId: "org-1",
    toActorUri: "https://remote.example/actor",
    patientSummary: { species: "dog", chiefComplaint: "limping" },
    urgency: "ROUTINE" as const,
  };

  it("throws when there is no accepted federation link (consent gate)", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue(null);

    await expect(svc.sendReferral(opts)).rejects.toThrow(
      /No accepted federation link/,
    );
  });

  it("throws when the link exists but is not ACCEPTED", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue({
      state: APFollowingState.PENDING,
    });

    await expect(svc.sendReferral(opts)).rejects.toThrow(
      /No accepted federation link/,
    );
  });

  it("creates referral + activity and enqueues delivery on the happy path", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue({
      state: APFollowingState.ACCEPTED,
    });
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: opts.toActorUri,
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });
    prisma.aPReferral.create.mockResolvedValue({});
    prisma.aPActivity.create.mockResolvedValue({});

    const activity = (await svc.sendReferral({
      ...opts,
      clinicalContext: "seen twice",
    })) as { type: string };

    expect(activity.type).toBe("Offer");
    expect(prisma.aPReferral.create).toHaveBeenCalled();
    expect(prisma.aPActivity.create).toHaveBeenCalled();
    // sharedInbox null -> falls back to inboxUri
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/inbox" }),
    );
  });
});

// ─── getOrgCapabilities ───────────────────────────────────────────────────────

describe("getOrgCapabilities", () => {
  it("returns org name/type and active specialities, mapping null description to undefined", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      name: "Happy Paws",
      type: "CLINIC",
    });
    prisma.speciality.findMany.mockResolvedValue([
      {
        name: "Cardiology",
        description: "Heart care",
        services: ["ECG", "Echo"],
      },
      { name: "Dermatology", description: null, services: ["Allergy testing"] },
    ]);

    const result = await svc.getOrgCapabilities("org-1");

    expect(result).toEqual({
      name: "Happy Paws",
      type: "CLINIC",
      specialities: [
        {
          name: "Cardiology",
          description: "Heart care",
          services: ["ECG", "Echo"],
        },
        {
          name: "Dermatology",
          description: undefined,
          services: ["Allergy testing"],
        },
      ],
    });
    const specArg = prisma.speciality.findMany.mock.calls[0][0];
    expect(specArg.where).toEqual({ organisationId: "org-1", isActive: true });
    expect(specArg.orderBy).toEqual({ name: "asc" });
  });

  it("returns an empty specialities list when the org has none", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      name: "Solo Vet",
      type: "PRACTICE",
    });
    prisma.speciality.findMany.mockResolvedValue([]);

    const result = await svc.getOrgCapabilities("org-1");

    expect(result).toEqual({
      name: "Solo Vet",
      type: "PRACTICE",
      specialities: [],
    });
  });
});

// ─── sendAgentTask ────────────────────────────────────────────────────────────

describe("sendAgentTask", () => {
  it("enqueues an Offer wrapping a yc:AgentTask and returns { taskId, activityId }", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: "https://remote.example/shared",
    });

    const result = await svc.sendAgentTask({
      fromOrgId: "org-1",
      toActorUri: "https://remote.example/actor",
      taskType: "capability_query",
      input: { species: "Cat" },
    });

    expect(result).toEqual({
      taskId: expect.any(String),
      activityId: expect.any(String),
    });
    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [job, payload] = queueAdd.mock.calls[0];
    expect(job).toBe("deliver");
    expect(payload.actorId).toBe("actor-1");
    expect(payload.inboxUri).toBe("https://remote.example/shared");
    expect(payload.activity.type).toBe("Offer");
    const taskObject = payload.activity.object as Record<string, unknown>;
    expect(taskObject.type).toBe("yc:AgentTask");
    expect(taskObject["yc:taskType"]).toBe("capability_query");
    expect(taskObject["yc:input"]).toEqual({ species: "Cat" });
  });

  it("falls back to the direct inbox when there is no shared inbox", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });

    await svc.sendAgentTask({
      fromOrgId: "org-1",
      toActorUri: "https://remote.example/actor",
      taskType: "capability_query",
    });

    expect(queueAdd.mock.calls[0][1].inboxUri).toBe(
      "https://remote.example/inbox",
    );
  });
});

// ─── sendNote ─────────────────────────────────────────────────────────────────

describe("sendNote", () => {
  it("creates a Create activity and enqueues delivery", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: "https://remote.example/shared",
    });
    prisma.aPActivity.create.mockResolvedValue({});

    const activity = (await svc.sendNote({
      fromOrgId: "org-1",
      toActorUri: "https://remote.example/actor",
      content: "hello",
      inReplyTo: "https://remote.example/notes/1",
    })) as { type: string };

    expect(activity.type).toBe("Create");
    expect(prisma.aPActivity.create).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/shared" }),
    );
  });
});

// ─── announceEmergency ────────────────────────────────────────────────────────

describe("announceEmergency", () => {
  it("records the announce and fans out to unique follower inboxes", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActivity.create.mockResolvedValue({});
    prisma.aPFollower.findMany.mockResolvedValue([
      { sharedInboxUri: "https://a/shared", remoteInboxUri: "https://a/inbox" },
      { sharedInboxUri: "https://a/shared", remoteInboxUri: "https://a/inbox" },
      { sharedInboxUri: null, remoteInboxUri: "https://b/inbox" },
    ]);

    const activity = (await svc.announceEmergency({
      fromOrgId: "org-1",
      content: "Emergency!",
      urgency: "EMERGENCY",
    })) as { type: string };

    expect(activity.type).toBe("Announce");
    expect(prisma.aPActivity.create).toHaveBeenCalled();
    // dedup: {https://a/shared, https://b/inbox} => 2 deliveries
    expect(queueAdd).toHaveBeenCalledTimes(2);
    const inboxes = queueAdd.mock.calls.map((c) => c[1].inboxUri).sort();
    expect(inboxes).toEqual(["https://a/shared", "https://b/inbox"]);
  });
});

// ─── updateLicenseToken ───────────────────────────────────────────────────────

describe("updateLicenseToken", () => {
  it("throws when token orgId does not match", async () => {
    verifyLicenseToken.mockResolvedValue({ orgId: "other-org" });

    await expect(svc.updateLicenseToken("org-1", "tok")).rejects.toThrow(
      /orgId mismatch/,
    );
    expect(prisma.aPActor.update).not.toHaveBeenCalled();
  });

  it("persists the token on the actor when orgId matches", async () => {
    verifyLicenseToken.mockResolvedValue({ orgId: "org-1" });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});

    await svc.updateLicenseToken("org-1", "tok");

    expect(prisma.aPActor.update).toHaveBeenCalledWith({
      where: { id: "actor-1" },
      data: { licenseToken: "tok" },
    });
  });
});

// ─── sendUnfollow ─────────────────────────────────────────────────────────────

describe("sendUnfollow", () => {
  it("returns null when there is no following record", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue(null);

    const result = await svc.sendUnfollow("org-1", "https://remote.example/a");
    expect(result).toBeNull();
    expect(prisma.aPFollowing.delete).not.toHaveBeenCalled?.();
  });

  it("deletes the following and enqueues Undo when remote is known", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue({ id: "f1" });
    prisma.aPFollowing.delete.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });

    const activity = (await svc.sendUnfollow(
      "org-1",
      "https://remote.example/a",
    )) as { type: string };

    expect(activity.type).toBe("Undo");
    expect(prisma.aPFollowing.delete).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/inbox" }),
    );
  });

  it("deletes but does not enqueue when remote actor is unknown", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollowing.findUnique.mockResolvedValue({ id: "f1" });
    prisma.aPFollowing.delete.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);

    const activity = (await svc.sendUnfollow(
      "org-1",
      "https://remote.example/a",
    )) as { type: string };

    expect(activity.type).toBe("Undo");
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

// ─── approveFollower / rejectFollower ─────────────────────────────────────────

describe("approveFollower", () => {
  it("throws when the follow request is missing", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue(null);
    await expect(
      svc.approveFollower("org-1", "https://remote.example/a"),
    ).rejects.toThrow(/not found/);
  });

  it("approves and enqueues an Accept when remote is known", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: "https://remote.example/shared",
    });

    await svc.approveFollower("org-1", "https://remote.example/a");

    expect(prisma.aPFollower.update.mock.calls[0][0].data.state).toBe(
      APFollowerState.APPROVED,
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/shared" }),
    );
  });

  it("echoes the stored inbound Follow in the Accept", async () => {
    // A conforming server correlates the Accept with its outstanding Follow, so
    // a synthetic object left the remote pending forever.
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });
    prisma.aPActivity.findMany.mockResolvedValue([
      {
        rawJson: {
          id: "urn:f:original",
          type: "Follow",
          actor: "https://remote.example/a",
        },
      },
      {
        rawJson: {
          id: "urn:f:other",
          type: "Follow",
          actor: "https://other/a",
        },
      },
    ]);

    await svc.approveFollower("org-1", "https://remote.example/a");

    const queued = queueAdd.mock.calls[0][1] as {
      activity: { object: { id: string } };
    };
    expect(queued.activity.object.id).toBe("urn:f:original");
  });

  it("falls back to a synthetic Follow when the original was pruned", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });
    prisma.aPActivity.findMany.mockResolvedValue([]);

    await svc.approveFollower("org-1", "https://remote.example/a");

    const queued = queueAdd.mock.calls[0][1] as {
      activity: { object: { type: string } };
    };
    expect(queued.activity.object.type).toBe("Follow");
  });

  it("approves without enqueueing when remote is unknown", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);

    await svc.approveFollower("org-1", "https://remote.example/a");
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

describe("rejectFollower", () => {
  it("throws when the follow request is missing", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue(null);
    await expect(
      svc.rejectFollower("org-1", "https://remote.example/a"),
    ).rejects.toThrow(/not found/);
  });

  it("rejects and enqueues a Reject when remote is known", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });

    await svc.rejectFollower("org-1", "https://remote.example/a");

    expect(prisma.aPFollower.update.mock.calls[0][0].data.state).toBe(
      APFollowerState.REJECTED,
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/inbox" }),
    );
  });

  it("rejects without enqueueing when remote is unknown", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPFollower.findUnique.mockResolvedValue({ id: "fl1" });
    prisma.aPFollower.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue(null);

    await svc.rejectFollower("org-1", "https://remote.example/a");
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

// ─── Referral management (receiving side) ─────────────────────────────────────

describe("listInboundReferrals / listOutboundReferrals", () => {
  it("returns [] when no actor exists (inbound)", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    expect(await svc.listInboundReferrals("org-1")).toEqual([]);
  });

  it("lists inbound referrals by actor uri", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const rows = [{ id: "r1" }];
    prisma.aPReferral.findMany.mockResolvedValue(rows);
    expect(await svc.listInboundReferrals("org-1")).toBe(rows);
    expect(prisma.aPReferral.findMany.mock.calls[0][0].where.toActorUri).toBe(
      makeActor().uri,
    );
  });

  it("returns [] when no actor exists (outbound)", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    expect(await svc.listOutboundReferrals("org-1")).toEqual([]);
  });

  it("lists outbound referrals by org id", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const rows = [{ id: "r2" }];
    prisma.aPReferral.findMany.mockResolvedValue(rows);
    expect(await svc.listOutboundReferrals("org-1")).toBe(rows);
    expect(prisma.aPReferral.findMany.mock.calls[0][0].where.fromOrgId).toBe(
      "org-1",
    );
  });
});

describe("respondToReferral", () => {
  const REFERRAL_URI = `${BASE}/ap/activities/act-1`;

  function makeReferral(overrides: Record<string, unknown> = {}) {
    return {
      id: "ref-1",
      toActorUri: makeActor().uri,
      fromActorUri: "https://remote.example/actor",
      activityUri: REFERRAL_URI,
      state: "PENDING",
      ...overrides,
    };
  }

  it("leaves the referral PENDING when delivery fails, so it can be retried", async () => {
    // The state change used to happen first, so a failure here left the
    // referral no longer PENDING while the sender never heard the decision -
    // and the "already accepted" guard then refused every retry.
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPReferral.findUniqueOrThrow.mockResolvedValue(makeReferral());
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
      publicKeyPem: "k",
      publicKeyId: "k#main",
      preferredUsername: "remote",
    });
    queueAdd.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      svc.respondToReferral("org-1", "ref-1", "accept"),
    ).rejects.toThrow(/redis down/);

    expect(prisma.aPReferral.update).not.toHaveBeenCalled();
  });

  it("throws when the referral does not belong to this org", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPReferral.findUniqueOrThrow.mockResolvedValue(
      makeReferral({ toActorUri: "https://other/actor" }),
    );
    await expect(
      svc.respondToReferral("org-1", "ref-1", "accept"),
    ).rejects.toThrow(/does not belong/);
  });

  it("throws when the referral is not PENDING", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPReferral.findUniqueOrThrow.mockResolvedValue(
      makeReferral({ state: "ACCEPTED" }),
    );
    await expect(
      svc.respondToReferral("org-1", "ref-1", "accept"),
    ).rejects.toThrow(/already accepted/);
  });

  it("accepts: updates state, sends Accept, enqueues delivery", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPReferral.findUniqueOrThrow.mockResolvedValue(makeReferral());
    prisma.aPReferral.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: "https://remote.example/shared",
    });
    prisma.aPActivity.create.mockResolvedValue({});

    const result = await svc.respondToReferral("org-1", "ref-1", "accept");

    expect(result).toEqual({ id: "ref-1", state: "ACCEPTED" });
    const updArg = prisma.aPReferral.update.mock.calls[0][0];
    expect(updArg.data.state).toBe("ACCEPTED");
    expect(updArg.data.acceptedAt).toBeInstanceOf(Date);
    expect(prisma.aPActivity.create.mock.calls[0][0].data.type).toBe("Accept");
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({ inboxUri: "https://remote.example/shared" }),
    );
  });

  it("declines: updates state and sends Reject", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPReferral.findUniqueOrThrow.mockResolvedValue(makeReferral());
    prisma.aPReferral.update.mockResolvedValue({});
    prisma.aPRemoteActor.findUnique.mockResolvedValue({
      uri: "https://remote.example/actor",
      fetchedAt: new Date(),
      inboxUri: "https://remote.example/inbox",
      sharedInboxUri: null,
    });
    prisma.aPActivity.create.mockResolvedValue({});

    const result = await svc.respondToReferral("org-1", "ref-1", "decline");

    expect(result).toEqual({ id: "ref-1", state: "DECLINED" });
    const updArg = prisma.aPReferral.update.mock.calls[0][0];
    expect(updArg.data.state).toBe("DECLINED");
    expect(updArg.data.declinedAt).toBeInstanceOf(Date);
    expect(prisma.aPActivity.create.mock.calls[0][0].data.type).toBe("Reject");
  });
});

// ─── updateActorProfile ───────────────────────────────────────────────────────

describe("updateActorProfile", () => {
  it("updates only provided fields", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    await svc.updateActorProfile("org-1", { summary: "new" });
    expect(prisma.aPActor.update.mock.calls[0][0].data).toEqual({
      summary: "new",
    });
  });

  it("updates iconUrl and leaves summary untouched when omitted", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    await svc.updateActorProfile("org-1", { iconUrl: "https://x/i.png" });
    expect(prisma.aPActor.update.mock.calls[0][0].data).toEqual({
      iconUrl: "https://x/i.png",
    });
  });
});

// ─── listFollowers / listFollowing ────────────────────────────────────────────

describe("listFollowers / listFollowing", () => {
  it("returns [] when no actor exists (followers)", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    expect(await svc.listFollowers("org-1")).toEqual([]);
  });

  it("lists followers for the actor", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const rows = [{ id: "fl1" }];
    prisma.aPFollower.findMany.mockResolvedValue(rows);
    expect(await svc.listFollowers("org-1")).toBe(rows);
    expect(prisma.aPFollower.findMany.mock.calls[0][0].where.localActorId).toBe(
      "actor-1",
    );
  });

  it("returns [] when no actor exists (following)", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    expect(await svc.listFollowing("org-1")).toEqual([]);
  });

  it("lists following for the actor", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    const rows = [{ id: "fw1" }];
    prisma.aPFollowing.findMany.mockResolvedValue(rows);
    expect(await svc.listFollowing("org-1")).toBe(rows);
  });
});

// ─── getLicenseTokenStatus ────────────────────────────────────────────────────

describe("getLicenseTokenStatus", () => {
  it("returns 'none' when no actor exists", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(null);
    expect(await svc.getLicenseTokenStatus("org-1")).toBe("none");
  });

  it("returns 'none' when the actor has no licenseToken", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(
      makeActor({ licenseToken: null }),
    );
    expect(await svc.getLicenseTokenStatus("org-1")).toBe("none");
  });

  it("returns 'valid' when the token validates", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    isLicenseTokenValid.mockResolvedValue(true);
    expect(await svc.getLicenseTokenStatus("org-1")).toBe("valid");
  });

  it("returns 'invalid' when the token fails validation", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    isLicenseTokenValid.mockResolvedValue(false);
    expect(await svc.getLicenseTokenStatus("org-1")).toBe("invalid");
  });
});

// ─── Federation licence gate on outbound senders ─────────────────────────────

describe("outbound senders require a verified instance", () => {
  // Before this, only sendFollow checked. The others could originate
  // federation traffic from an instance with no valid licence at all.
  const cases: Array<[string, () => Promise<unknown>]> = [
    [
      "sendAgentTask",
      () =>
        svc.sendAgentTask({
          fromOrgId: "org-1",
          toActorUri: "https://remote.example/actor",
          taskType: "capability_query",
        }),
    ],
    [
      "sendNote",
      () =>
        svc.sendNote({
          fromOrgId: "org-1",
          toActorUri: "https://remote.example/actor",
          content: "hello",
        }),
    ],
    [
      "announceEmergency",
      () => svc.announceEmergency({ fromOrgId: "org-1", content: "help" }),
    ],
    [
      "sendReferral",
      () =>
        svc.sendReferral({
          fromOrgId: "org-1",
          toActorUri: "https://remote.example/actor",
          patientSummary: { species: "dog", chiefComplaint: "limp" },
          urgency: "ROUTINE",
        }),
    ],
  ];

  it.each(cases)(
    "%s rejects when the licence is not valid",
    async (_n, call) => {
      prisma.aPActor.findUnique.mockResolvedValue(makeActor());
      isLicenseTokenValid.mockResolvedValue(false);

      await expect(call()).rejects.toThrow(/valid federation license/);
      expect(queueAdd).not.toHaveBeenCalled();
    },
  );
});

// ─── setDirectoryListing ──────────────────────────────────────────────────────

describe("setDirectoryListing", () => {
  it("throws when the organisation is not verified", async () => {
    prisma.organization.findUnique.mockResolvedValue({ isVerified: false });

    await expect(svc.setDirectoryListing("org-1", true)).rejects.toThrow(
      /must be verified/,
    );
    expect(prisma.aPActor.update).not.toHaveBeenCalled();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("throws when the org record is missing (nullish isVerified)", async () => {
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(svc.setDirectoryListing("org-1", true)).rejects.toThrow(
      /must be verified/,
    );
  });

  it("throws when the actor has no license token", async () => {
    prisma.organization.findUnique.mockResolvedValue({ isVerified: true });
    prisma.aPActor.findUnique.mockResolvedValue(
      makeActor({ licenseToken: null }),
    );

    await expect(svc.setDirectoryListing("org-1", true)).rejects.toThrow(
      /federation license token/,
    );
    expect(prisma.aPActor.update).not.toHaveBeenCalled();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("updates locally and calls the authority with the bearer token on success", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: true });

    const result = await svc.setDirectoryListing("org-1", true);

    expect(result).toEqual({ listed: true });
    expect(prisma.aPActor.update).toHaveBeenCalledWith({
      where: { id: "actor-1" },
      data: { directoryListed: true },
    });
    const [url, opts] = mockFetch().mock.calls[0];
    expect(url).toBe("https://authority.example/api/directory/listing");
    expect(opts.method).toBe("PUT");
    expect(opts.headers.Authorization).toBe("Bearer lic-token");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    // The authority stores no organisation names, so listing carries the
    // display fields. Omitting orgName here would earn a 400 from it.
    expect(JSON.parse(opts.body)).toEqual({
      listed: true,
      actorUri: "https://vet.example/ap/organizations/org-1",
      orgName: "Example Vets",
      handle: "@clinic@vet.example",
    });
  });

  it("sends only the flag when unlisting, since display fields are not needed", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: true });

    await svc.setDirectoryListing("org-1", false);

    expect(JSON.parse(mockFetch().mock.calls[0][1].body)).toEqual({
      listed: false,
    });
  });

  it("leaves the local flag untouched when the authority rejects the change", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: false, status: 500 });

    await expect(svc.setDirectoryListing("org-1", true)).rejects.toThrow(
      /HTTP 500/,
    );
    // The settings toggle would otherwise claim the clinic is listed while the
    // authority never recorded it - a state the user cannot see or repair.
    expect(prisma.aPActor.update).not.toHaveBeenCalled();
  });

  it("throws when the authority responds non-ok", async () => {
    prisma.organization.findUnique.mockResolvedValue({ isVerified: true });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: false, status: 503 });

    await expect(svc.setDirectoryListing("org-1", false)).rejects.toThrow(
      /HTTP 503/,
    );
  });

  it("falls back to a bare handle when the actor uri will not parse", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(
      makeActor({ uri: "not a uri" }),
    );
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: true });

    await svc.setDirectoryListing("org-1", true);

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).handle).toBe(
      "@clinic",
    );
  });

  // This test used to expect `https://api.yosemitecrew.com`, which pinned the
  // defect rather than the behaviour: the directory reader carried the API's own
  // host as its default long after `ap-license.service` had been corrected away
  // from it, and that host serves neither `/api/directory` nor
  // `/api/ap/signing-key.json` (both 404 while `/health` answers 200). So with
  // the variable unset, licence verification and the directory pointed at two
  // different hosts and the directory fetched a 404 - and this assertion said
  // that was correct.
  it("falls back to the SuperAdmin authority when the env var is unset", async () => {
    delete process.env.AP_LICENSE_AUTHORITY_URL;
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: true });

    await svc.setDirectoryListing("org-1", true);

    expect(mockFetch().mock.calls[0][0]).toBe(
      "https://admin.yosemitecrew.com/api/directory/listing",
    );
  });

  it("uses the same base the licence endpoints use, with the var unset", async () => {
    // The regression this file could not catch on its own: two readers agreeing
    // is the property, and each one asserted in isolation is what let them drift.
    delete process.env.AP_LICENSE_AUTHORITY_URL;
    prisma.organization.findUnique.mockResolvedValue({
      isVerified: true,
      name: "Example Vets",
    });
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.aPActor.update.mockResolvedValue({});
    mockFetch().mockResolvedValue({ ok: true });

    await svc.setDirectoryListing("org-1", true);

    const { apAuthorityBase } = await import("src/services/ap-authority");
    expect(mockFetch().mock.calls[0][0]).toBe(
      `${apAuthorityBase()}/api/directory/listing`,
    );
  });
});

// ─── listDirectory ────────────────────────────────────────────────────────────

describe("listDirectory", () => {
  const clinics = [
    {
      actorUri: "https://vet.example/ap/organizations/o2",
      orgName: "Remote Vet",
      instanceHost: "vet.example",
      handle: "@remotevet@vet.example",
    },
  ];

  it("passes through the authority clinics with the license bearer (fresh module)", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(makeActor());
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clinics }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fresh.listDirectory("org-1");

      expect(result).toEqual({ clinics, unavailable: false });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe("https://authority.example/api/directory");
      expect(opts.headers.Authorization).toBe("Bearer lic-token");
    });
  });

  it("caches the authority response within the TTL (second call does not refetch)", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(makeActor());
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clinics }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await fresh.listDirectory("org-1");
      await fresh.listDirectory("org-1");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("omits the Authorization header when no license token and defaults missing clinics to []", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(
        makeActor({ licenseToken: null }),
      );
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fresh.listDirectory("org-1");

      expect(result).toEqual({ clinics: [], unavailable: false });
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
  });

  it("returns { clinics: [] } when there is no actor at all", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(null);
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clinics }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fresh.listDirectory("org-1");
      expect(result).toEqual({ clinics, unavailable: false });
    });
  });

  it("reports unavailable, not empty, when the authority responds non-ok", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(makeActor());
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;

      const result = await fresh.listDirectory("org-1");
      expect(result).toEqual({ clinics: [], unavailable: true });
    });
  });

  it("reports unavailable, not empty, when fetch rejects (network error)", async () => {
    await jest.isolateModulesAsync(async () => {
      const fresh = await import("src/services/activitypub.service");
      prisma.aPActor.findUnique.mockResolvedValue(makeActor());
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error("ECONNREFUSED"),
        ) as unknown as typeof fetch;

      const result = await fresh.listDirectory("org-1");
      expect(result).toEqual({ clinics: [], unavailable: true });
    });
  });
});

// ─── getActorSettingsData ─────────────────────────────────────────────────────

describe("getActorSettingsData", () => {
  it("returns the actor, license status, verification, and listing flags", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(
      makeActor({ directoryListed: true }),
    );
    prisma.organization.findUnique.mockResolvedValue({ isVerified: true });
    isLicenseTokenValid.mockResolvedValue(true);

    const result = await svc.getActorSettingsData("org-1");

    expect(result.actor.id).toBe("actor-1");
    expect(result.licenseTokenStatus).toBe("valid");
    expect(result.isVerified).toBe(true);
    expect(result.directoryListed).toBe(true);
  });

  it("defaults isVerified to false when the org record is missing", async () => {
    prisma.aPActor.findUnique.mockResolvedValue(makeActor());
    prisma.organization.findUnique.mockResolvedValue(null);
    isLicenseTokenValid.mockResolvedValue(false);

    const result = await svc.getActorSettingsData("org-1");

    expect(result.isVerified).toBe(false);
    expect(result.directoryListed).toBe(false);
  });
});
