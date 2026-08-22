import crypto from "node:crypto";

export const AP_CONTEXT = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
] as const;

export const AP_CONTENT_TYPE = "application/activity+json";
export const AP_LD_CONTENT_TYPE =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

export function apBaseUrl(): string {
  const base = process.env.AP_BASE_URL ?? process.env.API_BASE_URL ?? "";
  return base.replace(/\/$/, "");
}

export function actorUri(orgId: string): string {
  return `${apBaseUrl()}/ap/organizations/${orgId}`;
}

export function publicKeyId(orgId: string): string {
  return `${actorUri(orgId)}#main-key`;
}

export function inboxUri(orgId: string): string {
  return `${actorUri(orgId)}/inbox`;
}

export function outboxUri(orgId: string): string {
  return `${actorUri(orgId)}/outbox`;
}

export function followersUri(orgId: string): string {
  return `${actorUri(orgId)}/followers`;
}

export function followingUri(orgId: string): string {
  return `${actorUri(orgId)}/following`;
}

export function sharedInboxUri(): string {
  return `${apBaseUrl()}/ap/shared-inbox`;
}

export function activityUri(id: string): string {
  return `${apBaseUrl()}/ap/activities/${id}`;
}

const AP_CONTEXT_WITH_YC = [
  ...AP_CONTEXT,
  { yc: "https://yosemitecrew.com/ns#" },
] as const;

export function buildActorObject(opts: {
  orgId: string;
  preferredUsername: string;
  name: string;
  summary?: string;
  iconUrl?: string;
  publicKeyPem: string;
  licenseToken?: string | null;
}) {
  const uri = actorUri(opts.orgId);
  return {
    "@context": AP_CONTEXT_WITH_YC,
    id: uri,
    type: "Service",
    preferredUsername: opts.preferredUsername,
    name: opts.name,
    summary: opts.summary,
    url: uri,
    inbox: inboxUri(opts.orgId),
    outbox: outboxUri(opts.orgId),
    followers: followersUri(opts.orgId),
    following: followingUri(opts.orgId),
    endpoints: {
      sharedInbox: sharedInboxUri(),
    },
    icon: opts.iconUrl
      ? { type: "Image", mediaType: "image/jpeg", url: opts.iconUrl }
      : undefined,
    publicKey: {
      id: publicKeyId(opts.orgId),
      owner: uri,
      publicKeyPem: opts.publicKeyPem,
    },
    ...(opts.licenseToken ? { "yc:licenseToken": opts.licenseToken } : {}),
  };
}

export function buildWebFingerResponse(opts: {
  subject: string;
  orgId: string;
  preferredUsername: string;
}) {
  return {
    subject: opts.subject,
    aliases: [actorUri(opts.orgId)],
    links: [
      {
        rel: "self",
        type: AP_CONTENT_TYPE,
        href: actorUri(opts.orgId),
      },
    ],
  };
}

export function buildActivity(opts: {
  id: string;
  type: string;
  actorUri: string;
  object: unknown;
  to?: string[];
  cc?: string[];
}) {
  return {
    "@context": AP_CONTEXT,
    id: activityUri(opts.id),
    type: opts.type,
    actor: opts.actorUri,
    object: opts.object,
    to: opts.to ?? [],
    cc: opts.cc ?? [],
    published: new Date().toISOString(),
  };
}

export function buildFollowActivity(opts: {
  id: string;
  fromActorUri: string;
  toActorUri: string;
}) {
  return buildActivity({
    id: opts.id,
    type: "Follow",
    actorUri: opts.fromActorUri,
    object: opts.toActorUri,
    to: [opts.toActorUri],
  });
}

export function buildAcceptActivity(opts: {
  id: string;
  actorUri: string;
  followActivity: unknown;
}) {
  return buildActivity({
    id: opts.id,
    type: "Accept",
    actorUri: opts.actorUri,
    object: opts.followActivity,
    to: [(opts.followActivity as { actor: string }).actor],
  });
}

export function buildRejectActivity(opts: {
  id: string;
  actorUri: string;
  followActivity: unknown;
}) {
  return buildActivity({
    id: opts.id,
    type: "Reject",
    actorUri: opts.actorUri,
    object: opts.followActivity,
    to: [(opts.followActivity as { actor: string }).actor],
  });
}

