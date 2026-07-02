import { prisma, Prisma } from "@yosemite-crew/database";
import {
  APActor,
  APFollowerState,
  APFollowingState,
  APDirection,
} from "@prisma/client";
import axios from "axios";
import logger from "src/utils/logger";
import {
  actorUri,
  inboxUri,
  outboxUri,
  followersUri,
  followingUri,
  publicKeyId,
  sharedInboxUri,
  buildActorObject,
  buildWebFingerResponse,
  buildNodeInfo,
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
  decryptPrivateKey,
} from "./activitypub-crypto.service";
import { signRequest } from "src/utils/http-signature";
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
  const username = org.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
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

export async function resolveWebFinger(resource: string) {
  const acctMatch = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!acctMatch) return null;

  const [, username] = acctMatch;
  const actor = await getActorByUsername(username);
  if (!actor || !actor.organisationId) return null;

  return buildWebFingerResponse({
    subject: resource,
    orgId: actor.organisationId,
    preferredUsername: actor.preferredUsername,
  });
}

// ─── NodeInfo ─────────────────────────────────────────────────────────────────

export async function buildNodeInfoResponse() {
  const count = await prisma.aPActor.count();
  const host = new URL(apBaseUrl()).host;
  return buildNodeInfo({ instanceHost: host, actorCount: count });
}

// ─── Remote actor fetching ────────────────────────────────────────────────────

export async function fetchRemoteActor(uri: string) {
  const cached = await prisma.aPRemoteActor.findUnique({ where: { uri } });
  const staleAfterMs = 24 * 60 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt.getTime() < staleAfterMs) {
    return cached;
  }

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
  });

  const data = resp.data;
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

export async function getOutboxCollection(orgId: string) {
  const actor = await getOrCreateActor(orgId);
  const rows = await prisma.aPActivity.findMany({
    where: { localActorId: actor.id, direction: APDirection.OUTBOUND },
    orderBy: { published: "desc" },
    take: 20,
    select: { rawJson: true, published: true },
  });

  return buildOrderedCollection({
    id: outboxUri(orgId),
    totalItems: rows.length,
    items: rows.map((r) => r.rawJson),
  });
}

// ─── Delivery helper ──────────────────────────────────────────────────────────

export async function deliverActivity(opts: {
  actor: APActor;
  targetInboxUri: string;
  activity: unknown;
}) {
  const body = JSON.stringify(opts.activity);
  const privateKeyPem = decryptPrivateKey(opts.actor.privateKeyPem);
  const signedHeaders = signRequest({
    privateKeyPem,
    keyId: opts.actor.publicKeyId,
    method: "POST",
    url: opts.targetInboxUri,
    body,
  });

  await axios.post(opts.targetInboxUri, body, {
    headers: {
      "Content-Type": AP_CONTENT_TYPE,
      ...signedHeaders,
    },
    timeout: 15_000,
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

export async function sendFollow(orgId: string, remoteActorUri: string) {
  const actor = await getOrCreateActor(orgId);

  // Only verified instances may initiate federation
  const { isLicenseTokenValid } = await import("./ap-license.service");
  const verified = await isLicenseTokenValid(actor.licenseToken, apBaseUrl());
  if (!verified) {
    throw new Error(
      "This instance does not have a valid federation license. Contact Yosemite Crew to get verified.",
    );
  }

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

  const id = generateActivityId();
  const followActivity = buildFollowActivity({
    id: generateActivityId(),
    fromActorUri: remoteActorUri,
    toActorUri: actor.uri,
  });
  const activity = buildAcceptActivity({
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

// ─── Notes (cross-instance messaging) ────────────────────────────────────────

export async function sendNote(opts: {
  fromOrgId: string;
  toActorUri: string;
  content: string;
  inReplyTo?: string;
}) {
  const actor = await getOrCreateActor(opts.fromOrgId);
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

  await prisma.aPReferral.update({
    where: { id: referralId },
    data: {
      state: newState,
      ...(action === "accept" ? { acceptedAt: now } : { declinedAt: now }),
    },
  });

  // Send Accept or Reject activity back to the sender
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
      ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
      ...(opts.iconUrl !== undefined ? { iconUrl: opts.iconUrl } : {}),
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

export type { APActor };
export { decryptPrivateKey };
