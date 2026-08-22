import { prisma, Prisma } from "@yosemite-crew/database";
import {
  APActor,
  APFollowerState,
  APFollowingState,
  APDirection,
} from "@prisma/client";
import axios from "axios";
import { addCachedPromise, type CachedPromise } from "@yosemite-crew/lib";
import logger from "src/utils/logger";
import {
  actorUri,
  inboxUri,
  outboxUri,
  followersUri,
  followingUri,
  publicKeyId,
  sharedInboxUri,
  buildActivity,
  buildActorObject,
  buildAgentTaskObject,
  buildWebFingerResponse,
  buildOrderedCollection,
  buildFollowActivity,
  buildAcceptActivity,
  buildRejectActivity,
  buildUndoActivity,
  buildOfferActivity,
  buildReferralObject,
  buildNoteActivity,
  buildAnnounceActivity,
  generateActivityId,
  AP_CONTENT_TYPE,
  apBaseUrl,
} from "src/utils/activitypub-builder";
import {
  generateRsaKeyPair,
  encryptPrivateKey,
} from "./activitypub-crypto.service";
import {
  assertPublicHttpsUrl,
  guardedHttpsAgent,
} from "src/utils/ap-url-guard";
import { ApDeliveryQueue } from "src/queues/ap-delivery.queue";

// ─── Actor management ─────────────────────────────────────────────────────────

export async function getOrCreateActor(orgId: string): Promise<APActor> {
  const existing = await prisma.aPActor.findUnique({
    where: { organisationId: orgId },
  });
  if (existing) return existing;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });
  const { publicKeyPem, privateKeyPem } = generateRsaKeyPair();
  const encryptedPrivate = encryptPrivateKey(privateKeyPem);
  // preferredUsername is globally unique, but organisation names are not.
  // Deriving it from the name alone meant two clinics called "Happy Paws",
  // names differing only in punctuation, or any name with no Latin characters
  // (which normalises to nothing) collided, and actor creation for the second
  // clinic failed on the unique constraint. A stable slice of the organisation
  // id disambiguates, and "clinic" covers an empty normalisation.
  // Split/filter/join rather than a trim regex: `/^_+|_+$/` is super-linear on
  // a long run of separators, and this says the same thing without backtracking.
  const base = org.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .split("_")
    .filter(Boolean)
    .join("_");
  const username = `${base || "clinic"}_${orgId.replaceAll("-", "").slice(0, 8)}`;
  const uri = actorUri(orgId);

  return prisma.aPActor.create({
    data: {
      organisationId: orgId,
      uri,
      preferredUsername: username,
      publicKeyPem,
      privateKeyPem: encryptedPrivate,
      publicKeyId: publicKeyId(orgId),
      inboxUri: inboxUri(orgId),
      outboxUri: outboxUri(orgId),
      followersUri: followersUri(orgId),
      followingUri: followingUri(orgId),
      sharedInboxUri: sharedInboxUri(),
      summary: `${org.name} — Yosemite Crew`,
      iconUrl: org.imageUrl ?? undefined,
    },
  });
}

export async function getActorByOrgId(orgId: string): Promise<APActor | null> {
  return prisma.aPActor.findUnique({ where: { organisationId: orgId } });
}

export async function getActorByUri(uri: string): Promise<APActor | null> {
  return prisma.aPActor.findUnique({ where: { uri } });
}

export async function getActorByUsername(
  username: string,
): Promise<APActor | null> {
  return prisma.aPActor.findUnique({ where: { preferredUsername: username } });
}

export async function buildActorResponse(orgId: string) {
  const actor = await getOrCreateActor(orgId);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });
  return buildActorObject({
    orgId,
    preferredUsername: actor.preferredUsername,
    name: org.name,
    summary: actor.summary ?? undefined,
    iconUrl: actor.iconUrl ?? undefined,
    publicKeyPem: actor.publicKeyPem,
    licenseToken: actor.licenseToken,
  });
}

// ─── WebFinger ────────────────────────────────────────────────────────────────

const ACCT_RESOURCE_RE = /^acct:([^@]+)@(.+)$/;

export async function resolveWebFinger(resource: string) {
  const acctMatch = ACCT_RESOURCE_RE.exec(resource);
  if (!acctMatch) return null;

  const [, username] = acctMatch;
  const actor = await getActorByUsername(username);
  if (!actor?.organisationId) return null;

  return buildWebFingerResponse({
    subject: resource,
    orgId: actor.organisationId,
    preferredUsername: actor.preferredUsername,
  });
}

