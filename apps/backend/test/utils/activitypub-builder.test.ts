import {
  AP_CONTEXT,
  AP_CONTENT_TYPE,
  AP_LD_CONTENT_TYPE,
  apBaseUrl,
  actorUri,
  publicKeyId,
  inboxUri,
  outboxUri,
  followersUri,
  followingUri,
  sharedInboxUri,
  activityUri,
  buildActorObject,
  buildWebFingerResponse,
  buildActivity,
  buildFollowActivity,
  buildAcceptActivity,
  buildRejectActivity,
  buildUndoActivity,
  buildReferralObject,
  buildAgentTaskObject,
  buildAgentTaskResultObject,
  buildOfferActivity,
  buildNoteActivity,
  buildAnnounceActivity,
  buildOrderedCollection,
  generateActivityId,
} from "src/utils/activitypub-builder";

const BASE = "https://vet.example.com";
const ORG = "org-123";
const ACTOR = `${BASE}/ap/organizations/${ORG}`;

describe("activitypub-builder", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AP_BASE_URL = BASE;
    delete process.env.API_BASE_URL;
    delete process.env.npm_package_version;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("constants", () => {
    it("exposes the AP context and content types", () => {
      expect(AP_CONTEXT).toEqual([
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/v1",
      ]);
      expect(AP_CONTENT_TYPE).toBe("application/activity+json");
      expect(AP_LD_CONTENT_TYPE).toContain("application/ld+json");
    });
  });

  describe("apBaseUrl", () => {
    it("reads AP_BASE_URL and strips a trailing slash", () => {
      process.env.AP_BASE_URL = `${BASE}/`;
      expect(apBaseUrl()).toBe(BASE);
    });

    it("falls back to API_BASE_URL when AP_BASE_URL is unset", () => {
      delete process.env.AP_BASE_URL;
      process.env.API_BASE_URL = `${BASE}/`;
      expect(apBaseUrl()).toBe(BASE);
    });

    it("returns empty string when neither is set", () => {
      delete process.env.AP_BASE_URL;
      delete process.env.API_BASE_URL;
      expect(apBaseUrl()).toBe("");
    });
  });

  describe("URI helpers", () => {
    it("builds every actor-scoped URI", () => {
      expect(actorUri(ORG)).toBe(ACTOR);
      expect(publicKeyId(ORG)).toBe(`${ACTOR}#main-key`);
      expect(inboxUri(ORG)).toBe(`${ACTOR}/inbox`);
      expect(outboxUri(ORG)).toBe(`${ACTOR}/outbox`);
      expect(followersUri(ORG)).toBe(`${ACTOR}/followers`);
      expect(followingUri(ORG)).toBe(`${ACTOR}/following`);
      expect(sharedInboxUri()).toBe(`${BASE}/ap/shared-inbox`);
      expect(activityUri("act-1")).toBe(`${BASE}/ap/activities/act-1`);
    });
  });

  describe("buildActorObject", () => {
    it("builds a full actor with icon and license token", () => {
      const actor = buildActorObject({
        orgId: ORG,
        preferredUsername: "vetclinic",
        name: "Vet Clinic",
        summary: "A clinic",
        iconUrl: "https://cdn.example.com/logo.jpg",
        publicKeyPem: "PEMDATA",
        licenseToken: "lic-abc",
      });

      expect(actor.id).toBe(ACTOR);
      expect(actor.type).toBe("Service");
      expect(actor.preferredUsername).toBe("vetclinic");
      expect(actor.name).toBe("Vet Clinic");
      expect(actor.summary).toBe("A clinic");
      expect(actor.inbox).toBe(`${ACTOR}/inbox`);
      expect(actor.outbox).toBe(`${ACTOR}/outbox`);
      expect(actor.followers).toBe(`${ACTOR}/followers`);
      expect(actor.following).toBe(`${ACTOR}/following`);
      expect(actor.endpoints).toEqual({
        sharedInbox: `${BASE}/ap/shared-inbox`,
      });
      expect(actor.icon).toEqual({
        type: "Image",
        mediaType: "image/jpeg",
        url: "https://cdn.example.com/logo.jpg",
      });
      expect(actor.publicKey).toEqual({
        id: `${ACTOR}#main-key`,
        owner: ACTOR,
        publicKeyPem: "PEMDATA",
      });
      expect(actor["yc:licenseToken"]).toBe("lic-abc");
      expect(actor["@context"]).toEqual([
        ...AP_CONTEXT,
        { yc: "https://yosemitecrew.com/ns#" },
      ]);
    });

    it("omits icon and license token when not provided", () => {
      const actor = buildActorObject({
        orgId: ORG,
        preferredUsername: "vetclinic",
        name: "Vet Clinic",
        publicKeyPem: "PEMDATA",
      });
      expect(actor.icon).toBeUndefined();
      expect(actor.summary).toBeUndefined();
      expect(actor["yc:licenseToken"]).toBeUndefined();
    });

    it("omits license token when it is null", () => {
      const actor = buildActorObject({
        orgId: ORG,
        preferredUsername: "vetclinic",
        name: "Vet Clinic",
        publicKeyPem: "PEMDATA",
        licenseToken: null,
      });
      expect(actor["yc:licenseToken"]).toBeUndefined();
    });
  });

  describe("buildWebFingerResponse", () => {
    it("builds a webfinger document", () => {
      const wf = buildWebFingerResponse({
        subject: "acct:vetclinic@vet.example.com",
        orgId: ORG,
        preferredUsername: "vetclinic",
      });
      expect(wf.subject).toBe("acct:vetclinic@vet.example.com");
      expect(wf.aliases).toEqual([ACTOR]);
      expect(wf.links).toEqual([
        { rel: "self", type: AP_CONTENT_TYPE, href: ACTOR },
      ]);
    });
  });

  describe("buildActivity", () => {
    it("wraps an object with defaults for to/cc", () => {
      const act = buildActivity({
        id: "a1",
        type: "Create",
        actorUri: ACTOR,
        object: { foo: "bar" },
      });
      expect(act["@context"]).toEqual(AP_CONTEXT);
      expect(act.id).toBe(`${BASE}/ap/activities/a1`);
      expect(act.type).toBe("Create");
      expect(act.actor).toBe(ACTOR);
      expect(act.object).toEqual({ foo: "bar" });
      expect(act.to).toEqual([]);
      expect(act.cc).toEqual([]);
      expect(typeof act.published).toBe("string");
    });

    it("passes through explicit to/cc", () => {
      const act = buildActivity({
        id: "a2",
        type: "Announce",
        actorUri: ACTOR,
        object: {},
        to: ["to-1"],
        cc: ["cc-1"],
      });
      expect(act.to).toEqual(["to-1"]);
      expect(act.cc).toEqual(["cc-1"]);
    });
  });

  describe("buildFollowActivity", () => {
    it("builds a Follow activity", () => {
      const follow = buildFollowActivity({
        id: "f1",
        fromActorUri: "https://a.example/actor",
        toActorUri: "https://b.example/actor",
      });
      expect(follow.type).toBe("Follow");
      expect(follow.actor).toBe("https://a.example/actor");
      expect(follow.object).toBe("https://b.example/actor");
      expect(follow.to).toEqual(["https://b.example/actor"]);
    });
  });

  describe("buildAcceptActivity / buildRejectActivity", () => {
    const followActivity = { actor: "https://follower.example/actor" };

    it("builds an Accept addressed to the follow actor", () => {
      const accept = buildAcceptActivity({
        id: "ac1",
        actorUri: ACTOR,
        followActivity,
      });
      expect(accept.type).toBe("Accept");
      expect(accept.actor).toBe(ACTOR);
      expect(accept.object).toBe(followActivity);
      expect(accept.to).toEqual(["https://follower.example/actor"]);
    });

    it("builds a Reject addressed to the follow actor", () => {
      const reject = buildRejectActivity({
        id: "rj1",
        actorUri: ACTOR,
        followActivity,
      });
      expect(reject.type).toBe("Reject");
      expect(reject.to).toEqual(["https://follower.example/actor"]);
    });
  });

  describe("buildUndoActivity", () => {
    it("builds an Undo wrapping the target activity", () => {
      const target = { type: "Follow" };
      const undo = buildUndoActivity({
        id: "u1",
        actorUri: ACTOR,
        targetActivity: target,
        toActorUri: "https://b.example/actor",
      });
      expect(undo.type).toBe("Undo");
      expect(undo.object).toBe(target);
      expect(undo.to).toEqual(["https://b.example/actor"]);
    });
  });

  describe("buildReferralObject", () => {
    it("builds a referral with full patient summary and context", () => {
      const referral = buildReferralObject({
        id: "ref-1",
        fromActorUri: ACTOR,
        patientSummary: {
          species: "Dog",
          breed: "Labrador",
          age: "5y",
          chiefComplaint: "Limping",
          currentMedications: ["carprofen"],
          allergies: ["none"],
        },
        urgency: "URGENT",
        clinicalContext: "Referred for imaging",
      });
      expect(referral.id).toBe(`${BASE}/ap/referrals/ref-1`);
      expect(referral.type).toBe("yc:VetReferral");
      expect(referral.attributedTo).toBe(ACTOR);
      expect(referral["yc:urgency"]).toBe("URGENT");
      expect(referral["yc:patientSummary"].species).toBe("Dog");
      expect(referral["yc:clinicalContext"]).toBe("Referred for imaging");
      expect(referral["@context"]).toEqual([
        ...AP_CONTEXT,
        { yc: "https://yosemitecrew.com/ns#" },
      ]);
    });

    it("allows omitting optional context", () => {
      const referral = buildReferralObject({
        id: "ref-2",
        fromActorUri: ACTOR,
        patientSummary: { species: "Cat", chiefComplaint: "Vomiting" },
        urgency: "ROUTINE",
      });
      expect(referral["yc:clinicalContext"]).toBeUndefined();
    });
  });

  describe("buildAgentTaskObject", () => {
    it("builds a yc:AgentTask with input and replyTo", () => {
      const task = buildAgentTaskObject({
        id: "task-1",
        fromActorUri: ACTOR,
        taskType: "capability_query",
        input: { species: "Dog" },
        replyTo: `${BASE}/ap/activities/act-1`,
      });
      expect(task.id).toBe(`${BASE}/ap/agent-tasks/task-1`);
      expect(task.type).toBe("yc:AgentTask");
      expect(task.attributedTo).toBe(ACTOR);
      expect(task["yc:taskType"]).toBe("capability_query");
      expect(task["yc:input"]).toEqual({ species: "Dog" });
      expect(task["yc:replyTo"]).toBe(`${BASE}/ap/activities/act-1`);
      expect(typeof task.published).toBe("string");
      expect(task["@context"]).toEqual([
        ...AP_CONTEXT,
        { yc: "https://yosemitecrew.com/ns#" },
      ]);
    });

    it("defaults yc:input to {} and leaves replyTo undefined when omitted", () => {
      const task = buildAgentTaskObject({
        id: "task-2",
        fromActorUri: ACTOR,
        taskType: "availability_query",
      });
      expect(task["yc:input"]).toEqual({});
      expect(task["yc:replyTo"]).toBeUndefined();
    });
  });

  describe("buildAgentTaskResultObject", () => {
    it("builds a yc:AgentTaskResult with all yc: fields and inReplyTo", () => {
      const result = buildAgentTaskResultObject({
        id: "res-1",
        fromActorUri: ACTOR,
        taskType: "capability_query",
        inReplyTo: `${BASE}/ap/activities/act-1`,
        result: { status: "ok", capabilities: { name: "Clinic" } },
      });
      expect(result.id).toBe(`${BASE}/ap/agent-task-results/res-1`);
      expect(result.type).toBe("yc:AgentTaskResult");
      expect(result.attributedTo).toBe(ACTOR);
      expect(result["yc:taskType"]).toBe("capability_query");
      expect(result.inReplyTo).toBe(`${BASE}/ap/activities/act-1`);
      expect(result["yc:result"]).toEqual({
        status: "ok",
        capabilities: { name: "Clinic" },
      });
      expect(typeof result.published).toBe("string");
      expect(result["@context"]).toEqual([
        ...AP_CONTEXT,
        { yc: "https://yosemitecrew.com/ns#" },
      ]);
    });
  });

  describe("buildOfferActivity", () => {
    it("builds an Offer wrapping a referral object", () => {
      const referral = { id: "ref", type: "yc:VetReferral" };
      const offer = buildOfferActivity({
        id: "o1",
        fromActorUri: ACTOR,
        toActorUri: "https://b.example/actor",
        referralObject: referral,
      });
      expect(offer.type).toBe("Offer");
      expect(offer.object).toBe(referral);
      expect(offer.to).toEqual(["https://b.example/actor"]);
    });
  });

  describe("buildNoteActivity", () => {
    it("builds a Create wrapping a Note, with inReplyTo", () => {
      const create = buildNoteActivity({
        id: "n1",
        actorUri: ACTOR,
        toActorUri: "https://b.example/actor",
        content: "Hello there",
        inReplyTo: `${BASE}/ap/notes/prev`,
      });
      expect(create.type).toBe("Create");
      expect(create.id).toBe(`${BASE}/ap/activities/n1-create`);
      const note = create.object as Record<string, unknown>;
      expect(note.id).toBe(`${BASE}/ap/notes/n1`);
      expect(note.type).toBe("Note");
      expect(note.content).toBe("Hello there");
      expect(note.inReplyTo).toBe(`${BASE}/ap/notes/prev`);
      expect(note.to).toEqual(["https://b.example/actor"]);
    });

    it("leaves inReplyTo undefined when omitted", () => {
      const create = buildNoteActivity({
        id: "n2",
        actorUri: ACTOR,
        toActorUri: "https://b.example/actor",
        content: "No reply",
      });
      const note = create.object as Record<string, unknown>;
      expect(note.inReplyTo).toBeUndefined();
    });
  });

  describe("buildAnnounceActivity", () => {
    it("marks an emergency announcement with a summary", () => {
      const announce = buildAnnounceActivity({
        id: "an1",
        actorUri: ACTOR,
        followersUri: `${ACTOR}/followers`,
        objectUri: `${BASE}/ap/notes/an1`,
        content: "Emergency case",
        urgency: "EMERGENCY",
      });
      expect(announce.type).toBe("Announce");
      expect(announce.to).toEqual([
        "https://www.w3.org/ns/activitystreams#Public",
      ]);
      expect(announce.cc).toEqual([`${ACTOR}/followers`]);
      const note = announce.object as Record<string, unknown>;
      expect(note.summary).toBe("[EMERGENCY]");
      expect(note.cc).toEqual([`${ACTOR}/followers`]);
    });

    it("omits the summary for non-emergency announcements", () => {
      const announce = buildAnnounceActivity({
        id: "an2",
        actorUri: ACTOR,
        followersUri: `${ACTOR}/followers`,
        objectUri: `${BASE}/ap/notes/an2`,
        content: "Routine update",
      });
      const note = announce.object as Record<string, unknown>;
      expect(note.summary).toBeUndefined();
    });
  });

  describe("buildOrderedCollection", () => {
    it("builds a collection with explicit items and first page", () => {
      const col = buildOrderedCollection({
        id: `${ACTOR}/followers`,
        totalItems: 2,
        items: ["a", "b"],
        first: `${ACTOR}/followers?page=1`,
      });
      expect(col.type).toBe("OrderedCollection");
      expect(col.totalItems).toBe(2);
      expect(col.orderedItems).toEqual(["a", "b"]);
      expect(col.first).toBe(`${ACTOR}/followers?page=1`);
      expect(col["@context"]).toEqual(AP_CONTEXT);
    });

    it("defaults to an empty items list", () => {
      const col = buildOrderedCollection({
        id: `${ACTOR}/followers`,
        totalItems: 0,
      });
      expect(col.orderedItems).toEqual([]);
      expect(col.first).toBeUndefined();
    });
  });

  describe("generateActivityId", () => {
    it("returns a unique UUID each call", () => {
      const a = generateActivityId();
      const b = generateActivityId();
      expect(a).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(a).not.toBe(b);
    });
  });
});
