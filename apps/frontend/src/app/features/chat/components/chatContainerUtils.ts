import type { Channel as StreamChannel } from 'stream-chat';
import { formatDisplayDate } from '@/app/lib/date';

export type ChatScope = 'clients' | 'colleagues' | 'groups';

interface ChannelDisplayInfo {
  title: string;
  image?: string;
}

export const normalizeName = (value?: string) => {
  if (!value) return '';
  // Remove templated space markers like {' '} using iterative approach
  let result = '';
  let i = 0;
  while (i < value.length) {
    if (value[i] === '{') {
      const closeIdx = value.indexOf('}', i + 1);
      if (closeIdx !== -1) {
        result += ' ';
        i = closeIdx + 1;
        continue;
      }
    }
    result += value[i];
    i++;
  }
  // collapse whitespace
  return result.replaceAll(/\s+/g, ' ').trim();
};

export const getSessionIdFromChannel = (chan: StreamChannel): string | undefined => {
  const data = (chan.data as any) || {};
  return data.groupId || data.directId || data._id || undefined;
};

export const findSessionByStoredId = (sessions: Array<{ _id: string }>, storedId?: string) => {
  if (!storedId) return undefined;
  return sessions.find((s) => s._id === storedId);
};

export const matchesDirectSession = (session: any, channelMemberIds: string[]) => {
  if (session.type !== 'ORG_DIRECT' || channelMemberIds.length !== 2) {
    return false;
  }
  const sessionMembers = session.members || [];
  const allMembersMatch = sessionMembers.every((sm: string) => channelMemberIds.includes(sm));
  return allMembersMatch && sessionMembers.length === channelMemberIds.length;
};

export const matchesGroupSession = (
  session: any,
  channelMemberIds: string[],
  channelTitle?: string
) => {
  if (session.type !== 'ORG_GROUP' || channelMemberIds.length <= 2) {
    return false;
  }
  const sessionMembers = session.members || [];
  const matchingMembers = sessionMembers.filter((sm: string) => channelMemberIds.includes(sm));
  if (matchingMembers.length < Math.min(sessionMembers.length, channelMemberIds.length) - 1) {
    return false;
  }
  if (session.title && channelTitle && session.title === channelTitle) return true;
  return (
    matchingMembers.length === sessionMembers.length &&
    matchingMembers.length === channelMemberIds.length
  );
};

export const matchesChannelId = (session: any, chan: StreamChannel) => {
  if (session.channelId === chan.id) return true;
  if (chan.cid && session.channelId === chan.cid) return true;
  if (chan.id && session.channelId && chan.id.includes(session.channelId)) return true;
  if (session.channelId?.includes?.(chan.id)) return true;
  return false;
};

export const getChannelDisplayInfo = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): ChannelDisplayInfo => {
  if (!channel) {
    return { title: 'Chat' };
  }

  const channelData = (channel.data || {}) as Record<string, unknown>;
  const explicitTitle =
    normalizeName(typeof channelData.title === 'string' ? channelData.title : undefined) ||
    normalizeName(typeof channelData.name === 'string' ? channelData.name : undefined);
  const membersArray = channel.state?.members ? Object.values(channel.state.members) : [];
  const counterpart =
    membersArray.find((member) => member.user?.id !== currentUserId) ?? membersArray[0];

  const petOwnerName =
    typeof channelData.petOwnerName === 'string' ? channelData.petOwnerName : undefined;
  const petName = typeof channelData.petName === 'string' ? channelData.petName : undefined;

  const counterpartName = normalizeName(counterpart?.user?.name || counterpart?.user_id);
  const counterpartImage = counterpart?.user?.image;

  const title =
    explicitTitle ||
    (petName && petOwnerName ? `${petName} (${petOwnerName})` : undefined) ||
    petOwnerName ||
    petName ||
    counterpartName ||
    explicitTitle ||
    channel.id ||
    'Chat';

  const image =
    (typeof channelData.image === 'string' ? channelData.image : undefined) || counterpartImage;

  return { title, image };
};

export const resolveChannelScope = (channel: StreamChannel): ChatScope => {
  const data = (channel.data || {}) as Record<string, unknown>;
  const rawCategory = [
    data.chatCategory,
    data.channelCategory,
    data.category,
    data.chat_type as string | undefined,
    data.channelType as string | undefined,
  ].find((value): value is string => typeof value === 'string');

  const normalizedCategory = rawCategory?.toLowerCase();

  if (
    normalizedCategory === 'client' ||
    normalizedCategory === 'clients' ||
    normalizedCategory === 'pet-parent' ||
    normalizedCategory === 'pet_parent'
  ) {
    return 'clients';
  }

  if (
    normalizedCategory === 'colleague' ||
    normalizedCategory === 'colleagues' ||
    normalizedCategory === 'team' ||
    normalizedCategory === 'staff' ||
    normalizedCategory === 'internal'
  ) {
    return 'colleagues';
  }

  if (
    normalizedCategory === 'group' ||
    normalizedCategory === 'groups' ||
    normalizedCategory === 'common' ||
    normalizedCategory === 'broadcast'
  ) {
    return 'groups';
  }

  const memberCount = (() => {
    const members = channel.state?.members;
    if (members && Object.keys(members).length > 0) {
      return Object.keys(members).length;
    }
    const count = (data as any)?.member_count;
    return typeof count === 'number' ? Number(count) : 0;
  })();

  const hasAppointmentDetails = Boolean(
    (data as any)?.appointmentId || (data as any)?.petOwnerId || (data as any)?.petOwnerName
  );

  if (hasAppointmentDetails) {
    return 'clients';
  }

  if ((data as any)?.isGroup === true || (data as any)?.group === true || memberCount > 2) {
    return 'groups';
  }

  // Default to colleagues for internal PMS chats when no metadata is present
  return 'colleagues';
};

export const formatRowTime = (value?: Date | string | null): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const isCounterpartOnline = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): boolean => {
  const members = channel?.state?.members ? Object.values(channel.state.members) : [];
  const counterpart = members.find((member) => member.user?.id !== currentUserId);
  return Boolean(counterpart?.user?.online);
};

export const formatClosedTime = (timestamp?: string) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDisplayDate(date);
};
