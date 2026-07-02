'use client';

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  Chat,
  Channel,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  TypingIndicator,
  Window,
  useChannelStateContext,
  useChatContext,
  ComponentProvider,
} from 'stream-chat-react';
import { StreamChat } from 'stream-chat';
import type { Channel as StreamChannel } from 'stream-chat';
import type { ChannelPreviewUIComponentProps, ChannelListProps } from 'stream-chat-react';
import { LuSearch, LuCommand, LuMessageSquarePlus, LuArchive, LuGlobe } from 'react-icons/lu';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Text from '@/app/ui/Text';
import { Badge } from '@/app/ui';
import ConversationRow from './ConversationRow';
import { ChatAvatar } from './ChatAvatar';
import { ChatHeaderContext } from './ChatHeaderContext';
import ChatMessage from './ChatMessage';
import ChatComposer from './ChatComposer';
import ChatCommandPalette from './ChatCommandPalette';
import ShareEntityModal from './ShareEntityModal';
import MessageSearch from './MessageSearch';
import NetworkDirectoryModal from './NetworkDirectoryModal';
import { GroupModal, type OrgUserOption } from './GroupModal';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { ChatShareContext } from './chatShareContext';
import clsx from 'clsx';

import 'stream-chat-react/dist/css/v2/index.css';
import './ChatContainer.css';

import {
  getChatClient,
  connectStreamUser,
  endChatChannel,
  getAppointmentChannel,
} from '@/app/features/chat/services/streamChatService';
import { formatDisplayDate } from '@/app/lib/date';
import { buildWorkspaceHref } from '@/app/lib/appointmentWorkspace';
import {
  createOrgDirectChat,
  createOrgGroupChat,
  fetchOrgUsers,
  addGroupMembers,
  removeGroupMembers,
  updateGroup,
  deleteGroup,
  getChatSessions,
  getChatSession,
  listOrgChatSessions,
} from '@/app/features/chat/services/chatService';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { useNotify } from '@/app/hooks/useNotify';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useLoadAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useLoadCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { useRouter } from 'next/navigation';
import Reschedule from '@/app/features/appointments/pages/Appointments/Sections/Reschedule';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

const GroupModalContext = createContext<{
  openEdit?: (channel: StreamChannel) => void;
  openCreate?: () => void;
}>({});
const ChatSessionStatusContext = createContext<{
  statusByAppointmentId: Record<string, 'active' | 'ended'>;
  refreshStatuses: () => void;
}>({
  statusByAppointmentId: {},
  refreshStatuses: () => undefined,
});
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const CHAT_PAGE_SKELETON = <PageSkeleton variant="list" />;

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
  scope?: ChatScope;
  onScopeChange?: (scope: ChatScope) => void;
}

// Active-pill colour per position mirrors the Calendar / Board / Table view
// switcher (TitleCalendar): primary, success, then the dark text colour.
const SCOPE_TABS: ReadonlyArray<{ key: ChatScope; label: string; slider: string }> = [
  // "Pet parents" is the designated owner term (matches the per-chat badge);
  // avoids the old "Clients" tab vs "Pet parent" badge collision on this screen.
  { key: 'clients', label: 'Pet parents', slider: 'bg-(--color-primary-700)' },
  { key: 'colleagues', label: 'Colleagues', slider: 'bg-success-700' },
  { key: 'groups', label: 'Groups', slider: 'bg-text-primary' },
];

/**
 * Self-contained audience switcher. The active pill is driven by LOCAL state so
 * it paints and starts sliding immediately on click; the heavier scope change is
 * deferred to the parent on the next macrotask so re-filtering the channel list
 * never blocks the animation. (startTransition is intentionally avoided: it can
 * commit the final state without an intermediate paint, cancelling the CSS
 * transition.) Motion mirrors the Calendar/Board/Table view switcher.
 */