// ─── Remote actor fetching ────────────────────────────────────────────────────

const MAX_ACTOR_DOCUMENT_BYTES = 256 * 1024;

/**
 * `forceRefresh` bypasses the 24h cache. Needed because a remote instance that
 * rotates its ActivityPub signing key would otherwise have every signed request
 * rejected until the cached copy expired - see the retry in verifyInboundRequest.
 */
export async function fetchRemoteActor(
  uri: string,
  opts?: { forceRefresh?: boolean },
) {
  const cached = opts?.forceRefresh
    ? null
    : await prisma.aPRemoteActor.findUnique({ where: { uri } });
  const staleAfterMs = 24 * 60 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt.getTime() < staleAfterMs) {
    return cached;
  }

  await assertPublicHttpsUrl(uri);

  const resp = await axios.get<{
    id: string;
    preferredUsername: string;
    inbox: string;
    endpoints?: { sharedInbox?: string };
    publicKey: { id: string; publicKeyPem: string };
    "yc:licenseToken"?: string;
  }>(uri, {
    headers: { Accept: AP_CONTENT_TYPE },
    timeout: 10_000,
    maxRedirects: 0,
    httpsAgent: guardedHttpsAgent,
    // Axios defaults both of these to unlimited. The URL is remote-controlled,
    // so without a cap a host could stream a very large JSON body inside the
    // timeout and exhaust worker memory before parsing finished. An actor
    // document is a few kilobytes; 256 KiB is already generous.
    maxContentLength: MAX_ACTOR_DOCUMENT_BYTES,
    maxBodyLength: MAX_ACTOR_DOCUMENT_BYTES,
  });

  const data = resp.data;

  // Bind the fetched document to the URL it came from: an actor may only
  // declare an id and key hosted on the same origin it is served from.
  // Without this, any public host could serve a document claiming another
  // instance's actor id (with its own key) and impersonate that instance.
  const fetchedOrigin = new URL(uri).origin;
  let declaredActorOrigin: string;
  let declaredKeyOrigin: string;
  try {
    declaredActorOrigin = new URL(data.id).origin;
    declaredKeyOrigin = new URL(data.publicKey.id).origin;
  } catch {
    throw new Error(`Remote actor ${uri} declares a malformed id or key id`);
  }
  if (
    declaredActorOrigin !== fetchedOrigin ||
    declaredKeyOrigin !== fetchedOrigin
  ) {
    throw new Error(
      `Remote actor origin mismatch: fetched from ${fetchedOrigin} but id/key claim a different origin`,
    );
  }

  const instanceHost = new URL(uri).host;
  const now = new Date();

  const remote = {
    uri: data.id,
    preferredUsername: data.preferredUsername,
    publicKeyPem: data.publicKey.publicKeyPem,
    publicKeyId: data.publicKey.id,
    inboxUri: data.inbox,
    sharedInboxUri: data.endpoints?.sharedInbox ?? null,
    instanceHost,
    fetchedAt: now,
    lastSeenAt: now,
    licenseToken: data["yc:licenseToken"] ?? null,
  };

  return prisma.aPRemoteActor.upsert({
    where: { uri: data.id },
    create: remote,
    update: { ...remote },
  });
}

// ─── Followers / Following collections ───────────────────────────────────────

export async function getFollowersCollection(orgId: string) {
  const actor = await getOrCreateActor(orgId);
  const rows = await prisma.aPFollower.findMany({
    where: { localActorId: actor.id, state: APFollowerState.APPROVED },
    select: { remoteActorUri: true },
    orderBy: { createdAt: "desc" },
  });

  return buildOrderedCollection({
    id: followersUri(orgId),
    totalItems: rows.length,
    items: rows.map((r) => r.remoteActorUri),
  });
}

export async function getFollowingCollection(orgId: string) {
  const actor = await getOrCreateActor(orgId);
  const rows = await prisma.aPFollowing.findMany({
    where: { localActorId: actor.id, state: APFollowingState.ACCEPTED },
    select: { remoteActorUri: true },
    orderBy: { createdAt: "desc" },
  });

  return buildOrderedCollection({
    id: followingUri(orgId),
    totalItems: rows.length,
    items: rows.map((r) => r.remoteActorUri),
  });
}

