import { prisma, Prisma } from "@yosemite-crew/database";
import {
  APFollowerState,
  APFollowingState,
  APReferralState,
  APDirection,
} from "@prisma/client";
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
  getOrgCapabilities,
} from "./activitypub.service";
import {
  buildAcceptActivity,
  buildActivity,
  buildAgentTaskResultObject,
  generateActivityId,
} from "src/utils/activitypub-builder";
import { ApDeliveryQueue } from "src/queues/ap-delivery.queue";

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

const REQUIRED_SIGNED_HEADERS = ["(request-target)", "host", "date", "digest"];
const REPLAY_WINDOW_SECONDS = 300;

export async function verifyInboundRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}): Promise<{ ok: boolean; signerUri?: string }> {
  const sigHeader = opts.headers["signature"];
  if (!sigHeader) return { ok: false };

  // A Digest header is mandatory on all inbox POSTs, verified over raw bytes.
  const digestHeader = opts.headers["digest"];
  if (!digestHeader || !verifyBodyDigest(opts.body, digestHeader)) {
    return { ok: false };
  }

  // Replay protection: reject stale or missing Date.
  const dateHeader = opts.headers["date"];
  if (!dateHeader) return { ok: false };
  const dateMs = Date.parse(dateHeader);
  if (Number.isNaN(dateMs)) return { ok: false };
  if (Math.abs(Date.now() - dateMs) > REPLAY_WINDOW_SECONDS * 1000) {
    return { ok: false };
  }

  const components = parseSignatureHeader(sigHeader);
  if (!components.keyId) return { ok: false };

  // The signature must cover at least (request-target), host, date, digest.
  const signedHeaderSet = new Set(
    components.headers.map((h) => h.toLowerCase()),
  );
  for (const required of REQUIRED_SIGNED_HEADERS) {
    if (!signedHeaderSet.has(required)) return { ok: false };
  }

  const keyOwnerUri = components.keyId.split("#")[0];

  // A cached actor key is reused for 24 hours. When a legitimate remote rotates
  // its signing key, every signed request it sends is rejected until that
  // expires, so one forced refresh is attempted before giving up.
  //
  // Guarded on the record's age so a flood of forged signatures cannot be used
  // to make this instance hammer a remote host: once refreshed, fetchedAt is
  // recent and further failures skip the retry.
  const REFRESH_MIN_AGE_MS = 60 * 1000;

  const attempt = (remote: {
    publicKeyPem: string;
    publicKeyId: string;
    uri: string;
  }) => {
    const signatureValid = verifySignature({
      publicKeyPem: remote.publicKeyPem,
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      sigComponents: components,
    });
    // The keyId must be the actor's advertised key — no key confusion.
    return signatureValid && remote.publicKeyId === components.keyId;
  };

  try {
    const remote = await fetchRemoteActor(keyOwnerUri);
    if (attempt(remote)) return { ok: true, signerUri: remote.uri };

    if (Date.now() - remote.fetchedAt.getTime() < REFRESH_MIN_AGE_MS) {
      return { ok: false };
    }

    const refreshed = await fetchRemoteActor(keyOwnerUri, {
      forceRefresh: true,
    });
    if (attempt(refreshed)) return { ok: true, signerUri: refreshed.uri };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// ─── Activity dispatcher ──────────────────────────────────────────────────────

export async function dispatchInboundActivity(
  targetOrgId: string,
  activity: AnyActivity,
): Promise<void> {
  const actor = await getOrCreateActor(targetOrgId);

  // Real ActivityPub activities always carry a stable id. Reject id-less
  // activities instead of synthesising a random one, which would let a
  // replayed request create a fresh row (and re-run its handler) every time.
  if (typeof activity.id !== "string" || activity.id.length === 0) {
    logger.warn("[AP inbox] dropping activity without an id", {
      type: activity.type,
      actor: activity.actor,
    });
    return;
  }

  // Idempotency / replay defence: only run a handler the first time an
  // activity id is seen. An existing-but-unprocessed row means an earlier
  // attempt failed and is being retried; a processed row means this is a
  // replay (e.g. a captured signed request resent within the date window).
  const existing = await prisma.aPActivity.findUnique({
    where: { uri: activity.id },
    select: { processed: true },
  });
  if (existing?.processed) {
    logger.info("[AP inbox] ignoring already-processed activity", {
      uri: activity.id,
    });
    return;
  }
  if (!existing) {
    try {
      await prisma.aPActivity.create({
        data: {
          uri: activity.id,
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
      });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
      // Lost the insert race. Continuing here ran the handler in BOTH callers,
      // which could enqueue two auto-approval Accepts or two AgentTask results
      // despite the replay defence above. The winner owns this activity; if it
      // dies before marking it processed the row is left unprocessed, and the
      // queue's retry picks it up through the `existing` branch above.
      logger.info("[AP inbox] concurrent delivery won the insert, skipping", {
        uri: activity.id,
      });
      return;
    }
  }

  await runInboundHandler(targetOrgId, activity);

  await prisma.aPActivity.update({
    where: { uri: activity.id },
    data: { processed: true },
  });
}

async function runInboundHandler(
  targetOrgId: string,
  activity: AnyActivity,
): Promise<void> {
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

/**
 * The federation trust gate, in one place.
 *
 * Follow, referral Offer and AgentTask each need the same decision: resolve the
 * remote actor, then confirm its licence is still valid for that actor URI.
 * Three copies meant a change to federation policy had to be applied in three
 * places to take effect. Returns the resolved actor, or null when the caller
 * should stop.
 */
async function resolveLicensedRemote(
  remoteActorUri: string,
  activityLabel: string,
) {
  const remote = await fetchRemoteActor(remoteActorUri);
  const licensed = await isLicenseTokenValid(
    remote.licenseToken,
    remoteActorUri,
  );
  if (!licensed) {
    logger.warn(
      `[AP inbox] rejected ${activityLabel} from unlicensed instance`,
      { remoteActorUri },
    );
    return null;
  }
  return remote;
}

async function handleFollow(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getOrCreateActor(targetOrgId);
  const remoteActorUri = activity.actor;

  try {
    const remote = await resolveLicensedRemote(remoteActorUri, "Follow");
    if (!remote) return;

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

      // Echo the Follow we are accepting, not a freshly minted one. A
      // conforming server correlates an Accept with its outstanding Follow by
      // that object, so a synthetic id left the remote permanently pending
      // while this instance recorded the follower as approved.
      const acceptActivity = buildAcceptActivity({
        id: generateActivityId(),
        actorUri: localActor.uri,
        followActivity: activity,
      });

      await ApDeliveryQueue.add("deliver", {
        actorId: localActor.id,
        inboxUri: remote.sharedInboxUri ?? remote.inboxUri,
        activity: acceptActivity,
      });
    }
  } catch (err) {
    // Rethrow. Everything inside the try is transient - remote actor lookup,
    // the licence authority, the database, the delivery queue - and the only
    // terminal outcome (an unverified instance) returns rather than throws.
    // Swallowing meant dispatchInboundActivity marked the activity processed
    // and BullMQ dropped the job, so the retry policy could never recover and
    // a legitimate follow was lost for good.
    logger.error("[AP inbox] handleFollow error", { err, remoteActorUri });
    throw err;
  }
}

// ─── Accept / Reject ──────────────────────────────────────────────────────────

/**
 * Accept and Reject are sent for two different things: a Follow request, and a
 * referral Offer (see respondToReferral). Treating every one as a follow
 * response left an accepted referral stuck PENDING for the sender, and let a
 * declined referral flip an unrelated federation follow-link to REJECTED. The
 * embedded object says which it is.
 */
function referencedObject(activity: AnyActivity): {
  type?: string;
  id?: string;
} {
  const inner: unknown = activity.object;
  if (typeof inner === "object" && inner !== null) {
    const { type, id } = inner as { type?: unknown; id?: unknown };
    return {
      type: typeof type === "string" ? type : undefined,
      id: typeof id === "string" ? id : undefined,
    };
  }
  return {};
}

/**
 * Applies a follow-state transition. The responder is the activity's actor,
 * which the worker has already bound to the verified signer. Never trust the
 * inner object.actor: a verified peer could otherwise name a third party and
 * flip our follow-link to them.
 */
async function applyFollowResponse(
  targetOrgId: string,
  activity: AnyActivity,
  state: APFollowingState,
) {
  const localActor = await getActorByOrgId(targetOrgId);
  if (!localActor) return;

  await prisma.aPFollowing.updateMany({
    where: { localActorId: localActor.id, remoteActorUri: activity.actor },
    data: { state },
  });
}

/**
 * Applies a referral decision to the Offer we sent. Scoped to a referral this
 * instance originated (fromActorUri) and addressed to the responder, so a
 * verified peer cannot decide someone else's referral.
 */
async function applyReferralResponse(
  targetOrgId: string,
  activity: AnyActivity,
  state: APReferralState,
) {
  const localActor = await getActorByOrgId(targetOrgId);
  if (!localActor) return;

  const offerUri = referencedObject(activity).id;
  if (!offerUri) return;

  await prisma.aPReferral.updateMany({
    where: {
      activityUri: offerUri,
      fromActorUri: localActor.uri,
      toActorUri: activity.actor,
      state: APReferralState.PENDING,
    },
    data:
      state === APReferralState.ACCEPTED
        ? { state, acceptedAt: new Date() }
        : { state, declinedAt: new Date() },
  });
}

async function handleAccept(targetOrgId: string, activity: AnyActivity) {
  if (referencedObject(activity).type === "Offer") {
    await applyReferralResponse(
      targetOrgId,
      activity,
      APReferralState.ACCEPTED,
    );
    return;
  }
  await applyFollowResponse(targetOrgId, activity, APFollowingState.ACCEPTED);
}

async function handleReject(targetOrgId: string, activity: AnyActivity) {
  if (referencedObject(activity).type === "Offer") {
    await applyReferralResponse(
      targetOrgId,
      activity,
      APReferralState.DECLINED,
    );
    return;
  }
  await applyFollowResponse(targetOrgId, activity, APFollowingState.REJECTED);
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
  const obj = activity.object as { type?: string } | undefined;
  if (obj?.type === "yc:VetReferral") {
    return handleReferralOffer(targetOrgId, activity);
  }
  if (obj?.type === "yc:AgentTask") {
    return handleAgentTask(targetOrgId, activity);
  }
  // Unknown Offer object — ignore.
}

async function handleReferralOffer(targetOrgId: string, activity: AnyActivity) {
  const localActor = await getOrCreateActor(targetOrgId);

  // A valid HTTP signature proves who sent this, not that they are allowed to.
  // sendReferral gates outbound referrals on an accepted follow link, but that
  // only binds cooperative local senders: without these two checks any signed
  // remote actor, including one whose licence was revoked or who was never
  // followed, could post a handcrafted Offer straight to a clinic inbox and
  // create an inbound referral carrying clinical data.
  const remote = await resolveLicensedRemote(activity.actor, "referral");
  if (!remote) return;

  // Mirror of the outbound consent gate: they must be an approved follower of
  // this clinic before clinical data is accepted from them.
  const link = await prisma.aPFollower.findFirst({
    where: {
      localActorId: localActor.id,
      remoteActorUri: activity.actor,
      state: APFollowerState.APPROVED,
    },
    select: { id: true },
  });
  if (!link) {
    logger.warn("[AP inbox] rejected referral with no approved follow link", {
      remoteActorUri: activity.actor,
    });
    return;
  }

  const obj = activity.object as {
    "yc:urgency"?: string;
    "yc:patientSummary"?: unknown;
    "yc:clinicalContext"?: string;
  };

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

// ─── Agent-to-agent tasks ─────────────────────────────────────────────────────

const SUPPORTED_AGENT_TASK_TYPES = new Set(["capability_query"]);

async function handleAgentTask(targetOrgId: string, activity: AnyActivity) {
  // SECURITY: the yc:AgentTask object (including yc:input) is remote-controlled
  // DATA, never instructions. v1 handlers are purely programmatic. If an
  // LLM-backed handler is ever added, it MUST treat yc:input as untrusted input
  // and never as a prompt/command.
  const obj = activity.object as {
    "yc:taskType"?: string;
    "yc:replyTo"?: string;
  };
  const localActor = await getOrCreateActor(targetOrgId);
  const requesterUri = activity.actor;

  try {
    const remote = await resolveLicensedRemote(requesterUri, "AgentTask");
    if (!remote) {
      return;
    }

    const taskType = obj["yc:taskType"] ?? "";
    const inReplyTo = obj["yc:replyTo"] ?? activity.id ?? "";
    const inboxUri = remote.sharedInboxUri ?? remote.inboxUri;

    if (SUPPORTED_AGENT_TASK_TYPES.has(taskType)) {
      const capabilities = await getOrgCapabilities(targetOrgId);
      const resultObject = buildAgentTaskResultObject({
        id: generateActivityId(),
        fromActorUri: localActor.uri,
        taskType,
        inReplyTo,
        result: { status: "ok", capabilities },
      });
      const createActivity = buildActivity({
        id: generateActivityId(),
        type: "Create",
        actorUri: localActor.uri,
        object: resultObject,
        to: [requesterUri],
      });
      await ApDeliveryQueue.add("deliver", {
        actorId: localActor.id,
        inboxUri,
        activity: createActivity,
      });
      return;
    }

    // Any other task type (availability_query, or anything that writes data or
    // makes a clinical decision) is NOT auto-answered — a human at the
    // receiving clinic must handle it.
    const rejectActivity = buildActivity({
      id: generateActivityId(),
      type: "Reject",
      actorUri: localActor.uri,
      object: {
        type: "yc:AgentTask",
        inReplyTo,
        "yc:reason": "requires_human_review",
      },
      to: [requesterUri],
    });
    await ApDeliveryQueue.add("deliver", {
      actorId: localActor.id,
      inboxUri,
      activity: rejectActivity,
    });
  } catch (err) {
    logger.error("[AP inbox] handleAgentTask error", { err, requesterUri });
  }
}

// ─── Create (Note) ────────────────────────────────────────────────────────────

function handleCreate(targetOrgId: string, activity: AnyActivity) {
  const obj = activity.object as
    | {
        type?: string;
        content?: string;
        attributedTo?: string;
        "yc:taskType"?: string;
      }
    | undefined;

  // Result of an agent-to-agent task we sent. The full payload is already
  // persisted by dispatchInboundActivity; log receipt for correlation.
  if (obj?.type === "yc:AgentTaskResult") {
    logger.info("[AP inbox] Received AgentTaskResult", {
      from: activity.actor,
      toOrg: targetOrgId,
      taskType: obj["yc:taskType"],
    });
    return;
  }

  if (obj?.type !== "Note" || !obj.content) return;

  logger.info("[AP inbox] Received Note", {
    from: activity.actor,
    toOrg: targetOrgId,
    contentLength: obj.content.length,
  });
}

// ─── Announce ─────────────────────────────────────────────────────────────────

function handleAnnounce(targetOrgId: string, activity: AnyActivity) {
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