export function buildUndoActivity(opts: {
  id: string;
  actorUri: string;
  targetActivity: unknown;
  toActorUri: string;
}) {
  return buildActivity({
    id: opts.id,
    type: "Undo",
    actorUri: opts.actorUri,
    object: opts.targetActivity,
    to: [opts.toActorUri],
  });
}

export function buildReferralObject(opts: {
  id: string;
  fromActorUri: string;
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
  return {
    "@context": [...AP_CONTEXT, { yc: "https://yosemitecrew.com/ns#" }],
    id: `${apBaseUrl()}/ap/referrals/${opts.id}`,
    type: "yc:VetReferral",
    attributedTo: opts.fromActorUri,
    "yc:urgency": opts.urgency,
    "yc:patientSummary": opts.patientSummary,
    "yc:clinicalContext": opts.clinicalContext,
    published: new Date().toISOString(),
  };
}

// Agent-to-agent task types. Only capability_query is auto-answered in v1;
// availability_query is reserved (needs scheduling integration) and any other
// type is routed to a human at the receiving clinic.
export type AgentTaskType = "capability_query" | "availability_query";

export function buildAgentTaskObject(opts: {
  id: string;
  fromActorUri: string;
  taskType: string;
  input?: Record<string, unknown>;
  replyTo?: string;
}) {
  return {
    "@context": [...AP_CONTEXT, { yc: "https://yosemitecrew.com/ns#" }],
    id: `${apBaseUrl()}/ap/agent-tasks/${opts.id}`,
    type: "yc:AgentTask",
    attributedTo: opts.fromActorUri,
    "yc:taskType": opts.taskType,
    "yc:input": opts.input ?? {},
    "yc:replyTo": opts.replyTo,
    published: new Date().toISOString(),
  };
}

export function buildAgentTaskResultObject(opts: {
  id: string;
  fromActorUri: string;
  taskType: string;
  inReplyTo: string;
  result: Record<string, unknown>;
}) {
  return {
    "@context": [...AP_CONTEXT, { yc: "https://yosemitecrew.com/ns#" }],
    id: `${apBaseUrl()}/ap/agent-task-results/${opts.id}`,
    type: "yc:AgentTaskResult",
    attributedTo: opts.fromActorUri,
    "yc:taskType": opts.taskType,
    inReplyTo: opts.inReplyTo,
    "yc:result": opts.result,
    published: new Date().toISOString(),
  };
}

export function buildOfferActivity(opts: {
  id: string;
  fromActorUri: string;
  toActorUri: string;
  referralObject: unknown;
}) {
  return buildActivity({
    id: opts.id,
    type: "Offer",
    actorUri: opts.fromActorUri,
    object: opts.referralObject,
    to: [opts.toActorUri],
  });
}

export function buildNoteActivity(opts: {
  id: string;
  actorUri: string;
  toActorUri: string;
  content: string;
  inReplyTo?: string;
}) {
  const note = {
    id: `${apBaseUrl()}/ap/notes/${opts.id}`,
    type: "Note",
    attributedTo: opts.actorUri,
    content: opts.content,
    to: [opts.toActorUri],
    inReplyTo: opts.inReplyTo,
    published: new Date().toISOString(),
  };

  return buildActivity({
    id: `${opts.id}-create`,
    type: "Create",
    actorUri: opts.actorUri,
    object: note,
    to: [opts.toActorUri],
  });
}

export function buildAnnounceActivity(opts: {
  id: string;
  actorUri: string;
  followersUri: string;
  objectUri: string;
  content: string;
  urgency?: string;
}) {
  const note = {
    id: `${apBaseUrl()}/ap/notes/${opts.id}`,
    type: "Note",
    attributedTo: opts.actorUri,
    content: opts.content,
    summary: opts.urgency === "EMERGENCY" ? "[EMERGENCY]" : undefined,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [opts.followersUri],
    published: new Date().toISOString(),
  };

  return buildActivity({
    id: opts.id,
    type: "Announce",
    actorUri: opts.actorUri,
    object: note,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [opts.followersUri],
  });
}

export function buildOrderedCollection(opts: {
  id: string;
  totalItems: number;
  items?: unknown[];
  first?: string;
}) {
  return {
    "@context": AP_CONTEXT,
    id: opts.id,
    type: "OrderedCollection",
    totalItems: opts.totalItems,
    orderedItems: opts.items ?? [],
    first: opts.first,
  };
}

export function generateActivityId(): string {
  return crypto.randomUUID();
}
