import { Request, Response } from "express";
import logger from "src/utils/logger";
import { AP_CONTENT_TYPE } from "src/utils/activitypub-builder";
import { ApInboxQueue } from "src/queues/ap-inbox.queue";
import {
  buildActorResponse,
  resolveWebFinger,
  buildNodeInfoResponse,
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
  getOrCreateActor,
  updateLicenseToken,
  getLicenseTokenStatus,
  respondToReferral,
  updateActorProfile,
} from "src/services/activitypub.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AP_HEADERS = { "Content-Type": AP_CONTENT_TYPE };

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

  nodeInfoIndex: (_req: Request, res: Response) => {
    const base = (process.env.AP_BASE_URL ?? "").replace(/\/$/, "");
    return res.status(200).json({
      links: [
        {
          rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
          href: `${base}/nodeinfo/2.0`,
        },
      ],
    });
  },

  nodeInfo: async (_req: Request, res: Response) => {
    const info = await buildNodeInfoResponse();
    return res.status(200).json(info);
  },
};

// ─── Actor ────────────────────────────────────────────────────────────────────

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
      const rawBody =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
        else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0] ?? "";
      }

      await ApInboxQueue.add("process", {
        targetOrgId: orgId,
        rawBody,
        headers,
        requestUrl: `${process.env.AP_BASE_URL ?? ""}${req.path}`,
        requestMethod: req.method,
      });

      return res.status(202).end();
    } catch (err) {
      logger.error("[AP] postInbox error", { err });
      return res.status(500).json({ error: "Internal error" });
    }
  },

  postSharedInbox: async (req: Request, res: Response) => {
    try {
      const activity = req.body as {
        object?: { to?: string | string[] };
        to?: string | string[];
      };
      const toAddresses = [
        ...(Array.isArray(activity.to) ? activity.to : [activity.to ?? ""]),
        ...(Array.isArray(activity.object?.to)
          ? activity.object!.to!
          : [activity.object?.to ?? ""]),
      ].filter(Boolean);

      const actors = await Promise.allSettled(
        toAddresses
          .map((uri) =>
            uri.includes("/ap/organizations/")
              ? uri.split("/ap/organizations/")[1]
              : null,
          )
          .filter(Boolean)
          .map((orgId) =>
            ApInboxQueue.add("process", {
              targetOrgId: orgId!,
              rawBody: JSON.stringify(req.body),
              headers: Object.fromEntries(
                Object.entries(req.headers).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v[0] : (v ?? ""),
                ]),
              ),
              requestUrl: `${process.env.AP_BASE_URL ?? ""}${req.path}`,
              requestMethod: req.method,
            }),
          ),
      );

      logger.info("[AP] Shared inbox queued", { count: actors.length });
      return res.status(202).end();
    } catch (err) {
      logger.error("[AP] postSharedInbox error", { err });
      return res.status(500).json({ error: "Internal error" });
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
      const [actor, licenseTokenStatus] = await Promise.all([
        getOrCreateActor(orgId),
        getLicenseTokenStatus(orgId),
      ]);
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
      });
    } catch (err) {
      logger.error("[AP] getActorSettings error", { err });
      return res.status(500).json({ error: "Internal error" });
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
        return res.status(400).json({ error: "remoteActorUri required" });
      const activity = await sendFollow(orgId, remoteActorUri);
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] follow error", { err });
      return res.status(500).json({ error: "Internal error" });
    }
  },

  unfollow: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: "remoteActorUri required" });
      const activity = await sendUnfollow(orgId, remoteActorUri);
      if (!activity)
        return res.status(404).json({ error: "Not following that actor" });
      return res.status(202).json(activity);
    } catch (err) {
      logger.error("[AP] unfollow error", { err });
      return res.status(500).json({ error: "Internal error" });
    }
  },

  approveFollower: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: "remoteActorUri required" });
      await approveFollower(orgId, remoteActorUri);
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("[AP] approveFollower error", { err });
      return res.status(500).json({ error: "Internal error" });
    }
  },

  rejectFollower: async (req: Request, res: Response) => {
    try {
      const orgId = requireOrgId(req, res);
      if (!orgId) return;
      const { remoteActorUri } = req.body as { remoteActorUri: string };
      if (!remoteActorUri)
        return res.status(400).json({ error: "remoteActorUri required" });
      await rejectFollower(orgId, remoteActorUri);
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("[AP] rejectFollower error", { err });
      return res.status(500).json({ error: "Internal error" });
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
      const body = req.body as {
        toActorUri: string;
        patientSummary: {
          species: string;
          breed?: string;
          age?: string;
          chiefComplaint: string;
          currentMedications?: string[];
          allergies?: string[];
        };
        urgency?: "ROUTINE" | "URGENT" | "EMERGENCY";
        clinicalContext?: string;
      };

      if (!body.toActorUri || !body.patientSummary) {
        return res
          .status(400)
          .json({ error: "toActorUri and patientSummary required" });
      }

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
      return res.status(500).json({ error: "Internal error" });
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
      return res.status(500).json({ error: "Internal error" });
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
      return res.status(500).json({ error: "Internal error" });
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
      const message = err instanceof Error ? err.message : "Internal error";
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
      return res.status(500).json({ error: "Internal error" });
    }
  },
};
