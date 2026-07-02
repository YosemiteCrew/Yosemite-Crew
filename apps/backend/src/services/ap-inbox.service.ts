import { prisma, Prisma } from "@yosemite-crew/database";
import { APFollowerState, APFollowingState, APDirection } from "@prisma/client";
import { isLicenseTokenValid } from "./ap-license.service";
import logger from "src/utils/logger";
import {
  parseSignatureHeader,
  verifySignature,
  verifyBodyDigest,
} from "src/utils/http-signature";
import {
  fetchRemoteActor,
  getActorByOrgId,
  getOrCreateActor,
} from "./activitypub.service";
import { apBaseUrl, generateActivityId } from "src/utils/activitypub-builder";
import { ApDeliveryQueue } from "src/queues/ap-delivery.queue";
import {
  buildAcceptActivity,
  buildFollowActivity,
} from "src/utils/activitypub-builder";
import { decryptPrivateKey } from "./activitypub-crypto.service";

type AnyActivity = {
  "@context"?: unknown;
  id?: string;
  type: string;
  actor: string;
  object?: unknown;
  to?: string | string[];
  cc?: string | string[];
};

// ─── Signature verification ───────────────────────────────────────────────────

export async function verifyInboundRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}): Promise<boolean> {
  const sigHeader = opts.headers["signature"];
  if (!sigHeader) return false;

  const digestHeader = opts.headers["digest"];
  if (digestHeader && !verifyBodyDigest(opts.body, digestHeader)) return false;

  const components = parseSignatureHeader(sigHeader);
  if (!components.keyId) return false;

  const keyOwnerUri = components.keyId.split("#")[0];

  try {
    const remote = await fetchRemoteActor(keyOwnerUri);
    return verifySignature({
      publicKeyPem: remote.publicKeyPem,
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      sigComponents: components,
    });
  } catch {
    return false;
  }
}

// ─── Activity dispatcher ──────────────────────────────────────────────────────

