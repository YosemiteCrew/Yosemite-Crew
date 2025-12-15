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
