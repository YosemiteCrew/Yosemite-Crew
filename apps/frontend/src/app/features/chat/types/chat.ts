/**
 * Chat Types for Stream Chat Integration
 */

export type ChatSession = {
  id: string;
  appointmentId: string;
  channelId: string;
  channelType: 'messaging';
  members: string[];
  status: 'active' | 'ended';
  petOwnerName?: string;
  petName?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ChatTokenResponse = {
  token: string;
  expiresAt: number;
};

export type CreateChatSessionResponse = {
  channelId: string;
  channelType: 'messaging';
  members: string[];
};

export type ChatSessionListResponse = {
  channels: ChatSession[];
};

export type CloseChatSessionResponse = {
  success: boolean;
};

export type OrgDirectRequest = {
  organisationId: string;
  otherUserId: string;
};

export type OrgGroupRequest = {
  organisationId: string;
  title: string;
  memberIds: string[];
  isPrivate?: boolean;
  description?: string;
};

export type OrgChatSession = {
  _id: string;
  type: "ORG_DIRECT" | "ORG_GROUP";
  organisationId: string;
  channelId: string;
  title?: string;
  description?: string;
  isPrivate?: boolean;
  members: string[];
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  vetId?: string | null;
  supportStaffIds?: string[];
  participants?: string[];
  closedAt?: string | null;
};

export type OrgUser = {
  id: string;
  userId?: string;
  practitionerId?: string;
  name: string;
  email?: string;
  image?: string;
  role?: string;
  speciality?: string;
};