export async function dispatchInboundActivity(
  targetOrgId: string,
  activity: AnyActivity,
): Promise<void> {
  const actor = await getOrCreateActor(targetOrgId);

  await prisma.aPActivity.upsert({
    where: { uri: activity.id ?? `urn:unknown:${generateActivityId()}` },
    create: {
      uri: activity.id ?? `urn:unknown:${generateActivityId()}`,
      type: activity.type,
      localActorId: actor.id,
      objectUri:
        typeof activity.object === "string" ? activity.object : undefined,
      objectJson:
        typeof activity.object === "object"
          ? (activity.object as object)
          : undefined,
      toAddresses: toArray(activity.to),
      ccAddresses: toArray(activity.cc),
      published: new Date(),
      direction: APDirection.INBOUND,
      processed: false,
      rawJson: activity as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });

  switch (activity.type) {
    case "Follow":
      return handleFollow(targetOrgId, activity);
    case "Accept":
      return handleAccept(targetOrgId, activity);
    case "Reject":
      return handleReject(targetOrgId, activity);
    case "Undo":
      return handleUndo(targetOrgId, activity);
    case "Offer":
      return handleOffer(targetOrgId, activity);
    case "Create":
      return handleCreate(targetOrgId, activity);
    case "Announce":
      return handleAnnounce(targetOrgId, activity);
    default:
      logger.info(`[AP inbox] Unhandled activity type: ${activity.type}`, {
        actor: activity.actor,
      });
  }
}

// ─── Follow ───────────────────────────────────────────────────────────────────

async function handleFollow(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getOrCreateActor(targetOrgId);
  const remoteActorUri = activity.actor;

  try {
    const remote = await fetchRemoteActor(remoteActorUri);

    // Reject follows from unverified instances — only verified businesses may federate
    const verified = await isLicenseTokenValid(
      remote.licenseToken,
      remoteActorUri,
    );
    if (!verified) {
      logger.warn("[AP inbox] rejected Follow from unverified instance", {
        remoteActorUri,
      });
      return;
    }

    await prisma.aPFollower.upsert({
      where: {
        localActorId_remoteActorUri: {
          localActorId: localActor.id,
          remoteActorUri,
        },
      },
      create: {
        localActorId: localActor.id,
        remoteActorUri,
        remoteInboxUri: remote.inboxUri,
        sharedInboxUri: remote.sharedInboxUri,
        state: APFollowerState.PENDING,
      },
      update: { state: APFollowerState.PENDING },
    });

    const autoApprove = process.env.AP_AUTO_APPROVE_FOLLOWS === "true";
    if (autoApprove) {
      await prisma.aPFollower.update({
        where: {
          localActorId_remoteActorUri: {
            localActorId: localActor.id,
            remoteActorUri,
          },
        },
        data: { state: APFollowerState.APPROVED, approvedAt: new Date() },
      });

      const acceptId = generateActivityId();
      const followObj = buildFollowActivity({
        id: generateActivityId(),
        fromActorUri: remoteActorUri,
        toActorUri: localActor.uri,
      });
      const acceptActivity = buildAcceptActivity({
        id: acceptId,
        actorUri: localActor.uri,
        followActivity: followObj,
      });

      await ApDeliveryQueue.add("deliver", {
        actorId: localActor.id,
        inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
        activity: acceptActivity,
      });
    }
  } catch (err) {
    logger.error("[AP inbox] handleFollow error", { err, remoteActorUri });
  }
}

// ─── Accept ───────────────────────────────────────────────────────────────────

async function handleAccept(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getActorByOrgId(targetOrgId);
  if (!localActor) return;

  const obj = activity.object as { actor?: string } | string | undefined;
  const followedBy =
    typeof obj === "object" && obj?.actor ? obj.actor : activity.actor;

  await prisma.aPFollowing.updateMany({
    where: { localActorId: localActor.id, remoteActorUri: followedBy },
    data: { state: APFollowingState.ACCEPTED },
  });
}

// ─── Reject ───────────────────────────────────────────────────────────────────

async function handleReject(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getActorByOrgId(targetOrgId);
  if (!localActor) return;

  const obj = activity.object as { actor?: string } | string | undefined;
  const rejectedBy =
    typeof obj === "object" && obj?.actor ? obj.actor : activity.actor;

  await prisma.aPFollowing.updateMany({
    where: { localActorId: localActor.id, remoteActorUri: rejectedBy },
    data: { state: APFollowingState.REJECTED },
  });
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

async function handleUndo(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getOrCreateActor(targetOrgId);
  const remoteActorUri = activity.actor;
  const inner = activity.object as { type?: string } | undefined;

  if (inner?.type === "Follow") {
    await prisma.aPFollower.deleteMany({
      where: { localActorId: localActor.id, remoteActorUri },
    });
  }
}

// ─── Offer (Referral) ─────────────────────────────────────────────────────────

async function handleOffer(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getOrCreateActor(targetOrgId);
  const obj = activity.object as
    | {
        type?: string;
        "yc:urgency"?: string;
        "yc:patientSummary"?: unknown;
        "yc:clinicalContext"?: string;
      }
    | undefined;

  if (!obj || obj.type !== "yc:VetReferral") return;

  await prisma.aPReferral.upsert({
    where: {
      activityUri: activity.id ?? `urn:unknown:${generateActivityId()}`,
    },
    create: {
      activityUri: activity.id ?? `urn:unknown:${generateActivityId()}`,
      fromActorUri: activity.actor,
      toActorUri: localActor.uri,
      toOrgId: targetOrgId,
      patientSummary: (obj["yc:patientSummary"] as object) ?? {},
      clinicalContext: obj["yc:clinicalContext"],
      urgency:
        (obj["yc:urgency"] as "ROUTINE" | "URGENT" | "EMERGENCY") ?? "ROUTINE",
      state: "PENDING",
    },
    update: {},
  });
}

// ─── Create (Note) ────────────────────────────────────────────────────────────

async function handleCreate(targetOrgId: string, activity: AnyActivity) {
  const obj = activity.object as
    | {
        type?: string;
        content?: string;
        attributedTo?: string;
      }
    | undefined;

  if (obj?.type !== "Note" || !obj.content) return;

  logger.info("[AP inbox] Received Note", {
    from: activity.actor,
    toOrg: targetOrgId,
    contentLength: obj.content.length,
  });
}

// ─── Announce ─────────────────────────────────────────────────────────────────

async function handleAnnounce(targetOrgId: string, activity: AnyActivity) {
  logger.info("[AP inbox] Received Announce", {
    from: activity.actor,
    toOrg: targetOrgId,
    objectType: typeof activity.object,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export { AnyActivity };
