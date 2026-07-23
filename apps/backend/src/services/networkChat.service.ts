// src/services/networkChat.service.ts
import { ChannelData, StreamChat } from "stream-chat";
import crypto from "node:crypto";

import { ChatServiceError } from "./chat.service";
import { UserProfileService } from "./user-profile.service";
import { UserService } from "./user.service";
import { prisma } from "src/config/prisma";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;

if (!STREAM_KEY || !STREAM_SECRET) {
  throw new Error("Stream Chat credentials missing in env");
}

const streamServer = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);

const MAX_COLLEAGUE_RESULTS = 25;

const shortHash = (input: string, length = 12) =>
  crypto.createHash("sha256").update(input).digest("hex").slice(0, length);

/**
 * practitionerReference can be a raw sub ("abc123"), "Practitioner/abc123",
 * or "User/abc123". prisma.user keys off the raw userId, so strip any prefix.
 */
const extractReferenceId = (value: string): string =>
  value.split("/").pop()?.trim() || value;

/**
 * Active membership probe mirroring rbac.ts `userOrganization` lookup:
 * honours the bare/Organization-prefixed reference forms.
 */
const isActiveMemberOfOrg = async (
  userId: string,
  organisationId: string,
): Promise<boolean> => {
  const mapping = await prisma.userOrganization.findFirst({
    where: {
      practitionerReference: userId,
      active: true,
      OR: [
        { organizationReference: organisationId },
        { organizationReference: `Organization/${organisationId}` },
      ],
    },
  });
  return Boolean(mapping);
};

const loadOrganisation = async (organisationId: string) => {
  return prisma.organization.findFirst({
    where: { id: organisationId },
    select: { id: true, name: true, crossOrgMessagingEnabled: true },
  });
};

export type NetworkColleague = {
  userId: string;
  name: string;
  role: string;
  organisationId: string;
  organisationName: string;
};

const orgIdFromReference = (reference: string): string =>
  reference.startsWith("Organization/")
    ? reference.slice("Organization/".length)
    : reference;

type ColleagueMapping = {
  practitionerReference: string;
  organizationReference: string;
  roleCode: string;
  roleDisplay: string | null;
};

const buildColleague = async (
  mapping: ColleagueMapping,
  orgNameById: Map<string, string>,
  normalizedQuery: string,
): Promise<NetworkColleague | null> => {
  const organisationId = orgIdFromReference(mapping.organizationReference);
  const organisationName = orgNameById.get(organisationId);
  if (!organisationName) return null;

  const userId = extractReferenceId(mapping.practitionerReference);
  const user = await prisma.user.findFirst({
    where: { userId },
    select: { firstName: true, lastName: true },
  });

  const name = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!name) return null;
  if (normalizedQuery && !name.toLowerCase().includes(normalizedQuery)) {
    return null;
  }

  return {
    userId,
    name,
    role: mapping.roleDisplay ?? mapping.roleCode,
    organisationId,
    organisationName,
  };
};