const AS_PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

/**
 * True only when an activity is explicitly addressed to the ActivityStreams
 * public collection.
 *
 * The outbox endpoint is unauthenticated by design, and it used to serve the
 * raw JSON of every recent outbound activity. Referral Offers carry patient
 * species, medications, allergies, chief complaint and clinical context, and
 * Notes carry private messages, so anyone who knew an organisation id could
 * read them. Only Announce (the emergency broadcast) is addressed to Public;
 * everything else is directed and must never appear here.
 */
function isPubliclyAddressed(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const { to, cc } = raw as { to?: unknown; cc?: unknown };
  // Built with a loop rather than a flatMap of nested ternaries: `to` and `cc`
  // may each be absent, a single value, or an array, and Array.isArray narrows
  // `unknown` to `any[]`, which would leak `any` out of the helper.
  const audience: unknown[] = [];
  for (const field of [to, cc]) {
    if (Array.isArray(field)) audience.push(...(field as unknown[]));
    else if (field != null) audience.push(field);
  }
  return audience.includes(AS_PUBLIC);
}

const OUTBOX_PAGE_SIZE = 20;
// Read a wider window than we serve: filtering after a `take: 20` would let a
// burst of directed activities push every public one out of the page.
const OUTBOX_SCAN_LIMIT = 200;

/**
 * Local organisations that follow `remoteActorUri` with an accepted link.
 *
 * The shared inbox cannot resolve recipients from addressing alone. A broadcast
 * is addressed `to: Public` with the SENDER's followers collection in `cc`, so
 * neither field names a local organisation - the shared inbox found nothing to
 * queue and silently answered 202, and approved followers on a shared inbox
 * never received emergency announcements. The follow graph is the answer.
 */
export async function listFollowerOrgIdsFor(
  remoteActorUri: string,
): Promise<string[]> {
  const rows = await prisma.aPFollowing.findMany({
    where: {
      remoteActorUri,
      state: APFollowingState.ACCEPTED,
    },
    select: { localActor: { select: { organisationId: true } } },
  });

  return rows
    .map((row) => row.localActor?.organisationId)
    .filter((id): id is string => Boolean(id));
}

export async function getOutboxCollection(orgId: string) {
  const actor = await getOrCreateActor(orgId);
  const rows = await prisma.aPActivity.findMany({
    where: { localActorId: actor.id, direction: APDirection.OUTBOUND },
    orderBy: { published: "desc" },
    take: OUTBOX_SCAN_LIMIT,
    select: { rawJson: true, published: true },
  });

  const publicItems = rows
    .filter((r) => isPubliclyAddressed(r.rawJson))
    .slice(0, OUTBOX_PAGE_SIZE)
    .map((r) => r.rawJson);

  return buildOrderedCollection({
    id: outboxUri(orgId),
    totalItems: publicItems.length,
    items: publicItems,
  });
}

async function fanOutToFollowers(actor: APActor, activity: unknown) {
  const followers = await prisma.aPFollower.findMany({
    where: { localActorId: actor.id, state: APFollowerState.APPROVED },
    select: { sharedInboxUri: true, remoteInboxUri: true },
  });

  const inboxes = [
    ...new Set(followers.map((f) => f.sharedInboxUri ?? f.remoteInboxUri)),
  ];

  for (const inboxUrl of inboxes) {
    await ApDeliveryQueue.add("deliver", {
      actorId: actor.id,
      inboxUri: inboxUrl,
      activity,
    });
  }
}

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

/**
 * Federation is gated to license-verified businesses. Every outbound activity
 * that this instance *initiates* has to pass through here.
 *
 * Only sendFollow used to check, which left sendAgentTask, sendNote and
 * announceEmergency able to originate federation traffic from an unlicensed
 * instance. sendReferral was covered only indirectly, by requiring an accepted
 * follow link, which is a consent gate rather than a licence gate.
 */
async function assertVerifiedInstance(licenseToken: string | null) {
  const { isLicenseTokenValid } = await import("./ap-license.service");
  const verified = await isLicenseTokenValid(licenseToken, apBaseUrl());
  if (!verified) {
    throw new Error(
      "This instance does not have a valid federation license. Contact Yosemite Crew to get verified.",
    );
  }
}

