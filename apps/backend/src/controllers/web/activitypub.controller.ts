import { z } from "zod";
import { Request, Response } from "express";
import logger from "src/utils/logger";
import { AP_CONTENT_TYPE } from "src/utils/activitypub-builder";
import { ApInboxQueue } from "src/queues/ap-inbox.queue";
import {
  buildActorResponse,
  resolveWebFinger,
  getFollowersCollection,
  getFollowingCollection,
  getOutboxCollection,
  sendFollow,
  sendUnfollow,
  approveFollower,
  rejectFollower,
  sendReferral,
  sendNote,
  announceEmergency,
  listInboundReferrals,
  listOutboundReferrals,
  listFollowers,
  listFollowing,
  updateLicenseToken,
  respondToReferral,
  updateActorProfile,
  getActorSettingsData,
  listFollowerOrgIdsFor,
  setDirectoryListing,
  listDirectory,
} from "src/services/activitypub.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AP_HEADERS = { "Content-Type": AP_CONTENT_TYPE };
const INTERNAL_ERROR = "Internal error";
const REMOTE_ACTOR_URI_REQUIRED = "remoteActorUri required";

function extractRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

function collectHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k.toLowerCase()] = v;
    else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0] ?? "";
  }
  return headers;
}

function requireOrgId(req: Request, res: Response): string | null {
  const orgId = (req as OrgRequest).organisationId;
  if (!orgId) {
    res.status(403).json({ error: "Organisation context required" });
    return null;
  }
  return orgId;
}

// ─── Well-known ───────────────────────────────────────────────────────────────