export const NetworkChatService = {
  async searchNetworkColleagues({
    requesterUserId,
    requesterOrgId,
    query,
  }: {
    requesterUserId: string;
    requesterOrgId: string;
    query?: string;
  }): Promise<{ colleagues: NetworkColleague[] }> {
    const isMember = await isActiveMemberOfOrg(requesterUserId, requesterOrgId);
    if (!isMember) {
      throw new ChatServiceError(
        "You are not associated with this organisation",
        403,
      );
    }

    const requesterOrg = await loadOrganisation(requesterOrgId);
    if (requesterOrg?.crossOrgMessagingEnabled !== true) {
      throw new ChatServiceError(
        "Cross-clinic messaging is disabled for your clinic",
        403,
      );
    }

    const otherOrgs = await prisma.organization.findMany({
      where: {
        crossOrgMessagingEnabled: true,
        id: { not: requesterOrgId },
      },
      select: { id: true, name: true },
    });

    if (otherOrgs.length === 0) {
      return { colleagues: [] };
    }

    const orgNameById = new Map(otherOrgs.map((org) => [org.id, org.name]));
    const orgReferences: string[] = [];
    for (const org of otherOrgs) {
      orgReferences.push(org.id, `Organization/${org.id}`);
    }

    const mappings = await prisma.userOrganization.findMany({
      where: {
        active: true,
        organizationReference: { in: orgReferences },
      },
      select: {
        practitionerReference: true,
        organizationReference: true,
        roleCode: true,
        roleDisplay: true,
      },
    });

    const normalizedQuery = (query ?? "").trim().toLowerCase();
    const colleagues: NetworkColleague[] = [];

    for (const mapping of mappings) {
      const colleague = await buildColleague(
        mapping,
        orgNameById,
        normalizedQuery,
      );
      if (colleague) colleagues.push(colleague);
      if (colleagues.length >= MAX_COLLEAGUE_RESULTS) break;
    }

    return { colleagues };
  },

  async createNetworkDirectChat({
    requesterUserId,
    requesterOrgId,
    otherUserId,
    otherOrgId,
  }: {
    requesterUserId: string;
    requesterOrgId: string;
    otherUserId: string;
    otherOrgId: string;
  }) {
    if (requesterOrgId === otherOrgId) {
      throw new ChatServiceError(
        "Use the within-organisation direct chat for colleagues in the same clinic",
        400,
      );
    }

    if (requesterUserId === otherUserId) {
      throw new ChatServiceError("Cannot chat with yourself", 400);
    }

    // FAIL-CLOSED GATE: every condition must be explicitly satisfied.
    const [requesterIsMember, otherIsMember, requesterOrg, otherOrg] =
      await Promise.all([
        isActiveMemberOfOrg(requesterUserId, requesterOrgId),
        isActiveMemberOfOrg(otherUserId, otherOrgId),
        loadOrganisation(requesterOrgId),
        loadOrganisation(otherOrgId),
      ]);

    if (
      !requesterIsMember ||
      !otherIsMember ||
      requesterOrg?.crossOrgMessagingEnabled !== true ||
      otherOrg?.crossOrgMessagingEnabled !== true
    ) {
      throw new ChatServiceError(
        "Cross-clinic messaging is not permitted between these users",
        403,
      );
    }

    const members = [requesterUserId, otherUserId].sort((a, b) =>
      a.localeCompare(b),
    );

    // Scope the lookup to this org pair: matching on members alone also matches
    // the same-org ORG_DIRECT sessions created by chat.service, which would hand
    // a within-clinic session back to a cross-clinic request. Either side may
    // have opened the conversation, so both orderings of the pair count as the
    // same session.
    const existing = await prisma.chatSession.findFirst({
      where: {
        type: "ORG_DIRECT",
        members: { equals: members },
        OR: [
          {
            organisationId: requesterOrgId,
            counterpartOrganisationId: otherOrgId,
          },
          {
            organisationId: otherOrgId,
            counterpartOrganisationId: requesterOrgId,
          },
        ],
      },
    });

    if (existing) return existing;

    // Mirror createOrgDirectChat's Stream upsert (resolve names per home org).
    for (const userId of members) {
      const homeOrgId =
        userId === requesterUserId ? requesterOrgId : otherOrgId;
      const userProfile = await UserProfileService.getByUserId(
        userId,
        homeOrgId,
      );
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image:
          userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    const hash = shortHash(
      `${requesterOrgId}:${otherOrgId}:${members.join(":")}`,
    );
    const channelId = `nd_${hash}`;

    // Both clinics list this conversation, so it is scoped to the pair rather
    // than to the requester alone.
    const channelData: ChannelData & { organisationIds: string[] } = {
      members,
      created_by_id: requesterUserId,
      organisationIds: [requesterOrgId, otherOrgId],
    };

    await streamServer.channel("team", channelId, channelData).create();

    const session = await prisma.chatSession.create({
      data: {
        type: "ORG_DIRECT",
        organisationId: requesterOrgId,
        counterpartOrganisationId: otherOrgId,
        channelId,
        members,
        createdBy: requesterUserId,
        isPrivate: true,
        status: "ACTIVE",
      },
    });
    return session;
  },
};