export async function sendFollow(orgId: string, remoteActorUri: string) {
  const actor = await getOrCreateActor(orgId);

  await assertVerifiedInstance(actor.licenseToken);

  const remote = await fetchRemoteActor(remoteActorUri);
  const id = generateActivityId();
  const activity = buildFollowActivity({
    id,
    fromActorUri: actor.uri,
    toActorUri: remoteActorUri,
  });

  await prisma.aPFollowing.upsert({
    where: {
      localActorId_remoteActorUri: { localActorId: actor.id, remoteActorUri },
    },
    create: {
      localActorId: actor.id,
      remoteActorUri,
      remoteInboxUri: remote.inboxUri,
      sharedInboxUri: remote.sharedInboxUri,
      state: APFollowingState.PENDING,
    },
    update: { state: APFollowingState.PENDING },
  });

  await prisma.aPActivity.create({
    data: {
      uri: `${apBaseUrl()}/ap/activities/${id}`,
      type: "Follow",
      localActorId: actor.id,
      objectUri: remoteActorUri,
      toAddresses: [remoteActorUri],
      ccAddresses: [],
      published: new Date(),
      direction: APDirection.OUTBOUND,
      rawJson: activity as unknown as Prisma.InputJsonValue,
    },
  });

  await ApDeliveryQueue.add("deliver", {
    actorId: actor.id,
    inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
    activity,
  });

  return activity;
}

export async function sendUnfollow(orgId: string, remoteActorUri: string) {
  const actor = await getOrCreateActor(orgId);
  const following = await prisma.aPFollowing.findUnique({
    where: {
      localActorId_remoteActorUri: { localActorId: actor.id, remoteActorUri },
    },
  });
  if (!following) return null;

  const originalFollow = buildFollowActivity({
    id: generateActivityId(),
    fromActorUri: actor.uri,
    toActorUri: remoteActorUri,
  });

  const id = generateActivityId();
  const activity = buildUndoActivity({
    id,
    actorUri: actor.uri,
    targetActivity: originalFollow,
    toActorUri: remoteActorUri,
  });

  await prisma.aPFollowing.delete({
    where: {
      localActorId_remoteActorUri: { localActorId: actor.id, remoteActorUri },
    },
  });

  const remote = await prisma.aPRemoteActor.findUnique({
    where: { uri: remoteActorUri },
  });
  if (remote) {
    await ApDeliveryQueue.add("deliver", {
      actorId: actor.id,
      inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
      activity,
    });
  }

  return activity;
}

export async function approveFollower(orgId: string, remoteActorUri: string) {
  const actor = await getOrCreateActor(orgId);
  const follower = await prisma.aPFollower.findUnique({
    where: {
      localActorId_remoteActorUri: { localActorId: actor.id, remoteActorUri },
    },
  });
  if (!follower) throw new Error("Follow request not found");

  await prisma.aPFollower.update({
    where: { id: follower.id },
    data: { state: APFollowerState.APPROVED, approvedAt: new Date() },
  });

  // Echo the Follow being approved. A conforming server correlates an Accept
  // with its outstanding Follow by that object, so a freshly minted one with a
  // new id left the remote permanently pending while this instance recorded the
  // follower as approved. The inbound activity is not passed in here, so it is
  // recovered from the stored inbound activities; if it has been pruned we fall
  // back to a synthetic Follow, which is no worse than the previous behaviour.
  const recentFollows = await prisma.aPActivity.findMany({
    where: {
      localActorId: actor.id,
      direction: APDirection.INBOUND,
      type: "Follow",
    },
    orderBy: { published: "desc" },
    take: 50,
    select: { rawJson: true },
  });
  const originalFollow = recentFollows.find(
    (row) =>
      (row.rawJson as { actor?: string } | null)?.actor === remoteActorUri,
  )?.rawJson;

  const followActivity =
    originalFollow ??
    buildFollowActivity({
      id: generateActivityId(),
      fromActorUri: remoteActorUri,
      toActorUri: actor.uri,
    });
  const activity = buildAcceptActivity({
    id: generateActivityId(),
    actorUri: actor.uri,
    followActivity,
  });

  const remote = await prisma.aPRemoteActor.findUnique({
    where: { uri: remoteActorUri },
  });
  if (remote) {
    await ApDeliveryQueue.add("deliver", {
      actorId: actor.id,
      inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
      activity,
    });
  }
}

