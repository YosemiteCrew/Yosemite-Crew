// src/services/networkChat.service.ts
import { StreamChat } from "stream-chat";
import crypto from "node:crypto";

import { ChatServiceError } from "./chat.service";
import { UserProfileService } from "./user-profile.service";
import { UserService } from "./user.service";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import UserOrganizationModel from "src/models/user-organization";
import ChatSessionModel from "src/models/chatSession";
import { shouldDualWrite, handleDualWriteError } from "src/utils/dual-write";

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
 * honours isReadFromPostgres + the bare/Organization-prefixed reference forms.
 */
const isActiveMemberOfOrg = async (
  userId: string,
  organisationId: string,
): Promise<boolean> => {
  if (isReadFromPostgres()) {
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
  }

  const mapping = await UserOrganizationModel.findOne({
    practitionerReference: userId,
    active: true,
    $or: [
      { organizationReference: organisationId },
      { organizationReference: `Organization/${organisationId}` },
    ],
  });
  return Boolean(mapping);
};

const loadOrganisation = async (organisationId: string) => {
  return prisma.organization.findFirst({
    where: { id: organisationId },
    select: { id: true, name: true, crossOrgMessagingEnabled: true },
  });
};

const syncSessionToPostgres = async (doc: {
  toObject(): Record<string, unknown>;
}) => {
  if (!shouldDualWrite) return;
  try {
    const obj = doc.toObject() as {
      _id: { toString(): string };
      type: string;
      channelId: string;
      organisationId: string;
      counterpartOrganisationId?: string;
      createdBy?: string;
      isPrivate?: boolean;
      members: string[];
      status: string;
      createdAt?: Date;
      updatedAt?: Date;
    };
    const data = {
      id: obj._id.toString(),
      type: obj.type as never,
      channelId: obj.channelId,
      organisationId: obj.organisationId,
      counterpartOrganisationId: obj.counterpartOrganisationId ?? undefined,
      createdBy: obj.createdBy ?? undefined,
      isPrivate: obj.isPrivate ?? true,
      members: obj.members ?? [],
      status: obj.status as never,
      createdAt: obj.createdAt ?? undefined,
      updatedAt: obj.updatedAt ?? undefined,
    };
    await prisma.chatSession.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("ChatSession", err);
  }
};

export type NetworkColleague = {
  userId: string;
  name: string;
  role: string;
  organisationId: string;
  organisationName: string;
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
      const orgId = mapping.organizationReference.startsWith("Organization/")
        ? mapping.organizationReference.slice("Organization/".length)
        : mapping.organizationReference;
      const organisationName = orgNameById.get(orgId);
      if (!organisationName) continue;

      const userId = extractReferenceId(mapping.practitionerReference);
      const user = await prisma.user.findFirst({
        where: { userId },
        select: { firstName: true, lastName: true },
      });

      const name = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!name) continue;

      if (normalizedQuery && !name.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      colleagues.push({
        userId,
        name,
        role: mapping.roleDisplay ?? mapping.roleCode,
        organisationId: orgId,
        organisationName,
      });

      if (colleagues.length >= MAX_COLLEAGUE_RESULTS) {
        break;
      }
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

    const existing = await ChatSessionModel.findOne({
      type: "ORG_DIRECT",
      members: { $all: members, $size: 2 },
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

    await streamServer
      .channel("team", channelId, {
        members,
        created_by_id: requesterUserId,
      })
      .create();

    const session = await ChatSessionModel.create({
      type: "ORG_DIRECT",
      organisationId: requesterOrgId,
      counterpartOrganisationId: otherOrgId,
      channelId,
      members,
      createdBy: requesterUserId,
      isPrivate: true,
      status: "ACTIVE",
    });
    await syncSessionToPostgres(session);
    return session;
  },
};