function ChatScopeSwitcher({
  scope,
  onScopeChange,
}: Readonly<{ scope?: ChatScope; onScopeChange?: (next: ChatScope) => void }>) {
  const activeIndex = Math.max(
    0,
    SCOPE_TABS.findIndex((t) => t.key === scope)
  );
  const [index, setIndex] = useState(activeIndex);
  useEffect(() => {
    setIndex(activeIndex);
  }, [activeIndex]);

  return (
    <fieldset
      aria-label="Chat audience"
      className="relative m-0 flex h-10 w-full items-stretch overflow-hidden rounded-[999px]! border border-card-border bg-white p-0"
    >
      <legend className="sr-only">Chat audience</legend>
      <div
        aria-hidden
        className={clsx(
          'absolute top-0 bottom-0 w-1/3 rounded-[999px]! transition-all duration-300 ease-in-out',
          SCOPE_TABS[index].slider
        )}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {SCOPE_TABS.map((t, i) => {
        const isActive = index === i;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setIndex(i);
              setTimeout(() => onScopeChange?.(t.key), 0);
            }}
            aria-pressed={isActive}
            className={clsx(
              'relative z-10 flex w-1/3 items-center justify-center gap-1.5 text-body-4 transition-colors',
              isActive
                ? 'text-neutral-0 duration-150 delay-150'
                : 'text-text-secondary hover:text-text-primary duration-100 delay-0'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </fieldset>
  );
}

interface ChannelPreviewWrapperProps extends ChannelPreviewUIComponentProps {
  onPreviewSelect?: (channel: StreamChannel | null) => void;
  currentUserId?: string | null;
  archived?: boolean;
}

interface ChatLayoutProps {
  filters: ChannelListProps['filters'];
  sort: ChannelListProps['sort'];
  options: ChannelListProps['options'];
  isMobile: boolean;
  isChannelSelected: boolean;
  previewComponent: ComponentType<ChannelPreviewUIComponentProps>;
  onBack: () => void;
  currentUserId?: string | null;
  channelFilter?: NonNullable<ChannelListProps['channelRenderFilterFn']>;
  showEmpty?: boolean;
  channelListHeader?: ReactNode;
}

interface ChatMainPanelProps {
  isMobile: boolean;
  isChannelSelected: boolean;
  showBackButton: boolean;
  onBack: () => void;
  currentUserId?: string | null;
  showEmpty?: boolean;
}

interface ChatWindowProps {
  showBackButton: boolean;
  onBack: () => void;
  currentUserId?: string | null;
}

interface ChannelDisplayInfo {
  title: string;
  image?: string;
}

interface ChannelState {
  frozen: boolean;
  updatedAt?: string;
  closedAt?: string;
}

export type ChatScope = 'clients' | 'colleagues' | 'groups';

const normalizeName = (value?: string) => {
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

const getSessionIdFromChannel = (chan: StreamChannel): string | undefined => {
  const data = (chan.data as any) || {};
  return data.groupId || data.directId || data._id || undefined;
};

const findSessionByStoredId = (sessions: Array<{ _id: string }>, storedId?: string) => {
  if (!storedId) return undefined;
  return sessions.find((s) => s._id === storedId);
};

const matchesDirectSession = (session: any, channelMemberIds: string[]) => {
  if (session.type !== 'ORG_DIRECT' || channelMemberIds.length !== 2) {
    return false;
  }
  const sessionMembers = session.members || [];
  const allMembersMatch = sessionMembers.every((sm: string) => channelMemberIds.includes(sm));
  return allMembersMatch && sessionMembers.length === channelMemberIds.length;
};

const matchesGroupSession = (session: any, channelMemberIds: string[], channelTitle?: string) => {
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

const matchesChannelId = (session: any, chan: StreamChannel) => {
  if (session.channelId === chan.id) return true;
  if (chan.cid && session.channelId === chan.cid) return true;
  if (chan.id && session.channelId && chan.id.includes(session.channelId)) return true;
  if (session.channelId?.includes?.(chan.id)) return true;
  return false;
};

const getChannelDisplayInfo = (
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
    (petName && petOwnerName ? `${petName}{' '}(${petOwnerName})` : undefined) ||
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

const resolveChannelScope = (channel: StreamChannel): ChatScope => {
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

// Custom hook for channel state management
const useChannelState = () => {
  const { channel } = useChannelStateContext();
  const [state, setState] = useState<ChannelState>({
    frozen: false,
    updatedAt: undefined,
    closedAt: undefined,
  });

  useEffect(() => {
    if (channel) {
      const channelData = channel.data as any;
      const isFrozen = channelData?.frozen === true;
      const updatedAt = channelData?.updated_at;
      const closedAt = channelData?.closedAt || channelData?.closed_at;

      setState({ frozen: isFrozen, updatedAt, closedAt });

      // Listen for channel updates
      const handleChannelUpdate = () => {
        const updatedData = channel.data as any;
        const newFrozen = updatedData?.frozen === true;
        const newUpdatedAt = updatedData?.updated_at;
        const newClosedAt = updatedData?.closedAt || updatedData?.closed_at;
        setState({ frozen: newFrozen, updatedAt: newUpdatedAt, closedAt: newClosedAt });
      };

      channel.on('channel.updated', handleChannelUpdate);

      return () => {
        channel.off('channel.updated', handleChannelUpdate);
      };
    }
  }, [channel]);

  return state;
};

const ChannelHeaderWithCounterpart: FC<{
  currentUserId?: string | null;
}> = ({ currentUserId }) => {
  const { channel } = useChannelStateContext();
  const chatSessionStatusCtx = use(ChatSessionStatusContext);
  const { statusByAppointmentId } = chatSessionStatusCtx;
  const groupModalCtx = use(GroupModalContext);
  const { notify } = useNotify();
  const [closingSession, setClosingSession] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [completingAppointment, setCompletingAppointment] = useState(false);
  const { title } = getChannelDisplayInfo(channel, currentUserId);
  const scope = channel ? resolveChannelScope(channel) : 'colleagues';
  const channelMemberCount = channel?.state?.members
    ? Object.keys(channel.state.members).length
    : 0;
  const dataType =
    typeof (channel?.data as any)?.type === 'string' ? (channel?.data as any).type : undefined;
  const chatCategory =
    typeof (channel?.data as any)?.chatCategory === 'string'
      ? (channel?.data as any).chatCategory
      : undefined;
  const isTeamChannel = (channel?.type || '').toLowerCase() === 'team';
  const isOrgGroupType = dataType === 'ORG_GROUP' || (chatCategory || '').toLowerCase() === 'group';
  const isClientChat = scope === 'clients';
  const isGroupChat =
    scope === 'groups' || isOrgGroupType || (isTeamChannel && channelMemberCount > 2);

  const appointmentId = (channel?.data as any)?.appointmentId;
  const backendStatus = appointmentId ? statusByAppointmentId[appointmentId] : undefined;
  const patientId = (channel?.data as any)?.patientId as string | undefined;
  const appointment = useAppointmentStore((s) =>
    appointmentId ? s.appointmentsById[appointmentId] : undefined
  );
  const companion = useCompanionStore((s) => (patientId ? s.companionsById[patientId] : undefined));
  const router = useRouter();

  // Check if session is already closed
  useEffect(() => {
    if (channel) {
      const status = (channel.data as any)?.status;
      const frozen = (channel.data as any)?.frozen;
      const isSessionClosed = status === 'ended' || frozen === true || backendStatus === 'ended';
      setSessionClosed(isSessionClosed);
    }
  }, [channel, backendStatus]);

  const handleCloseSession = async () => {
    if (!channel) return;

    // Prevent duplicate calls if already closing or already closed
    if (closingSession || sessionClosed) return;

    const confirmed = confirm(
      'Are you sure you want to close this chat session? The client will no longer be able to send messages.'
    );
    if (!confirmed) {
      return;
    }

    setClosingSession(true);
    try {
      const appointmentId = (channel.data as any)?.appointmentId;
      if (appointmentId) {
        const session = await getChatSession(appointmentId);
        const sessionId = (session as any)?._id || (session as any)?.id;
        if (!sessionId) {
          throw new Error('Chat session not found for this appointment');
        }
        await endChatChannel(sessionId);
        chatSessionStatusCtx.refreshStatuses();
        setSessionClosed(true);
        notify('success', {
          title: 'Chat session closed',
          text: 'Chat session closed successfully',
        });
      }
    } catch (error) {
      console.error('Failed to close chat session:', error);
      notify('error', {
        title: 'Couldn’t close chat session',
        text: 'Please try again.',
      });
    } finally {
      setClosingSession(false);
    }
  };

  const hasSessionClosed = sessionClosed;
  const online = isCounterpartOnline(channel, currentUserId);
  let baseStatus: string;
  if (isGroupChat) baseStatus = `${channelMemberCount} members`;
  else if (hasSessionClosed) baseStatus = 'Chat closed';
  else baseStatus = online ? 'Active now' : 'Offline';
  const statusText =
    isClientChat && !hasSessionClosed ? `${baseStatus} · via pet parent app` : baseStatus;

  const handleAppointmentComplete = async () => {
    if (!appointment || completingAppointment) return;
    setCompletingAppointment(true);
    try {
      await changeAppointmentStatus(appointment, 'COMPLETED');
      notify('success', {
        title: 'Appointment completed',
        text: 'The visit has been marked complete.',
      });
    } catch (error) {
      notify('error', {
        title: 'Unable to complete',
        text: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setCompletingAppointment(false);
    }
  };

  const handleApptAction = (action: string) => {
    if (!appointmentId) {
      router.push('/appointments');
      return;
    }
    if (action === 'Reschedule') {
      if (appointment) {
        setRescheduleOpen(true);
        return;
      }
      router.push(buildWorkspaceHref(appointmentId));
      return;
    }
    if (action === 'Send form') {
      router.push(buildWorkspaceHref(appointmentId, 'INVOICE'));
      return;
    }
    if (action === 'Mark complete') {
      void handleAppointmentComplete();
      return;
    }
    if (action === 'Book follow-up') {
      if (appointment?.companion?.id || appointment?.patient?.id) {
        setFollowUpOpen(true);
        return;
      }
      router.push('/appointments');
      return;
    }
    router.push(buildWorkspaceHref(appointmentId));
  };

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-chat-divider bg-neutral-0 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <ChatAvatar
          name={title}
          online={!isGroupChat && !hasSessionClosed && online}
          group={isGroupChat}
          size="sm"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <Text
              as="span"
              variant="body-3-emphasis"
              className="min-w-0 flex-1 truncate text-neutral-900"
            >
              {title}
            </Text>
            {/* "Pet parent" is the fixed owner term and is NOT subject to the animal-terminology rewrite. */}
            {isClientChat && (
              <span className="hidden shrink-0 items-center self-center sm:inline-flex">
                <Badge tone="warning">Pet parent</Badge>
              </span>
            )}
          </span>
          <Text as="span" variant="caption-2" className="truncate text-neutral-500">
            {statusText}
          </Text>
        </div>
        {/* No phone/video calling in chat. */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MessageSearch />
          {isGroupChat && (
            <Primary
              text="Group Info"
              onClick={() => {
                if (channel) {
                  groupModalCtx.openEdit?.(channel);
                }
              }}
            />
          )}
          {isClientChat && hasSessionClosed && <Badge tone="neutral">Session closed</Badge>}
          {isClientChat && !hasSessionClosed && (
            <Primary
              text={closingSession ? 'Closing…' : 'Close session'}
              onClick={handleCloseSession}
              isDisabled={closingSession}
            />
          )}
        </div>
      </header>
      {isClientChat && (
        <>
          <ChatHeaderContext
            allergy={companion?.allergy?.trim() || undefined}
            alerts={companion?.alerts}
            appointment={appointment}
            completing={completingAppointment}
            onAction={handleApptAction}
          />
          {appointment && (
            <Reschedule
              showModal={rescheduleOpen}
              setShowModal={setRescheduleOpen}
              activeAppointment={appointment}
            />
          )}
          <AddAppointmentCentralModal
            showModal={followUpOpen}
            setShowModal={setFollowUpOpen}
            setActiveFilter={() => undefined}
            setActiveStatus={() => undefined}
            initialCompanionId={appointment?.companion?.id ?? appointment?.patient?.id ?? null}
          />
        </>
      )}
    </>
  );
};

const formatRowTime = (value?: Date | string | null): string => {
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isCounterpartOnline = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): boolean => {
  const members = channel?.state?.members ? Object.values(channel.state.members) : [];
  const counterpart = members.find((member) => member.user?.id !== currentUserId);
  return Boolean(counterpart?.user?.online);
};

const isChannelMuted = (channel: StreamChannel | null | undefined): boolean => {
  try {
    return Boolean(channel?.muteStatus?.().muted);
  } catch {
    return false;
  }
};

type TriageHandlers = {
  onMute?: () => void;
  onUnmute?: () => void;
  onSnooze?: (durationMs: number) => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
};

const buildTriageHandlers = (
  channel: StreamChannel | null | undefined,
  archived: boolean | undefined
): TriageHandlers => {
  if (!channel) return {};
  return {
    onMute: () => void channel.mute(),
    onUnmute: () => void channel.unmute(),
    onSnooze: (durationMs: number) => void channel.mute({ expiration: durationMs }),
    onArchive: archived ? undefined : () => void channel.hide(),
    onUnarchive: archived ? () => void channel.show() : undefined,
  };
};

const ChannelPreviewWrapper: FC<ChannelPreviewWrapperProps> = ({
  onPreviewSelect,
  currentUserId,
  archived,
  ...previewProps
}) => {
  const wasActiveRef = useRef(false);
  const channel = previewProps.channel;

  useEffect(() => {
    const isActive = Boolean(previewProps.active);
    if (isActive && !wasActiveRef.current) {
      onPreviewSelect?.(channel ?? null);
    }
    wasActiveRef.current = isActive;
  }, [previewProps.active, channel, onPreviewSelect]);

  const { title } = getChannelDisplayInfo(channel ?? null, currentUserId);
  const scope = channel ? resolveChannelScope(channel) : 'colleagues';
  const lastText = previewProps.lastMessage?.text?.trim();
  const lastAt = channel?.state?.last_message_at ?? undefined;
  const muted = isChannelMuted(channel);
  const triage = buildTriageHandlers(channel, archived);

  return (
    <ConversationRow
      name={title}
      preview={lastText || 'No messages yet'}
      time={formatRowTime(lastAt)}
      unread={previewProps.unread}
      online={isCounterpartOnline(channel, currentUserId)}
      group={scope === 'groups'}
      viaApp={scope === 'clients'}
      network={Boolean((channel?.data as Record<string, unknown> | undefined)?.network)}
      muted={muted}
      active={previewProps.active}
      onClick={(event) => {
        if (previewProps.onSelect) previewProps.onSelect(event);
        else previewProps.setActiveChannel?.(channel, previewProps.watchers);
      }}
      {...triage}
    />
  );
};

const createPreviewComponent = (
  onPreviewSelect: (channel: StreamChannel | null) => void,
  currentUserId?: string | null,
  archived = false
): ComponentType<ChannelPreviewUIComponentProps> => {
  const PreviewComponent: FC<ChannelPreviewUIComponentProps> = (props) => (
    <ChannelPreviewWrapper
      {...props}
      onPreviewSelect={onPreviewSelect}
      currentUserId={currentUserId}
      archived={archived}
    />
  );

  PreviewComponent.displayName = 'ChatChannelPreview';
  return PreviewComponent;
};

// Channel-list pagination using our reusable Primary button instead of
// Stream's full-width default. Rendered by ChannelList at the foot of the list.
const ChatChannelListPaginator: FC<
  PropsWithChildren<{ loadNextPage: () => void; hasNextPage?: boolean; isLoading?: boolean }>
> = ({ children, loadNextPage, hasNextPage, isLoading }) => (
  <>
    {children}
    {hasNextPage && (
      <div className="flex justify-center px-3 py-3">
        <Primary
          text={isLoading ? 'Loading…' : 'Load more'}
          onClick={loadNextPage}
          isDisabled={isLoading}
        />
      </div>
    )}
  </>
);

const CHAT_SORT = [{ last_message_at: -1 as const }];
const CHAT_OPTIONS = { state: true, watch: true, presence: true };

const formatClosedTime = (timestamp?: string) => {
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

const ChatClosedFooter: FC<{ closedAt?: string }> = ({ closedAt }) => {
  const formattedClosedTime = formatClosedTime(closedAt);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 border-t border-chat-divider bg-chat-surface-soft px-4 py-4">
      <Text as="p" variant="body-4-emphasis" className="text-neutral-700">
        Chat session closed
      </Text>
      {formattedClosedTime && (
        <Text as="p" variant="caption-2" className="text-neutral-500">
          {formattedClosedTime}
        </Text>
      )}
    </div>
  );
};

// Shared component for channel window content with different header components
interface ChannelWindowContentProps {
  currentUserId?: string | null;
  headerComponent: ComponentType<{ currentUserId?: string | null }>;
}

const ChannelWindowContent: FC<ChannelWindowContentProps> = ({
  currentUserId,
  headerComponent: HeaderComponent,
}) => {
  const { channel } = useChannelStateContext();
  const { statusByAppointmentId } = use(ChatSessionStatusContext);
  const channelState = useChannelState();
  const HeaderComponentTyped = HeaderComponent;
  const appointmentId = (channel?.data as any)?.appointmentId;
  const backendStatus = appointmentId ? statusByAppointmentId[appointmentId] : undefined;
  const isClosed = channelState.frozen || backendStatus === 'ended';

  return (
    <div className="str-chat__window">
      <Window>
        <HeaderComponentTyped currentUserId={currentUserId} />
        <MessageList />
        {isClosed ? (
          <ChatClosedFooter closedAt={channelState.closedAt || channelState.updatedAt} />
        ) : (
          <>
            <TypingIndicator />
            <MessageInput Input={ChatComposer} />
          </>
        )}
      </Window>
    </div>
  );
};

// Specialized components for different use cases with distinct implementations
// Reuse ChannelWindowContent for both appointment and regular channels
const RegularChannelWindow: FC<{ currentUserId?: string | null }> = ({ currentUserId }) => (
  <ChannelWindowContent
    headerComponent={ChannelHeaderWithCounterpart}
    currentUserId={currentUserId}
  />
);

const ChatEmptyThread: FC = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
    <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-chat-panel text-primary-600">
      <LuMessageSquarePlus className="h-6 w-6" />
    </span>
    <Text as="p" variant="body-3-emphasis" className="text-neutral-700">
      No messages yet
    </Text>
    <Text as="p" variant="caption-1" className="text-neutral-500">
      Send the first message to start the conversation.
    </Text>
  </div>
);

const ChatWindow: FC<ChatWindowProps> = ({ showBackButton, onBack, currentUserId }) => {
  const shouldShowBackButton = showBackButton;

  return (
    <>
      {shouldShowBackButton && (
        <button type="button" className="chat-back-button" onClick={onBack}>
          ← Back
        </button>
      )}
      <Channel Message={ChatMessage} EmptyStateIndicator={ChatEmptyThread}>
        <RegularChannelWindow currentUserId={currentUserId} />
        <Thread />
      </Channel>
    </>
  );
};

const ChatMainPanel: FC<ChatMainPanelProps> = ({
  isMobile,
  isChannelSelected,
  showBackButton,
  onBack,
  currentUserId,
  showEmpty,
}) => {
  const shouldShowChat = isMobile ? isChannelSelected : true;

  return (
    <div
      className="str-chat__main-panel"
      style={{
        display: shouldShowChat ? 'flex' : 'none',
        flex: '1 1 0%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {showEmpty ? (
        <div className="chat-empty-state">
          <span className="chat-empty-state__art" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </span>
          <Text as="h2" variant="heading-3" className="chat-empty-state__title">
            Your conversations live here
          </Text>
          <Text as="p" variant="body-3" className="chat-empty-state__subtitle">
            Pick a chat from the list to read and reply, or start a new one to message a client or a
            colleague.
          </Text>
        </div>
      ) : (
        <ChatWindow
          showBackButton={showBackButton && isMobile && isChannelSelected}
          onBack={onBack}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

const ChatLayout: FC<ChatLayoutProps> = ({
  filters,
  sort,
  options,
  isMobile,
  isChannelSelected,
  previewComponent,
  onBack,
  currentUserId,
  channelFilter,
  showEmpty,
  channelListHeader,
}) => {
  const shouldShowChannelList = !isMobile || !isChannelSelected;

  return (
    <div className="str-chat__container">
      <div
        className="str-chat__channel-list-wrapper"
        style={{ display: shouldShowChannelList ? 'flex' : 'none' }}
      >
        {channelListHeader}
        <ComponentProvider
          value={{
            ChannelPreviewActionButtons: () => null,
          }}
        >
          <ChannelList
            filters={filters}
            sort={sort}
            options={options}
            Preview={previewComponent}
            Paginator={ChatChannelListPaginator}
            channelRenderFilterFn={channelFilter}
            setActiveChannelOnMount={false}
          />
        </ComponentProvider>
      </div>

      <ChatMainPanel
        isMobile={isMobile}
        isChannelSelected={isChannelSelected}
        showBackButton
        onBack={onBack}
        currentUserId={currentUserId}
        showEmpty={showEmpty}
      />
    </div>
  );
};

const AppointmentChannelInitializer: FC<{
  appointmentId?: string;
  onActivated: (channel: StreamChannel) => void;
  onCleared: () => void;
}> = ({ appointmentId, onActivated, onCleared }) => {
  const chatContext = useChatContext();
  const { client } = chatContext;
  const prevAppointmentIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const activateAppointmentChannel = async () => {
      const prevAppointmentId = prevAppointmentIdRef.current;
      prevAppointmentIdRef.current = appointmentId;

      if (!appointmentId) {
        if (prevAppointmentId) {
          onCleared();
        }
        return;
      }
      if (!client) return;

      try {
        const channel = await getAppointmentChannel(appointmentId);
        if (cancelled) return;
        chatContext.setActiveChannel?.(channel);
        onActivated(channel);
      } catch (err) {
        console.error('Failed to activate appointment channel', err);
      }
    };

    activateAppointmentChannel();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, client, chatContext, onActivated, onCleared]);

  return null;
};

/**
 * Clears Stream's active channel whenever the audience scope changes. Without
 * this the previously opened conversation stays "active" on the chat context,
 * so on mobile its preview re-mounts with active=true after the list re-filters
 * and auto-reopens the chat instead of showing the conversation list. Lives
 * inside <Chat> so it can reach the chat context's setActiveChannel.
 */
const ScopeChangeChannelReset: FC<{ scope?: ChatScope }> = ({ scope }) => {
  const { setActiveChannel } = useChatContext();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    setActiveChannel?.(undefined);
  }, [scope, setActiveChannel]);

  return null;
};

export const ChatContainer: FC<ChatContainerProps> = ({
  appointmentId,
  onChannelSelect,
  className = '',
  scope = 'clients',
  onScopeChange,
}) => {
  useLoadAppointmentsForPrimaryOrg();
  useLoadCompanionsForPrimaryOrg();
  const attributes = useAuthStore((state) => state.attributes);
  const authStatus = useAuthStore((state) => state.status);
  const authLoading = useAuthStore((state) => state.loading);

  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const orgStatus = useOrgStore((state) => state.status);
  const crossOrgEnabled = useOrgStore((state) =>
    Boolean(state.getPrimaryOrg()?.crossOrgMessagingEnabled)
  );
  const [client, setClient] = useState<StreamChat | null>(null);
  const scopeInitialized = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChannelSelected, setIsChannelSelected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showEmptyPlaceholder, setShowEmptyPlaceholder] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUserOption[]>([]);
  const [orgUsersLoaded, setOrgUsersLoaded] = useState(false);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);
  const [statusByAppointmentId, setStatusByAppointmentId] = useState<
    Record<string, 'active' | 'ended'>
  >({});
  const [directSearch, setDirectSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [shareChannelId, setShareChannelId] = useState<string | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [directListHover, setDirectListHover] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create');
  const [groupModalChannel, setGroupModalChannel] = useState<StreamChannel | null>(null);
  const [groupModalTitle, setGroupModalTitle] = useState('');
  const [groupModalPlaceholder, setGroupModalPlaceholder] = useState('');
  const [groupModalMembers, setGroupModalMembers] = useState<string[]>([]);
  const [groupModalBackendId, setGroupModalBackendId] = useState<string | undefined>();
  const [groupModalSearch, setGroupModalSearch] = useState('');
  const [groupModalBusy, setGroupModalBusy] = useState(false);
  const groupModalOwnerRef = useRef<string | undefined>(undefined);

  const { notify } = useNotify();

  const directBlurTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useChatNotifications(client);

  const getSessionChannels = useCallback((payload: any) => {
    if (Array.isArray(payload?.channels)) return payload.channels;
    if (Array.isArray(payload?.data?.channels)) return payload.data.channels;
    if (Array.isArray(payload?.sessions)) return payload.sessions;
    if (Array.isArray(payload)) return payload;
    return [];
  }, []);

  const refreshStatuses = useCallback(() => {
    if (!primaryOrgId) return;
    getChatSessions(primaryOrgId, { includeClosed: true })
      .then((response) => {
        const payload: any = response ?? {};
        const channels = getSessionChannels(payload);
        const next: Record<string, 'active' | 'ended'> = {};
        channels.forEach((session: any) => {
          if (session.appointmentId) {
            const rawStatus = String(session.status || '').toLowerCase();
            next[session.appointmentId] =
              rawStatus === 'closed' || rawStatus === 'ended' ? 'ended' : 'active';
          }
        });
        setStatusByAppointmentId(next);
      })
      .catch((err) => {
        console.error('Failed to load chat session statuses:', err);
      });
  }, [getSessionChannels, primaryOrgId]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  useEffect(() => {
    setOrgUsersLoaded(false);
    setOrgUsers([]);
  }, [primaryOrgId]);

  useLayoutEffect(() => {
    if (!appointmentId) return;
    setIsChannelSelected(false);
    setShowEmptyPlaceholder(true);
  }, [appointmentId]);

  const resolveGroupIdForChannel = useCallback(
    async (chan: StreamChannel | null) => {
      if (!chan) return undefined;
      // ALWAYS query backend sessions API to get the correct session _id
      // The groupId/directId stored in channel data might be the Stream channel ID, not the backend session ID
      if (!primaryOrgId) {
        return getSessionIdFromChannel(chan);
      }
      try {
        // First check if channel already has a valid backend session ID stored
        const storedGroupId = (chan.data as any)?.groupId;
        const storedDirectId = (chan.data as any)?.directId;

        const sessions = await listOrgChatSessions(primaryOrgId);

        // Get channel members for matching
        const channelMemberIds = chan.state?.members ? Object.keys(chan.state.members) : [];
        const channelTitle = (chan.data as any)?.title || (chan.data as any)?.name;

        // First, check if the stored groupId/directId matches any session _id
        const matchedGroup = findSessionByStoredId(sessions, storedGroupId);
        if (matchedGroup) {
          return matchedGroup._id;
        }
        const matchedDirect = findSessionByStoredId(sessions, storedDirectId);
        if (matchedDirect) {
          return matchedDirect._id;
        }

        // Match by channelId first, then by members as fallback
        const matched = sessions.find((s) => {
          if (matchesChannelId(s, chan)) return true;
          if (matchesDirectSession(s, channelMemberIds)) return true;
          if (matchesGroupSession(s, channelMemberIds, channelTitle)) return true;
          return false;
        });
        if (matched?._id) {
          return matched._id;
        }

        // Fallback to channel data if no session found
        return getSessionIdFromChannel(chan);
      } catch (err) {
        console.error('Failed to resolve group id for channel', err);
        return getSessionIdFromChannel(chan);
      }
    },
    [primaryOrgId]
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(globalThis.innerWidth <= 768);
    };

    handleResize();
    globalThis.addEventListener('resize', handleResize);
    return () => globalThis.removeEventListener('resize', handleResize);
  }, []);

  // Initialize chat
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (authStatus === 'unauthenticated') {
          if (!cancelled) {
            setError('User not authenticated');
            setLoading(false);
          }
          return;
        }

        // Wait until auth/org data is available
        if (!attributes || !primaryOrgId) {
          return;
        }

        const userId = attributes.sub || attributes.email;
        const userName =
          [attributes.given_name, attributes.family_name].filter(Boolean).join(' ').trim() ||
          attributes.email;
        const userImage = attributes.picture;

        const chatClient = getChatClient();

        // Only connect if not already connected to this user
        if (chatClient.userID !== userId) {
          await connectStreamUser(userId, userName, userImage);
        }

        if (!cancelled) {
          setClient(chatClient);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load chat');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [attributes, primaryOrgId, authStatus]);

  const handlePreviewSelect = useCallback(
    (channel: StreamChannel | null) => {
      setIsChannelSelected(true);
      setShowEmptyPlaceholder(false);
      onChannelSelect?.(channel);
    },
    [onChannelSelect]
  );

  useLayoutEffect(() => {
    // Reset selection when switching audience scopes so stale channels do not persist
    const hasInitialized = scopeInitialized.current;
    scopeInitialized.current = true;
    if (!hasInitialized) return;

    setIsChannelSelected(false);
    setShowEmptyPlaceholder(true);
    onChannelSelect?.(null);
  }, [scope, onChannelSelect]);

  // Load org users for colleague/group creation flows
  useLayoutEffect(() => {
    const shouldLoadUsers = (scope === 'colleagues' || scope === 'groups') && primaryOrgId;
    if (!shouldLoadUsers) return;
    if (orgUsersLoaded || orgUsersLoading) return;

    setOrgUsersLoading(true);
    if (!primaryOrgId) return;
    fetchOrgUsers(primaryOrgId)
      .then((users) => {
        setOrgUsers(
          users.flatMap((u) =>
            u?.id
              ? [
                  {
                    id: u.id,
                    userId: u.userId,
                    practitionerId: u.practitionerId,
                    name: u.name || u.email || 'User',
                    email: u.email,
                    image: u.image,
                    role: u.role,
                  },
                ]
              : []
          )
        );
        setOrgUsersLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load org users for chat:', err);
      })
      .finally(() => setOrgUsersLoading(false));
  }, [scope, primaryOrgId, orgUsersLoaded, orgUsersLoading]);

  const openCreateGroupModal = useCallback(() => {
    setGroupModalMode('create');
    setGroupModalChannel(null);
    setGroupModalTitle('');
    setGroupModalPlaceholder('');
    setGroupModalMembers([]);
    setGroupModalBackendId(undefined);
    groupModalOwnerRef.current = client?.userID;
    setGroupModalSearch('');
    setGroupModalOpen(true);
  }, [client]);

  const openEditGroupModal = useCallback(
    async (chan: StreamChannel) => {
      setGroupModalMode('edit');
      setGroupModalChannel(chan);
      const placeholder =
        normalizeName(
          typeof (chan.data as any)?.title === 'string' ? (chan.data as any).title : undefined
        ) ||
        normalizeName(
          typeof (chan.data as any)?.name === 'string' ? (chan.data as any).name : undefined
        ) ||
        '';
      setGroupModalPlaceholder(placeholder);
      setGroupModalTitle('');
      const memberIds = chan.state?.members ? Object.keys(chan.state.members) : [];
      setGroupModalMembers(memberIds);
      // Find owner from members array (role: "owner") or fallback to created_by
      const membersArray = chan.state?.members ? Object.values(chan.state.members) : [];
      const ownerMember = membersArray.find((m: any) => m.role === 'owner');
      groupModalOwnerRef.current =
        ownerMember?.user_id ||
        ownerMember?.user?.id ||
        (chan.data as any)?.createdBy ||
        (chan as any)?.created_by?.id;
      const backendId = await resolveGroupIdForChannel(chan);
      setGroupModalBackendId(backendId);
      setGroupModalSearch('');
      setGroupModalOpen(true);
    },
    [resolveGroupIdForChannel]
  );

  const previewComponent = useMemo(
    () => createPreviewComponent(handlePreviewSelect, client?.userID, showArchived),
    [handlePreviewSelect, client?.userID, showArchived]
  );

  const channelFilter = useCallback<NonNullable<ChannelListProps['channelRenderFilterFn']>>(
    (channels) => {
      const scopeMatches = (chan: StreamChannel) => {
        if (!scope) return true;
        // Allow team/direct org channels regardless of missing chatCategory
        const type = (chan.type || '').toLowerCase();
        const resolvedScope = resolveChannelScope(chan);
        if (type === 'team') {
          // team channels are colleague unless >2 members (then group)
          if (
            scope === 'colleagues' &&
            chan.state?.members &&
            Object.keys(chan.state.members).length <= 2
          ) {
            return true;
          }
          if (
            scope === 'groups' &&
            chan.state?.members &&
            Object.keys(chan.state.members).length > 2
          ) {
            return true;
          }
        }
        // fallback to standard category resolution
        return resolvedScope === scope;
      };
      const q = searchTerm.trim().toLowerCase();
      const searchMatches = (chan: StreamChannel) => {
        if (!q) return true;
        const name = ((chan.data as { name?: string } | undefined)?.name || '').toLowerCase();
        const members = Object.values(chan.state?.members ?? {})
          .map((m) => (m.user?.name || '').toLowerCase())
          .join(' ');
        return name.includes(q) || members.includes(q);
      };
      return channels.filter((chan) => scopeMatches(chan) && searchMatches(chan));
    },
    [scope, searchTerm]
  );

  const shareContextValue = useMemo(
    () => ({ openShare: (id: string) => setShareChannelId(id) }),
    []
  );

  const activateChannelById = useCallback(
    async (channelId: string) => {
      if (!client) return;
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      setIsChannelSelected(true);
      setShowEmptyPlaceholder(false);
      onChannelSelect?.(channel);
    },
    [client, onChannelSelect]
  );

  const handleStartDirectChat = useCallback(
    async (user: OrgUserOption) => {
      if (!primaryOrgId || !client) return;
      const candidateIds = Array.from(
        new Set([user.userId, user.practitionerId, user.id].filter(Boolean))
      ) as string[];
      if (!candidateIds.length) {
        notify('error', {
          title: 'Can’t start chat',
          text: 'No valid user identifier found for this teammate.',
        });
        return;
      }
      setCreatingChat(true);

      // First, check if a direct channel already exists with this user
      // by querying backend sessions API and also Stream Chat channels
      try {
        // Check backend sessions for existing direct chat with this user
        const sessions = await listOrgChatSessions(primaryOrgId);
        const existingSession = sessions.find((s) => {
          if (s.type !== 'ORG_DIRECT') return false;
          // Check if this session involves one of the candidate user IDs
          const sessionMembers = s.members || [];
          return sessionMembers.some((m: any) => {
            const memberId = m.userId || m.practitionerId || m.id || m;
            return candidateIds.includes(memberId);
          });
        });

        if (existingSession?.channelId) {
          // Found existing session, try to load the channel
          const queried = await client.queryChannels(
            { id: { $eq: existingSession.channelId } },
            [{ last_message_at: -1 }],
            { watch: true, state: true, presence: true, limit: 1 }
          );
          if (queried[0]) {
            await queried[0].watch();
            setIsChannelSelected(true);
            setShowEmptyPlaceholder(false);
            onChannelSelect?.(queried[0]);
            setCreatingChat(false);
            return;
          }
        }

        // Also query Stream Chat channels directly as fallback
        const existingChannels = await client.queryChannels(
          {
            type: 'team',
            members: { $in: [client.userID!] },
          },
          [{ last_message_at: -1 }],
          { watch: false, state: true, presence: false, limit: 100 }
        );

        // Find a channel that is a direct chat (2 members) with this specific user
        const existingDirectChannel = existingChannels.find((chan) => {
          const members = chan.state?.members || {};
          const memberIds = Object.keys(members);
          const chatCategory = (chan.data as any)?.chatCategory;
          const dataType = (chan.data as any)?.type;

          // Must be a 2-person channel
          if (memberIds.length !== 2) return false;
          // Must include current user
          if (!memberIds.includes(client.userID!)) return false;
          // Must be a colleagues/direct channel (or legacy without category)
          // Allow: no chatCategory, "colleagues", or type "ORG_DIRECT"
          if (chatCategory && chatCategory !== 'colleagues' && dataType !== 'ORG_DIRECT')
            return false;

          // Check if the other member matches one of the candidate IDs
          const otherMemberId = memberIds.find((id) => id !== client.userID!);
          if (!otherMemberId) return false;

          // Direct match on member ID
          if (candidateIds.includes(otherMemberId)) return true;

          // Also check user.id and user.name from member object
          const otherMember = members[otherMemberId];
          const otherUserIdFromMember = otherMember?.user?.id || otherMember?.user_id;
          if (otherUserIdFromMember && candidateIds.includes(otherUserIdFromMember)) return true;

          // Also match by name as last resort (for John Doe case where IDs might differ)
          const otherUserName = otherMember?.user?.name;
          if (otherUserName?.toLowerCase() === user.name?.toLowerCase()) {
            return true;
          }

          return false;
        });

        if (existingDirectChannel) {
          // Channel already exists, just select it
          await existingDirectChannel.watch();
          setIsChannelSelected(true);
          setShowEmptyPlaceholder(false);
          onChannelSelect?.(existingDirectChannel);
          setCreatingChat(false);
          return;
        }
      } catch (err) {
        console.error('Error checking for existing channel:', err);
        // Continue to create new channel if query fails
      }

      let success = false;
      for (const otherUserId of candidateIds) {
        try {
          const session = await createOrgDirectChat({
            organisationId: primaryOrgId,
            otherUserId,
          });
          const applyMetadata = async (chan: StreamChannel) => {
            await chan.update(
              {
                directId: session._id,
                title: session.title,
                description: session.description,
                type: session.type,
                chatCategory: 'colleagues',
                organisationId: session.organisationId,
                createdBy: session.createdBy,
              } as Record<string, unknown>,
              {}
            );
          };
          // Try to load the channel via query to ensure it appears in lists
          const queried = await client.queryChannels(
            { id: { $eq: session.channelId } },
            [{ last_message_at: -1 }],
            { watch: true, state: true, presence: true, limit: 1 }
          );
          if (queried[0]) {
            await queried[0].watch();
            await applyMetadata(queried[0]);
            setIsChannelSelected(true);
            setShowEmptyPlaceholder(false);
            onChannelSelect?.(queried[0]);
          } else {
            await activateChannelById(session.channelId);
            const chan = client.channel('team', session.channelId);
            await applyMetadata(chan);
          }
          success = true;
          break;
        } catch (err) {
          console.error('Failed to start direct chat with id', otherUserId, err);
          // try next candidate if available
        }
      }
      if (!success) {
        notify('error', {
          title: 'Couldn’t start chat',
          text: 'Unable to start chat. Please try again.',
        });
      }
      setCreatingChat(false);
    },
    [primaryOrgId, client, activateChannelById, onChannelSelect, notify]
  );

  const handleNetworkChatStarted = useCallback(
    async (channelId: string) => {
      setNetworkModalOpen(false);
      if (!client) return;
      try {
        const queried = await client.queryChannels(
          { id: { $eq: channelId } },
          [{ last_message_at: -1 }],
          { watch: true, state: true, presence: true, limit: 1 }
        );
        const chan = queried[0] ?? client.channel('team', channelId);
        await chan.watch();
        await chan.update(
          { chatCategory: 'colleagues', network: true } as Record<string, unknown>,
          {}
        );
        setIsChannelSelected(true);
        setShowEmptyPlaceholder(false);
        onChannelSelect?.(chan);
      } catch (err) {
        console.error('Failed to open network chat', err);
      }
    },
    [client, onChannelSelect]
  );

  // Modal action handlers
  const handleModalCreate = useCallback(
    async (title: string, memberIds: string[]) => {
      if (!primaryOrgId || !client) return;
      setGroupModalBusy(true);
      try {
        const allMembers = Array.from(new Set([...memberIds, client.userID!]));
        const session = await createOrgGroupChat({
          organisationId: primaryOrgId,
          title,
          memberIds: allMembers,
          isPrivate: true,
        });
        const applyMetadata = async (chan: StreamChannel) => {
          await chan.update(
            {
              groupId: session._id,
              title: session.title || title,
              description: session.description,
              type: session.type,
              chatCategory: 'group',
              organisationId: session.organisationId,
              createdBy: session.createdBy,
            } as Record<string, unknown>,
            {}
          );
        };
        const queried = await client.queryChannels(
          { id: { $eq: session.channelId } },
          [{ last_message_at: -1 }],
          { watch: true, state: true, presence: true, limit: 1 }
        );
        if (queried[0]) {
          await queried[0].watch();
          await applyMetadata(queried[0]);
          setIsChannelSelected(true);
          setShowEmptyPlaceholder(false);
          onChannelSelect?.(queried[0]);
        } else {
          await activateChannelById(session.channelId);
          const chan = client.channel('team', session.channelId);
          await applyMetadata(chan);
        }
        setGroupModalOpen(false);
      } catch (err) {
        console.error('Failed to create group', err);
        notify('error', {
          title: 'Couldn’t create group',
          text: 'Unable to create group. Please try again.',
        });
      } finally {
        setGroupModalBusy(false);
      }
    },
    [primaryOrgId, client, activateChannelById, onChannelSelect, notify]
  );

  const handleModalUpdateTitle = useCallback(
    async (title: string) => {
      if (!groupModalBackendId) {
        console.error('Group ID not available. groupModalBackendId:', groupModalBackendId);
        notify('warning', {
          title: 'Action unavailable',
          text: 'This group was created before the new system. Please create a new group to use this feature.',
        });
        return;
      }
      setGroupModalBusy(true);
      try {
        await updateGroup(groupModalBackendId, { title });
        if (groupModalChannel) {
          await groupModalChannel.update({ title } as Record<string, unknown>, {});
        }
        setGroupModalPlaceholder(title);
        setGroupModalTitle('');
      } catch (err) {
        console.error('Failed to update group title', err);
        notify('error', {
          title: 'Couldn’t update title',
          text: 'Unable to update title. Please try again.',
        });
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel, notify]
  );

  const handleModalAddMember = useCallback(
    async (userId: string) => {
      if (!groupModalBackendId) {
        console.error(
          'Group ID not available for add member. groupModalBackendId:',
          groupModalBackendId
        );
        notify('warning', {
          title: 'Action unavailable',
          text: 'This group was created before the new system. Please create a new group to use this feature.',
        });
        return;
      }
      setGroupModalBusy(true);
      try {
        await addGroupMembers(groupModalBackendId, [userId]);
        if (groupModalChannel) {
          await groupModalChannel.addMembers([userId]);
        }
        setGroupModalMembers((prev) => [...prev, userId]);
      } catch (err) {
        console.error('Failed to add member', err);
        notify('error', {
          title: 'Couldn’t add member',
          text: 'Unable to add member. Please try again.',
        });
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel, notify]
  );

  const handleModalRemoveMember = useCallback(
    async (userId: string) => {
      if (!groupModalBackendId) {
        console.error(
          'Group ID not available for remove member. groupModalBackendId:',
          groupModalBackendId
        );
        notify('warning', {
          title: 'Action unavailable',
          text: 'This group was created before the new system. Please create a new group to use this feature.',
        });
        return;
      }
      setGroupModalBusy(true);
      try {
        await removeGroupMembers(groupModalBackendId, [userId]);
        if (groupModalChannel) {
          await groupModalChannel.removeMembers([userId]);
        }
        setGroupModalMembers((prev) => prev.filter((id) => id !== userId));
      } catch (err) {
        console.error('Failed to remove member', err);
        notify('error', {
          title: 'Couldn’t remove member',
          text: 'Unable to remove member. Please try again.',
        });
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel, notify]
  );

  const handleModalDelete = useCallback(async () => {
    if (!groupModalBackendId) {
      notify('error', {
        title: 'Can’t delete group',
        text: 'Group id not available.',
      });
      return;
    }
    const confirmed = confirm('Delete this group? This cannot be undone.');
    if (!confirmed) return;
    setGroupModalBusy(true);
    try {
      await deleteGroup(groupModalBackendId);
      // Try to hide the channel from Stream Chat, but don't fail if it's already gone
      if (groupModalChannel) {
        try {
          await groupModalChannel.hide?.();
        } catch {
          // Channel might already be deleted on Stream Chat side, ignore this error
        }
      }
      setGroupModalOpen(false);
      setIsChannelSelected(false);
      setShowEmptyPlaceholder(true);
      onChannelSelect?.(null);
      notify('success', {
        title: 'Group deleted',
        text: 'Group deleted successfully',
      });
    } catch (err) {
      console.error('Failed to delete group', err);
      notify('error', {
        title: 'Couldn’t delete group',
        text: 'Unable to delete group. Please try again.',
      });
    } finally {
      setGroupModalBusy(false);
    }
  }, [groupModalBackendId, groupModalChannel, onChannelSelect, notify]);

  const groupModalContextValue = useMemo(
    () => ({
      openCreate: openCreateGroupModal,
      openEdit: openEditGroupModal,
    }),
    [openCreateGroupModal, openEditGroupModal]
  );
  const chatSessionStatusContextValue = useMemo(
    () => ({
      statusByAppointmentId,
      refreshStatuses,
    }),
    [statusByAppointmentId, refreshStatuses]
  );

  // Extract conditional rendering logic
  const isAuthPending = authStatus === 'checking' || authLoading || orgStatus === 'loading';
  const isLoading = loading || (!client && (!error || isAuthPending));
  const hasError = error || (!client && !isAuthPending && !loading);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: '360px',
        }}
      >
        <YosemiteLoader size={120} testId="chat-loader" />
      </div>
    );
  }

  if (hasError) {
    const errorMessage = error || 'Unable to load chat';
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: '360px',
        }}
      >
        <p style={{ color: 'var(--color-danger-700)' }}>{errorMessage}</p>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const filters = {
    type: { $in: ['messaging', 'team'] },
    members: { $in: [client.userID!] },
    ...(showArchived ? { hidden: true } : {}),
  };

  const chatContent = (
    <>
      <ChatLayout
        filters={filters}
        sort={CHAT_SORT}
        options={CHAT_OPTIONS}
        isMobile={isMobile}
        isChannelSelected={isChannelSelected}
        previewComponent={previewComponent}
        onBack={() => {
          setIsChannelSelected(false);
          setShowEmptyPlaceholder(true);
        }}
        currentUserId={client.userID}
        channelFilter={channelFilter}
        showEmpty={showEmptyPlaceholder}
        channelListHeader={
          <>
            <div className="flex items-center justify-between px-3 pt-3">
              <Text as="h2" variant="heading-3" className="text-neutral-900">
                Messages
              </Text>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-pressed={showArchived}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  showArchived
                    ? 'border-primary-500 bg-chat-panel text-primary-700'
                    : 'border-chat-divider text-neutral-500 hover:bg-chat-surface-soft hover:text-neutral-900'
                )}
              >
                <LuArchive className="h-3.5 w-3.5" />
                Archived
              </button>
            </div>
            <div className="px-3 pt-2">
              <ChatScopeSwitcher scope={scope} onScopeChange={onScopeChange} />
            </div>
            <div className="border-b border-chat-divider p-3">
              <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-input-border-default bg-(--whitebg) px-4 py-2.5 transition-colors focus-within:border-input-border-active">
                <LuSearch className="h-4 w-4 shrink-0 text-input-text-placeholder" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search conversations…"
                  aria-label="Search conversations"
                  className="w-full bg-transparent font-satoshi text-body-4 text-text-primary outline-none placeholder:text-input-text-placeholder"
                />
                <span className="hidden shrink-0 items-center gap-0.5 rounded-md border border-chat-divider px-1.5 py-0.5 text-xs font-semibold text-neutral-400 sm:flex">
                  <LuCommand className="h-3 w-3" />K
                </span>
              </div>
            </div>
            {(scope === 'colleagues' || scope === 'groups') && (
              <div className="flex flex-col gap-3 border-b border-chat-divider p-3">
                {scope === 'colleagues' && (
                  <div className="flex flex-col gap-2">
                    {crossOrgEnabled && (
                      <button
                        type="button"
                        onClick={() => setNetworkModalOpen(true)}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-chat-divider bg-neutral-0 px-3 py-2.5 text-left transition-colors duration-200 hover:border-input-border-active hover:bg-chat-surface-soft"
                      >
                        <LuGlobe className="size-4 shrink-0 text-primary-600" />
                        <Text as="span" variant="body-4" className="text-neutral-900">
                          Message a colleague at another clinic
                        </Text>
                      </button>
                    )}
                    <FormInput
                      intype="text"
                      inname="colleagueSearch"
                      inlabel="Search teammate to chat"
                      value={directSearch}
                      onFocus={() => {
                        if (directBlurTimeout.current) {
                          clearTimeout(directBlurTimeout.current);
                          directBlurTimeout.current = null;
                        }
                        setSearchFocused(true);
                      }}
                      onBlur={() => {
                        directBlurTimeout.current = setTimeout(() => {
                          if (!directListHover) {
                            setSearchFocused(false);
                          }
                        }, 120);
                      }}
                      onChange={(e) => setDirectSearch(e.target.value)}
                    />
                    <ul
                      className="max-h-40 overflow-y-auto flex flex-col gap-2 list-none p-0 m-0"
                      onMouseEnter={() => setDirectListHover(true)}
                      onMouseLeave={() => {
                        setDirectListHover(false);
                        if (!searchFocused) setSearchFocused(false);
                      }}
                    >
                      {orgUsersLoading && (
                        <span className="text-caption-1 text-text-secondary">
                          Loading teammates…
                        </span>
                      )}
                      {!orgUsersLoading &&
                        (searchFocused || directListHover) &&
                        (() => {
                          const dlower = directSearch.toLowerCase();
                          const results: (OrgUserOption & { keyId: string | undefined })[] = [];
                          for (const u of orgUsers) {
                            if (
                              !(u.name + (u.email ?? '') + (u.role ?? ''))
                                .toLowerCase()
                                .includes(dlower)
                            )
                              continue;
                            const keyId = u.userId ?? u.id;
                            if (keyId === client.userID) continue;
                            results.push({ ...u, keyId });
                            if (results.length === 8) break;
                          }
                          return results;
                        })().map((u) => (
                          <button
                            key={u.keyId}
                            type="button"
                            onClick={() =>
                              handleStartDirectChat({
                                ...u,
                                id: u.id,
                                userId: u.userId,
                                practitionerId: u.practitionerId,
                              })
                            }
                            disabled={creatingChat}
                            className="flex min-h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-chat-divider bg-neutral-0 px-3 py-3 text-left transition-colors duration-200 hover:border-input-border-active hover:bg-chat-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ChatAvatar name={u.name || u.email || '?'} />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <Text
                                as="span"
                                variant="body-4-emphasis"
                                className="truncate text-neutral-900"
                              >
                                {u.name}
                              </Text>
                              {u.email && (
                                <Text
                                  as="span"
                                  variant="caption-2"
                                  className="truncate text-neutral-500"
                                >
                                  {u.email}
                                </Text>
                              )}
                            </span>
                          </button>
                        ))}
                      {!orgUsersLoading &&
                        searchFocused &&
                        directSearch.trim().length > 0 &&
                        !orgUsers.some((u) =>
                          (u.name + (u.email ?? '') + (u.role ?? ''))
                            .toLowerCase()
                            .includes(directSearch.toLowerCase())
                        ) && (
                          <span className="text-caption-1 text-text-secondary">
                            No teammates found. Adjust your search.
                          </span>
                        )}
                    </ul>
                  </div>
                )}

                {scope === 'groups' && (
                  <Primary text="Create Group" onClick={openCreateGroupModal} className="w-fit" />
                )}
              </div>
            )}
          </>
        }
      />
      <ChatCommandPalette client={client} filters={filters} onJump={activateChannelById} />
    </>
  );

  return (
    <ChatSessionStatusContext.Provider value={chatSessionStatusContextValue}>
      <GroupModalContext.Provider value={groupModalContextValue}>
        <ChatShareContext.Provider value={shareContextValue}>
          <div className={className}>
            <Chat
              key={appointmentId ? `appointment-${appointmentId}` : 'chat-scopes'}
              client={client}
              theme="str-chat__theme-light"
            >
              <ScopeChangeChannelReset scope={scope} />
              <AppointmentChannelInitializer
                appointmentId={appointmentId}
                onActivated={(channel) => {
                  setIsChannelSelected(true);
                  setShowEmptyPlaceholder(false);
                  onChannelSelect?.(channel);
                }}
                onCleared={() => {
                  setIsChannelSelected(false);
                  setShowEmptyPlaceholder(true);
                  onChannelSelect?.(null);
                }}
              />
              {chatContent}
            </Chat>
            <GroupModal
              open={groupModalOpen}
              mode={groupModalMode}
              title={groupModalTitle}
              placeholder={groupModalPlaceholder}
              members={groupModalMembers}
              ownerId={groupModalOwnerRef.current}
              currentUserId={client.userID}
              search={groupModalSearch}
              busy={groupModalBusy}
              orgUsers={orgUsers}
              orgUsersLoading={orgUsersLoading}
              channel={groupModalChannel}
              onClose={() => setGroupModalOpen(false)}
              onTitleChange={setGroupModalTitle}
              onSearchChange={setGroupModalSearch}
              onMembersChange={setGroupModalMembers}
              onCreate={handleModalCreate}
              onUpdateTitle={handleModalUpdateTitle}
              onAddMember={handleModalAddMember}
              onRemoveMember={handleModalRemoveMember}
              onDelete={handleModalDelete}
            />
            {shareChannelId && (
              <ShareEntityModal
                channelId={shareChannelId}
                onClose={() => setShareChannelId(null)}
              />
            )}
            {networkModalOpen && primaryOrgId && (
              <NetworkDirectoryModal
                organisationId={primaryOrgId}
                onClose={() => setNetworkModalOpen(false)}
                onStarted={handleNetworkChatStarted}
              />
            )}
          </div>
        </ChatShareContext.Provider>
      </GroupModalContext.Provider>
    </ChatSessionStatusContext.Provider>
  );
};

const ProtectedChatContainer = () => {
  return (
    <ProtectedRoute skeleton={CHAT_PAGE_SKELETON}>
      <OrgGuard skeleton={CHAT_PAGE_SKELETON}>
        <ChatContainer />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export {
  normalizeName,
  getSessionIdFromChannel,
  findSessionByStoredId,
  matchesDirectSession,
  matchesGroupSession,
  matchesChannelId,
  getChannelDisplayInfo,
  resolveChannelScope,
  formatRowTime,
  isCounterpartOnline,
  formatClosedTime,
  ChannelPreviewWrapper,
  ChatClosedFooter,
};

export default ProtectedChatContainer;