export async function rejectFollower(orgId: string, remoteActorUri: string) {
  const actor = await getOrCreateActor(orgId);
  const follower = await prisma.aPFollower.findUnique({
    where: {
      localActorId_remoteActorUri: { localActorId: actor.id, remoteActorUri },
    },
  });
  if (!follower) throw new Error("Follow request not found");

  await prisma.aPFollower.update({
    where: { id: follower.id },
    data: { state: APFollowerState.REJECTED },
  });

  const id = generateActivityId();
  const followActivity = buildFollowActivity({
    id: generateActivityId(),
    fromActorUri: remoteActorUri,
    toActorUri: actor.uri,
  });
  const activity = buildRejectActivity({
    id,
    actorUri: actor.uri,
    followActivity,
  });

  const remote = await prisma.aPRemoteActor.findUnique({
    where: { uri: remoteActorUri },
  });
  if (remote) {
    await ApDeliveryQueue.add("deliver", {
      actorId: actor.id,
      inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
      activity,
    });
  }
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export async function sendReferral(opts: {
  fromOrgId: string;
  toActorUri: string;
  patientSummary: {
    species: string;
    breed?: string;
    age?: string;
    chiefComplaint: string;
    currentMedications?: string[];
    allergies?: string[];
  };
  urgency: "ROUTINE" | "URGENT" | "EMERGENCY";
  clinicalContext?: string;
}) {
  const actor = await getOrCreateActor(opts.fromOrgId);
  await assertVerifiedInstance(actor.licenseToken);

  // Consent gate: clinical data only flows over an established (ACCEPTED) follow link
  const link = await prisma.aPFollowing.findUnique({
    where: {
      localActorId_remoteActorUri: {
        localActorId: actor.id,
        remoteActorUri: opts.toActorUri,
      },
    },
  });
  if (!link || link.state !== APFollowingState.ACCEPTED) {
    throw new Error(
      "No accepted federation link with this instance. Follow them first and wait for acceptance before sending referrals.",
    );
  }

  const remote = await fetchRemoteActor(opts.toActorUri);
  const referralId = generateActivityId();
  const activityId = generateActivityId();

  const referralObj = buildReferralObject({
    id: referralId,
    fromActorUri: actor.uri,
    patientSummary: opts.patientSummary,
    urgency: opts.urgency,
    clinicalContext: opts.clinicalContext,
  });

  const activity = buildOfferActivity({
    id: activityId,
    fromActorUri: actor.uri,
    toActorUri: opts.toActorUri,
    referralObject: referralObj,
  });

  await prisma.aPReferral.create({
    data: {
      activityUri: `${apBaseUrl()}/ap/activities/${activityId}`,
      fromActorUri: actor.uri,
      toActorUri: opts.toActorUri,
      fromOrgId: opts.fromOrgId,
      patientSummary: opts.patientSummary,
      clinicalContext: opts.clinicalContext,
      urgency: opts.urgency,
      state: "PENDING",
    },
  });

  await prisma.aPActivity.create({
    data: {
      uri: `${apBaseUrl()}/ap/activities/${activityId}`,
      type: "Offer",
      localActorId: actor.id,
      objectUri: `${apBaseUrl()}/ap/referrals/${referralId}`,
      objectJson: referralObj,
      toAddresses: [opts.toActorUri],
      ccAddresses: [],
      published: new Date(),
      direction: APDirection.OUTBOUND,
      rawJson: activity as unknown as Prisma.InputJsonValue,
    },
  });

  await ApDeliveryQueue.add("deliver", {
    actorId: actor.id,
    inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
    activity,
  });

  return activity;
}

// ─── Agent-to-agent tasks ─────────────────────────────────────────────────────

/**
 * The programmatically-answerable capabilities of a clinic: its name, type,
 * and active specialities (with the services each offers). Read-only, no
 * patient data.
 */
export async function getOrgCapabilities(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true, type: true },
  });
  const specialities = await prisma.speciality.findMany({
    where: { organisationId: orgId, isActive: true },
    select: { name: true, description: true, services: true },
    orderBy: { name: "asc" },
  });
  return {
    name: org.name,
    type: org.type,
    specialities: specialities.map((s) => ({
      name: s.name,
      description: s.description ?? undefined,
      services: s.services,
    })),
  };
}

