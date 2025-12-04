import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';

const CHAT_BASE_PATH = '/v1/chat/mobile';

const buildHeaders = async (userId: string) => {
  const tokens = await getFreshStoredTokens();

  if (tokens?.accessToken) {
    return withAuthHeaders(tokens.accessToken, {'x-user-id': userId});
  }

  console.warn(
    '[ChatBackend] Missing access token when building headers. Proceeding without Authorization header.',
  );

  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };
};

const extractChatToken = (data: any): string | null => {
  if (!data) {
    return null;
  }

  return (
    data.token ??
    data.streamToken ??
    data.chatToken ??
    data.accessToken ??
    data.data?.token ??
    null
  );
};

export const fetchChatToken = async (userId: string): Promise<string> => {
  try {
    const headers = await buildHeaders(userId);
    const response = await apiClient.post(`${CHAT_BASE_PATH}/token`, undefined, {
      headers,
    });

    const token = extractChatToken(response.data);

    if (!token) {
      throw new Error('Chat token missing from backend response');
    }

    return token;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ??
      error?.response?.data?.error ??
      error?.message ??
      'Failed to fetch chat token';

    console.error('[ChatBackend] Token request failed', {
      message,
      error,
    });
    throw new Error(message);
  }
};

type ChatSessionParams = {
  sessionId: string;
  userId: string;
  vetId?: string;
  appointmentTime?: string;
  petOwnerId?: string;
  activationMinutes?: number;
  petName?: string;
};

export type ChatSessionDetails = {
  channelId: string;
  channelType: string;
  members?: string[];
  raw?: any;
};

const extractChannelId = (data: any): string | undefined => {
  const cid = data?.cid ?? data?.channel?.cid ?? data?.session?.cid;
  const cidParts =
    typeof cid === 'string' && cid.includes(':') ? cid.split(':') : null;

  return (
    data?.channelId ??
    data?.channel_id ??
    data?.id ??
    data?.channel?.id ??
    data?.session?.channelId ??
    (cidParts?.length === 2 ? cidParts[1] : undefined)
  );
};

const extractChannelType = (data: any): string => {
  const cid = data?.cid ?? data?.channel?.cid ?? data?.session?.cid;
  const cidParts =
    typeof cid === 'string' && cid.includes(':') ? cid.split(':') : null;

  return (
    data?.channelType ??
    data?.channel_type ??
    data?.type ??
    data?.channel?.type ??
    data?.session?.channelType ??
    (cidParts?.length === 2 ? cidParts[0] : undefined) ??
    'messaging'
  );
};

const extractMembers = (data: any): string[] | undefined => {
  const members = data?.members ?? data?.channel?.members ?? data?.session?.members;
  if (!Array.isArray(members)) {
    return undefined;
  }

  const normalized = members
    .map((member: any) => {
      if (typeof member === 'string') {
        return member;
      }
      if (member?.user?.id) {
        return member.user.id;
      }
      return member?.user_id ?? member?.id ?? null;
    })
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
};

export const createOrFetchChatSession = async (
  params: ChatSessionParams,
): Promise<ChatSessionDetails> => {
  const {
    sessionId,
    userId,
    vetId,
    appointmentTime,
    petOwnerId,
    activationMinutes = 5,
    petName,
  } = params;

  try {
    const headers = await buildHeaders(userId);
    const payload = {
      appointmentId: sessionId,
      vetId,
      petOwnerId: petOwnerId ?? userId,
      appointmentTime,
      activationMinutes,
      petName,
    };

    const response = await apiClient.post(
      `${CHAT_BASE_PATH}/sessions/${sessionId}`,
      payload,
      {headers},
    );

    const data = response.data ?? {};
    const channelId = extractChannelId(data);

    if (!channelId) {
      throw new Error('Channel ID missing from chat session response');
    }

    return {
      channelId,
      channelType: extractChannelType(data),
      members: extractMembers(data),
      raw: data,
    };
  } catch (error: any) {
    const message =
      error?.response?.data?.message ??
      error?.response?.data?.error ??
      error?.message ??
      'Failed to create chat session';

    console.error('[ChatBackend] Session request failed', {
      sessionId,
      message,
      error,
    });
    throw new Error(message);
  }
};