export const WellKnownController = {
  webfinger: async (req: Request, res: Response) => {
    const resource = req.query.resource as string | undefined;
    if (!resource)
      return res.status(400).json({ error: "resource param required" });

    const response = await resolveWebFinger(resource);
    if (!response) return res.status(404).json({ error: "Actor not found" });

    return res
      .status(200)
      .set("Content-Type", "application/jrd+json")
      .json(response);
  },

  hostMeta: (_req: Request, res: Response) => {
    const base = (process.env.AP_BASE_URL ?? "").replace(/\/$/, "");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml" template="${base}/.well-known/webfinger?resource={uri}"/>
</XRD>`;
    return res.status(200).set("Content-Type", "application/xrd+xml").send(xml);
  },
};

// ─── Actor ────────────────────────────────────────────────────────────────────

/**
 * Referral payloads arrive from the settings panel but are still untrusted
 * input. They were cast rather than validated, so a string patientSummary, an
 * unknown urgency, oversized free text or non-string medication entries reached
 * Prisma and the federation payload builder, producing 500s or malformed
 * clinical messages on the wire.
 */
const ReferralUrgencySchema = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);

const PatientSummarySchema = z.object({
  species: z.string().trim().min(1).max(120),
  breed: z.string().trim().max(120).optional(),
  age: z.string().trim().max(60).optional(),
  chiefComplaint: z.string().trim().min(1).max(2000),
  currentMedications: z.array(z.string().trim().max(200)).max(50).optional(),
  allergies: z.array(z.string().trim().max(200)).max(50).optional(),
});

const SendReferralBodySchema = z.object({
  toActorUri: z.string().url().max(512),
  patientSummary: PatientSummarySchema,
  urgency: ReferralUrgencySchema.optional(),
  clinicalContext: z.string().max(5000).optional(),
});

export const ActivityPubController = {
  getActor: async (req: Request, res: Response) => {
    try {
      const actor = await buildActorResponse(req.params.orgId);
      return res.status(200).set(AP_HEADERS).json(actor);
    } catch (err) {
      logger.error("[AP] getActor error", { err });
      return res.status(404).json({ error: "Actor not found" });
    }
  },

  // ─── Inbox (public POST endpoint — queues for async processing) ────────────

  postInbox: async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;
      const rawBody = extractRawBody(req);
      try {
        JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
      const headers = collectHeaders(req);

      await ApInboxQueue.add("process", {
        targetOrgId: orgId,
        rawBody,
        headers,
        requestUrl: `${process.env.AP_BASE_URL ?? ""}${req.originalUrl}`,
        requestMethod: req.method,
      });

      return res.status(202).end();
    } catch (err) {
      logger.error("[AP] postInbox error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  postSharedInbox: async (req: Request, res: Response) => {
    try {
      const rawBody = extractRawBody(req);
      type SharedInboxBody = {
        actor?: string;
        object?: { to?: string | string[] };
        to?: string | string[];
      };
      let parsed: SharedInboxBody;
      try {
        parsed = JSON.parse(rawBody) as SharedInboxBody;
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }

      const toAddresses = [
        ...(Array.isArray(parsed.to) ? parsed.to : [parsed.to ?? ""]),
        ...(Array.isArray(parsed.object?.to)
          ? (parsed.object?.to ?? [])
          : [parsed.object?.to ?? ""]),
      ].filter((v): v is string => Boolean(v));

      const headers = collectHeaders(req);
      const addressedOrgIds = toAddresses
        .map((uri) =>
          uri.includes("/ap/organizations/")
            ? uri.split("/ap/organizations/")[1]
            : null,
        )
        .filter((v): v is string => Boolean(v));

      // A broadcast is addressed `to: Public` with the sender's followers
      // collection in `cc`, so nothing in the addressing names a local
      // organisation. Without this fallback the shared inbox queued nothing and
      // answered 202, and approved followers delivered to via a shared inbox
      // never saw emergency announcements.
      const orgIds = addressedOrgIds.length
        ? addressedOrgIds
        : parsed.actor
          ? await listFollowerOrgIdsFor(parsed.actor)
          : [];

      const actors = await Promise.allSettled(
        orgIds.map((orgId) =>
          ApInboxQueue.add("process", {
            targetOrgId: orgId,
            rawBody,
            headers,
            requestUrl: `${process.env.AP_BASE_URL ?? ""}${req.originalUrl}`,
            requestMethod: req.method,
          }),
        ),
      );

      logger.info("[AP] Shared inbox queued", { count: actors.length });
      return res.status(202).end();
    } catch (err) {
      logger.error("[AP] postSharedInbox error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  // ─── Collections ──────────────────────────────────────────────────────────

  getOutbox: async (req: Request, res: Response) => {
    const collection = await getOutboxCollection(req.params.orgId);
    return res.status(200).set(AP_HEADERS).json(collection);
  },

  getFollowers: async (req: Request, res: Response) => {
    const collection = await getFollowersCollection(req.params.orgId);
    return res.status(200).set(AP_HEADERS).json(collection);
  },

  getFollowing: async (req: Request, res: Response) => {
    const collection = await getFollowingCollection(req.params.orgId);
    return res.status(200).set(AP_HEADERS).json(collection);
  },

  // ─── Management API (authenticated, org-scoped) ───────────────────────────

  getActorSettings: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { actor, licenseTokenStatus, isVerified, directoryListed } =
        await getActorSettingsData(orgId);
      return res.status(200).json({
        uri: actor.uri,
        preferredUsername: actor.preferredUsername,
        publicKeyId: actor.publicKeyId,
        inboxUri: actor.inboxUri,
        outboxUri: actor.outboxUri,
        followersUri: actor.followersUri,
        followingUri: actor.followingUri,
        sharedInboxUri: actor.sharedInboxUri,
        summary: actor.summary,
        iconUrl: actor.iconUrl,
        createdAt: actor.createdAt,
        licenseTokenStatus,
        isVerified,
        directoryListed,
      });
    } catch (err) {
      logger.error("[AP] getActorSettings error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  toggleDirectoryListing: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { listed } = req.body as { listed?: boolean };
      if (typeof listed !== "boolean")
        return res.status(400).json({ error: "listed (boolean) required" });
      const result = await setDirectoryListing(orgId, listed);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("[AP] toggleDirectoryListing error", { err });
      const message = err instanceof Error ? err.message : INTERNAL_ERROR;
      return res.status(422).json({ error: message });
    }
  },

  getDirectory: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const result = await listDirectory(orgId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("[AP] getDirectory error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  updateLicenseToken: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { token } = req.body as { token: string };
      if (!token) return res.status(400).json({ error: "token required" });
      await updateLicenseToken(orgId, token);
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("[AP] updateLicenseToken error", { err });
      const message = err instanceof Error ? err.message : "Invalid token";
      return res.status(422).json({ error: message });
    }
  },

  follow: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: REMOTE_ACTOR_URI_REQUIRED });
      const activity = await sendFollow(orgId, remoteActorUri);
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] follow error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  unfollow: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: REMOTE_ACTOR_URI_REQUIRED });
      const activity = await sendUnfollow(orgId, remoteActorUri);
      if (!activity)
        return res.status(404).json({ error: "Not following that actor" });
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] unfollow error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  approveFollower: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: REMOTE_ACTOR_URI_REQUIRED });
      await approveFollower(orgId, remoteActorUri);
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("[AP] approveFollower error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  rejectFollower: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: REMOTE_ACTOR_URI_REQUIRED });
      await rejectFollower(orgId, remoteActorUri);
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("[AP] rejectFollower error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  listFollowers: async (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const rows = await listFollowers(orgId);
    return res.status(200).json(rows);
  },

  listFollowing: async (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const rows = await listFollowing(orgId);
    return res.status(200).json(rows);
  },

  sendReferral: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const parsed = SendReferralBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid referral payload",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const body = parsed.data;

      const activity = await sendReferral({
        fromOrgId: orgId,
        toActorUri: body.toActorUri,
        patientSummary: body.patientSummary,
        urgency: body.urgency ?? "ROUTINE",
        clinicalContext: body.clinicalContext,
      });
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] sendReferral error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  listInboundReferrals: async (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    return res.status(200).json(await listInboundReferrals(orgId));
  },

  listOutboundReferrals: async (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    return res.status(200).json(await listOutboundReferrals(orgId));
  },

  sendNote: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { toActorUri, content, inReplyTo } = req.body as {
        toActorUri: string;
        content: string;
        inReplyTo?: string;
      };
      if (!toActorUri || !content)
        return res
          .status(400)
          .json({ error: "toActorUri and content required" });
      const activity = await sendNote({
        fromOrgId: orgId,
        toActorUri,
        content,
        inReplyTo,
      });
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] sendNote error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  announceEmergency: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { content, urgency } = req.body as {
        content: string;
        urgency?: string;
      };
      if (!content) return res.status(400).json({ error: "content required" });
      const activity = await announceEmergency({
        fromOrgId: orgId,
        content,
        urgency,
      });
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] announceEmergency error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },

  respondToReferral: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { referralId } = req.params as { referralId: string };
      const { action } = req.body as { action: "accept" | "decline" };
      if (!action || !["accept", "decline"].includes(action)) {
        return res
          .status(400)
          .json({ error: "action must be 'accept' or 'decline'" });
      }
      const result = await respondToReferral(orgId, referralId, action);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("[AP] respondToReferral error", { err });
      const message = err instanceof Error ? err.message : INTERNAL_ERROR;
      return res.status(422).json({ error: message });
    }
  },

  updateActorProfile: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { summary, iconUrl } = req.body as {
        summary?: string;
        iconUrl?: string;
      };
      const actor = await updateActorProfile(orgId, { summary, iconUrl });
      return res
        .status(200)
        .json({ summary: actor.summary, iconUrl: actor.iconUrl });
    } catch (err) {
      logger.error("[AP] updateActorProfile error", { err });
      return res.status(500).json({ error: INTERNAL_ERROR });
    }
  },
};