/**
 * Sends an agent-to-agent task (an Offer wrapping a yc:AgentTask object) to a
 * remote instance. v1 is read-only capability/availability queries.
 */
export async function sendAgentTask(opts: {
  fromOrgId: string;
  toActorUri: string;
  taskType: string;
  input?: Record<string, unknown>;
}) {
  const actor = await getOrCreateActor(opts.fromOrgId);
  await assertVerifiedInstance(actor.licenseToken);
  const remote = await fetchRemoteActor(opts.toActorUri);

  const taskId = generateActivityId();
  const activityId = generateActivityId();

  const taskObject = buildAgentTaskObject({
    id: taskId,
    fromActorUri: actor.uri,
    taskType: opts.taskType,
    input: opts.input,
    replyTo: `${apBaseUrl()}/ap/activities/${activityId}`,
  });

  const activity = buildActivity({
    id: activityId,
    type: "Offer",
    actorUri: actor.uri,
    object: taskObject,
    to: [opts.toActorUri],
  });

  await ApDeliveryQueue.add("deliver", {
    actorId: actor.id,
    inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
    activity,
  });

  return { taskId, activityId };
}

// ─── Notes (cross-instance messaging) ────────────────────────────────────────

export async function sendNote(opts: {
  fromOrgId: string;
  toActorUri: string;
  content: string;
  inReplyTo?: string;
}) {
  const actor = await getOrCreateActor(opts.fromOrgId);
  await assertVerifiedInstance(actor.licenseToken);
  const remote = await fetchRemoteActor(opts.toActorUri);
  const id = generateActivityId();
  const activity = buildNoteActivity({
    id,
    actorUri: actor.uri,
    toActorUri: opts.toActorUri,
    content: opts.content,
    inReplyTo: opts.inReplyTo,
  });

  await prisma.aPActivity.create({
    data: {
      uri: `${apBaseUrl()}/ap/activities/${id}-create`,
      type: "Create",
      localActorId: actor.id,
      toAddresses: [opts.toActorUri],
      ccAddresses: [],
      published: new Date(),
      direction: APDirection.OUTBOUND,
      rawJson: activity as unknown as Prisma.InputJsonValue,
    },
  });

  await ApDeliveryQueue.add("deliver", {
    actorId: actor.id,
    inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
    activity,
  });

  return activity;
}

// ─── Emergency announce ───────────────────────────────────────────────────────

export async function announceEmergency(opts: {
  fromOrgId: string;
  content: string;
  urgency?: string;
}) {
  const actor = await getOrCreateActor(opts.fromOrgId);
  await assertVerifiedInstance(actor.licenseToken);
  const id = generateActivityId();
  const activity = buildAnnounceActivity({
    id,
    actorUri: actor.uri,
    followersUri: actor.followersUri,
    objectUri: `${apBaseUrl()}/ap/notes/${id}`,
    content: opts.content,
    urgency: opts.urgency,
  });

  await prisma.aPActivity.create({
    data: {
      uri: `${apBaseUrl()}/ap/activities/${id}`,
      type: "Announce",
      localActorId: actor.id,
      toAddresses: ["https://www.w3.org/ns/activitystreams#Public"],
      ccAddresses: [actor.followersUri],
      published: new Date(),
      direction: APDirection.OUTBOUND,
      rawJson: activity as unknown as Prisma.InputJsonValue,
    },
  });

  await fanOutToFollowers(actor, activity);
  return activity;
}

// ─── Referral management (receiving side) ────────────────────────────────────

