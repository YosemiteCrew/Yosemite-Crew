import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';

const CHAT_BASE_PATH = '/v1/chat/mobile';

const buildHeaders = async () => {
  const tokens = await getFreshStoredTokens();

  if (tokens?.accessToken) {
    return withAuthHeaders(tokens.accessToken);
  }

  console.warn(
    '[ChatBackend] Missing access token when building headers. Proceeding without Authorization header.',
  );

  return {
    'Content-Type': 'application/json',
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

export const fetchChatToken = async (): Promise<string> => {
  try {
    const headers = await buildHeaders();
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
  userId?: string;
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
  status?: string;
  allowedFrom?: string | null;
  allowedUntil?: string | null;
  companionId?: string;
  parentId?: string;
  vetId?: string;
  appointmentId?: string;
  organisationId?: string;
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
    // The current backend infers user/vet/appointment context from the token + path.
    // Keep optional params for future compatibility, but they are not sent.
  } = params;

  try {
    const headers = await buildHeaders();

    const response = await apiClient.post(
      `${CHAT_BASE_PATH}/sessions/${sessionId}`,
      undefined,
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
      status: data?.status,
      allowedFrom: data?.allowedFrom ?? null,
      allowedUntil: data?.allowedUntil ?? null,
      companionId: data?.companionId,
      parentId: data?.parentId,
      vetId: data?.vetId,
      appointmentId: data?.appointmentId,
      organisationId: data?.organisationId,
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