export async function listInboundReferrals(orgId: string) {
  const actor = await getActorByOrgId(orgId);
  if (!actor) return [];

  return prisma.aPReferral.findMany({
    where: { toActorUri: actor.uri },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOutboundReferrals(orgId: string) {
  const actor = await getActorByOrgId(orgId);
  if (!actor) return [];

  return prisma.aPReferral.findMany({
    where: { fromOrgId: orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function respondToReferral(
  orgId: string,
  referralId: string,
  action: "accept" | "decline",
) {
  const actor = await getOrCreateActor(orgId);
  const referral = await prisma.aPReferral.findUniqueOrThrow({
    where: { id: referralId },
  });

  if (referral.toActorUri !== actor.uri) {
    throw new Error("Referral does not belong to this organisation");
  }
  if (referral.state !== "PENDING") {
    throw new Error(`Referral is already ${referral.state.toLowerCase()}`);
  }

  const newState = action === "accept" ? "ACCEPTED" : "DECLINED";
  const now = new Date();

  // The state change is deliberately LAST. It used to happen first, so a
  // failure in the remote actor fetch, the activity insert or the delivery
  // queue left the referral no longer PENDING while the sender never heard the
  // decision - and the guard above then refused every retry. Recording the
  // outbound response durably before flipping the state keeps the operation
  // retryable: a failure here leaves the referral exactly as it was.
  const remote = await fetchRemoteActor(referral.fromActorUri);
  const id = generateActivityId();
  const referralActivityUri = referral.activityUri;

  const responseActivity =
    action === "accept"
      ? buildAcceptActivity({
          id,
          actorUri: actor.uri,
          followActivity: {
            id: referralActivityUri,
            type: "Offer",
            actor: referral.fromActorUri,
            object: referralId,
          },
        })
      : buildRejectActivity({
          id,
          actorUri: actor.uri,
          followActivity: {
            id: referralActivityUri,
            type: "Offer",
            actor: referral.fromActorUri,
            object: referralId,
          },
        });

  await prisma.aPActivity.create({
    data: {
      uri: `${apBaseUrl()}/ap/activities/${id}`,
      type: action === "accept" ? "Accept" : "Reject",
      localActorId: actor.id,
      objectUri: referralActivityUri,
      toAddresses: [referral.fromActorUri],
      ccAddresses: [],
      published: now,
      direction: APDirection.OUTBOUND,
      rawJson: responseActivity as unknown as Prisma.InputJsonValue,
    },
  });

  await ApDeliveryQueue.add("deliver", {
    actorId: actor.id,
    inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
    activity: responseActivity,
  });

  await prisma.aPReferral.update({
    where: { id: referralId },
    data: {
      state: newState,
      ...(action === "accept" ? { acceptedAt: now } : { declinedAt: now }),
    },
  });

  return { id: referralId, state: newState };
}

export async function updateActorProfile(
  orgId: string,
  opts: { summary?: string; iconUrl?: string },
) {
  const actor = await getOrCreateActor(orgId);
  return prisma.aPActor.update({
    where: { id: actor.id },
    data: {
      ...(opts.summary === undefined ? {} : { summary: opts.summary }),
      ...(opts.iconUrl === undefined ? {} : { iconUrl: opts.iconUrl }),
    },
  });
}

export async function listFollowers(orgId: string) {
  const actor = await getActorByOrgId(orgId);
  if (!actor) return [];
  return prisma.aPFollower.findMany({
    where: { localActorId: actor.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function listFollowing(orgId: string) {
  const actor = await getActorByOrgId(orgId);
  if (!actor) return [];
  return prisma.aPFollowing.findMany({
    where: { localActorId: actor.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLicenseToken(
  orgId: string,
  token: string,
): Promise<void> {
  const { verifyLicenseToken } = await import("./ap-license.service");
  const claims = await verifyLicenseToken(token, apBaseUrl());
  if (claims.orgId !== orgId) {
    throw new Error(
      `License token orgId mismatch: token=${claims.orgId} expected=${orgId}`,
    );
  }
  const actor = await getOrCreateActor(orgId);
  await prisma.aPActor.update({
    where: { id: actor.id },
    data: { licenseToken: token },
  });
}

export async function getLicenseTokenStatus(
  orgId: string,
): Promise<"none" | "valid" | "invalid"> {
  const { isLicenseTokenValid } = await import("./ap-license.service");
  const actor = await getActorByOrgId(orgId);
  if (!actor?.licenseToken) return "none";
  const valid = await isLicenseTokenValid(actor.licenseToken, apBaseUrl());
  return valid ? "valid" : "invalid";
}

// ─── Directory (federation clinic directory via the SuperAdmin authority) ─────

export interface DirectoryClinic {
  actorUri: string;
  orgName: string;
  instanceHost: string;
  handle: string;
}

function directoryAuthorityBase(): string {
  return (
    process.env.AP_LICENSE_AUTHORITY_URL ?? "https://api.yosemitecrew.com"
  ).replace(/\/$/, "");
}

const DIRECTORY_CACHE_TTL_MS = 60_000;
const directoryCache = new Map<string, CachedPromise<DirectoryClinic[]>>();
const DIRECTORY_CACHE_OPTIONS = { maxEntries: 8, pruneIntervalMs: 60_000 };

/**
 * Builds the webfinger-style `@user@host` handle other clinics see in the
 * directory. Falls back to the bare username if the actor URI is unparseable,
 * which should not happen for an actor we minted ourselves.
 */
function buildActorHandle(actorUri: string, preferredUsername: string): string {
  try {
    return `@${preferredUsername}@${new URL(actorUri).hostname}`;
  } catch {
    return `@${preferredUsername}`;
  }
}

/**
 * Toggle this organisation's presence in the SuperAdmin federation directory.
 * Requires a verified organisation and a stored license token; mirrors the
 * change to the authority using the org's own bearer token.
 */
export async function setDirectoryListing(
  orgId: string,
  listed: boolean,
): Promise<{ listed: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isVerified: true, name: true },
  });
  if (!org?.isVerified) {
    throw new Error(
      "Organisation must be verified before it can be listed in the federation directory.",
    );
  }

  const actor = await getOrCreateActor(orgId);
  if (!actor.licenseToken) {
    throw new Error(
      "This instance does not have a federation license token. Add one before managing the directory listing.",
    );
  }

  // The authority is told first, and the local flag is only persisted once it
  // accepts. Writing locally first would leave the settings toggle claiming the
  // clinic is listed whenever the authority is unreachable, which is the one
  // state a user cannot diagnose or correct from the UI.
  const res = await fetch(`${directoryAuthorityBase()}/api/directory/listing`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${actor.licenseToken}`,
      "Content-Type": "application/json",
    },
    // The authority holds no organisation names, so the display fields travel
    // with the request. It binds `instanceHost` from the license token itself
    // and rejects an `actorUri` on any other host, so these are display data
    // rather than anything the authority trusts for identity.
    body: JSON.stringify(
      listed
        ? {
            listed,
            actorUri: actor.uri,
            orgName: org.name,
            handle: buildActorHandle(actor.uri, actor.preferredUsername),
          }
        : { listed },
    ),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Directory authority responded HTTP ${res.status}`);
  }

  await prisma.aPActor.update({
    where: { id: actor.id },
    data: { directoryListed: listed },
  });

  return { listed };
}

/**
 * Read the federation clinic directory from the SuperAdmin authority, cached
 * in-memory for ~60s. Resilient: if the authority is unreachable, returns an
 * empty list so the directory page renders an empty state rather than erroring.
 */
export async function listDirectory(
  orgId: string,
): Promise<{ clinics: DirectoryClinic[] }> {
  const actor = await getActorByOrgId(orgId);
  const licenseToken = actor?.licenseToken;

  try {
    const clinics = await addCachedPromise(
      directoryCache,
      // Keyed per org, not a single shared "directory" key. The fetch is made
      // with the calling org's license token, so one global entry let an
      // unlicensed org read the copy a licensed one had just warmed.
      orgId,
      DIRECTORY_CACHE_TTL_MS,
      async () => {
        const res = await fetch(`${directoryAuthorityBase()}/api/directory`, {
          headers: {
            ...(licenseToken
              ? { Authorization: `Bearer ${licenseToken}` }
              : {}),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          throw new Error(`Directory authority responded HTTP ${res.status}`);
        }
        const data = (await res.json()) as { clinics?: DirectoryClinic[] };
        return data.clinics ?? [];
      },
      DIRECTORY_CACHE_OPTIONS,
    );
    return { clinics };
  } catch (err) {
    logger.error("[AP] listDirectory error", { err });
    return { clinics: [] };
  }
}

/**
 * Actor settings plus the flags the directory-listing toggle needs:
 * whether the organisation is verified and whether it is currently listed.
 */
export async function getActorSettingsData(orgId: string): Promise<{
  actor: APActor;
  licenseTokenStatus: "none" | "valid" | "invalid";
  isVerified: boolean;
  directoryListed: boolean;
}> {
  const [actor, licenseTokenStatus, org] = await Promise.all([
    getOrCreateActor(orgId),
    getLicenseTokenStatus(orgId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { isVerified: true },
    }),
  ]);
  return {
    actor,
    licenseTokenStatus,
    isVerified: org?.isVerified ?? false,
    directoryListed: actor.directoryListed,
  };
}

export type { APActor };
