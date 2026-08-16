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
import { LuCommand } from 'react-icons/lu';
import {
  IoArchiveOutline,
  IoChatbubbleEllipsesOutline,
  IoGlobeOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import SegmentedPill from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import Text from '@/app/ui/Text';
import ConversationRow from './ConversationRow';
import ConversationInfoPanel from './ConversationInfoPanel';
import { deriveConversationPinned } from './conversationInfoPanelUtils';
import ChannelHeaderBar from './ChannelHeaderBar';
import { ChatAvatar } from './ChatAvatar';
import { ChatHeaderContext } from './ChatHeaderContext';
import ChatMessage from './ChatMessage';
import ChatComposer from './ChatComposer';
import ChatCommandPalette from './ChatCommandPalette';
import ShareEntityModal from './ShareEntityModal';
import NetworkDirectoryModal from './NetworkDirectoryModal';
import { GroupModal, type OrgUserOption } from './GroupModal';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { useChannelInfoDrawer } from '../hooks/useChannelInfoDrawer';
import { useChannelSessionActions } from '../hooks/useChannelSessionActions';
import { ChatShareContext } from './chatShareContext';
import clsx from 'clsx';
import {
  findSessionByStoredId,
  formatClosedTime,
  formatRowTime,
  getChannelDisplayInfo,
  getSessionIdFromChannel,
  isChannelMuted,
  isCounterpartOnline,
  matchesChannelId,
  matchesDirectSession,
  matchesGroupSession,
  normalizeName,
  resolveChannelScope,
  type ChatScope,
} from './chatContainerUtils';

import 'stream-chat-react/dist/css/v2/index.css';
import './ChatContainer.css';

import {
  getChatClient,
  connectStreamUser,
  getAppointmentChannel,
} from '@/app/features/chat/services/streamChatService';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import {
  createOrgDirectChat,
  createOrgGroupChat,
  fetchOrgUsers,
  addGroupMembers,
  removeGroupMembers,
  updateGroup,
  deleteGroup,
  getChatSessions,
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
// Lets the thread header render the phone "back" control inline (design: one
// unified compact bar — round back + avatar + name + status — instead of a
// separate "← Back" strip stacked above the header).
const ChatBackContext = createContext<{ showBack: boolean; onBack: () => void }>({
  showBack: false,
  onBack: () => undefined,
});
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { useConfirm } from '@/app/ui/overlays/Modal/ConfirmModal';

const CHAT_PAGE_SKELETON = <PageSkeleton variant="list" />;

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
  scope?: ChatScope;
  onScopeChange?: (scope: ChatScope) => void;
}

// Design labels these audience tabs "Clients / Team / Groups" (the middle tab
// reads "Team", not "Colleagues"; the scope value stays `colleagues`). The
// per-chat "Pet parent" badge is kept as the fixed owner term on the individual
// client conversation header.
const SCOPE_OPTIONS: ReadonlyArray<{ value: ChatScope; label: string }> = [
  { value: 'clients', label: 'Clients' },
  { value: 'colleagues', label: 'Team' },
  { value: 'groups', label: 'Groups' },
];

/**
 * Audience switcher. Uses the shared neutral raised-white-pill SegmentedPill
 * (track var(--band)+hairline, active segment raised var(--screen) with weight
 * 700 ink text) per the warm-bone design, replacing the earlier colored
 * sliding-pill control.
 */
function ChatScopeSwitcher({
  scope,
  onScopeChange,
}: Readonly<{ scope?: ChatScope; onScopeChange?: (next: ChatScope) => void }>) {
  return (
    <SegmentedPill
      ariaLabel="Chat audience"
      value={scope ?? 'clients'}
      onChange={(next) => onScopeChange?.(next)}
      options={SCOPE_OPTIONS}
    />
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
  mode: 'desktop' | 'mobile-list' | 'mobile-chat';
  onBack: () => void;
  currentUserId?: string | null;
  showEmpty?: boolean;
}

const getChatPanelMode = (
  isMobile: boolean,
  isChannelSelected: boolean
): ChatMainPanelProps['mode'] => {
  if (!isMobile) return 'desktop';
  return isChannelSelected ? 'mobile-chat' : 'mobile-list';
};

interface ChatSidebarHeaderProps {
  showArchived: boolean;
  onToggleArchived: () => void;
  scope: ChatScope;
  onScopeChange?: (scope: ChatScope) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  crossOrgEnabled: boolean;
  onOpenNetworkDirectory: () => void;
  directSearch: string;
  onDirectSearchChange: (value: string) => void;
  onDirectSearchFocus: () => void;
  onDirectSearchBlur: () => void;
  onDirectListMouseEnter: () => void;
  onDirectListMouseLeave: () => void;
  searchFocused: boolean;
  directListHover: boolean;
  orgUsersLoading: boolean;
  orgUsers: OrgUserOption[];
  currentUserId?: string | null;
  creatingChat: boolean;
  onStartDirectChat: (user: OrgUserOption) => void;
  onOpenCreateGroupModal: () => void;
}

interface ChatWindowProps {
  showBackButton: boolean;
  onBack: () => void;
  currentUserId?: string | null;
}

interface ChannelState {
  frozen: boolean;
  updatedAt?: string;
  closedAt?: string;
}

export type { ChatScope };

// Read the frozen/closed flags off the channel's current data payload.
const readChannelState = (channel: StreamChannel | null | undefined): ChannelState => {
  const channelData = channel?.data as any;
  return {
    frozen: channelData?.frozen === true,
    updatedAt: channelData?.updated_at,
    closedAt: channelData?.closedAt || channelData?.closed_at,
  };
};

// Custom hook for channel state management
const useChannelState = () => {
  const { channel } = useChannelStateContext();
  const [state, setState] = useState<ChannelState>(() => readChannelState(channel));

  // Re-read during render (compare-guard) when the channel itself changes; the
  // effect below only subscribes for external updates on that channel.
  const [prevChannel, setPrevChannel] = useState(channel);
  if (prevChannel !== channel) {
    setPrevChannel(channel);
    if (channel) setState(readChannelState(channel));
  }

  useEffect(() => {
    if (!channel) return;
    // Listen for channel updates
    const handleChannelUpdate = () => {
      setState(readChannelState(channel));
    };

    channel.on('channel.updated', handleChannelUpdate);

    return () => {
      channel.off('channel.updated', handleChannelUpdate);
    };
  }, [channel]);

  return state;
};

type HeaderChannelInfo = {
  title: string;
  channelMemberCount: number;
  isClientChat: boolean;
  isGroupChat: boolean;
  appointmentId?: string;
  patientId?: string;
};

// Derive the header's channel-shaped booleans/labels in one place so the
// component body stays readable (and under the cognitive-complexity limit).
const deriveHeaderChannelInfo = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): HeaderChannelInfo => {
  const { title } = getChannelDisplayInfo(channel, currentUserId);
  const scope = channel ? resolveChannelScope(channel) : 'colleagues';
  const channelMemberCount = channel?.state?.members
    ? Object.keys(channel.state.members).length
    : 0;
  const data = (channel?.data as any) ?? {};
  const dataType = typeof data.type === 'string' ? data.type : undefined;
  const chatCategory = typeof data.chatCategory === 'string' ? data.chatCategory : undefined;
  const isTeamChannel = (channel?.type || '').toLowerCase() === 'team';
  const isOrgGroupType = dataType === 'ORG_GROUP' || (chatCategory || '').toLowerCase() === 'group';
  return {
    title,
    channelMemberCount,
    isClientChat: scope === 'clients',
    isGroupChat: scope === 'groups' || isOrgGroupType || (isTeamChannel && channelMemberCount > 2),
    appointmentId: data.appointmentId,
    patientId: data.patientId as string | undefined,
  };
};

const getHeaderStatusText = ({
  isGroupChat,
  hasSessionClosed,
  online,
  channelMemberCount,
  isClientChat,
}: {
  isGroupChat: boolean;
  hasSessionClosed: boolean;
  online: boolean;
  channelMemberCount: number;
  isClientChat: boolean;
}): string => {
  let baseStatus: string;
  if (isGroupChat) baseStatus = `${channelMemberCount} members`;
  else if (hasSessionClosed) baseStatus = 'Chat closed';
  else baseStatus = online ? 'Active now' : 'Offline';
  return isClientChat && !hasSessionClosed ? `${baseStatus} · via pet parent app` : baseStatus;
};

const ChannelHeaderWithCounterpart: FC<{
  currentUserId?: string | null;
}> = ({ currentUserId }) => {
  const { channel } = useChannelStateContext();
  const { statusByAppointmentId, refreshStatuses } = use(ChatSessionStatusContext);
  const { showBack, onBack } = use(ChatBackContext);
  const groupModalCtx = use(GroupModalContext);
  const { title, channelMemberCount, isClientChat, isGroupChat, appointmentId, patientId } =
    deriveHeaderChannelInfo(channel, currentUserId);
  const backendStatus = appointmentId ? statusByAppointmentId[appointmentId] : undefined;
  const appointment = useAppointmentStore((s) =>
    appointmentId ? s.appointmentsById[appointmentId] : undefined
  );
  const companion = useCompanionStore((s) => (patientId ? s.companionsById[patientId] : undefined));
  const { confirm, confirmDialog } = useConfirm();

  const {
    sessionClosed,
    closingSession,
    completingAppointment,
    rescheduleOpen,
    setRescheduleOpen,
    followUpOpen,
    setFollowUpOpen,
    handleCloseSession,
    handleApptAction,
  } = useChannelSessionActions({
    channel,
    appointment,
    appointmentId,
    backendStatus,
    refreshStatuses,
    confirm,
  });

  const {
    infoOpen,
    openInfo,
    closeInfo,
    toggleInfo,
    infoMuted,
    handleToggleMute,
    handleArchiveConversation,
  } = useChannelInfoDrawer(channel);

  const online = isCounterpartOnline(channel, currentUserId);
  const statusText = getHeaderStatusText({
    isGroupChat,
    hasSessionClosed: sessionClosed,
    online,
    channelMemberCount,
    isClientChat,
  });
  const pinnedMessages = deriveConversationPinned(channel);

  return (
    <>
      {confirmDialog}
      <ChannelHeaderBar
        title={title}
        statusText={statusText}
        chat={{
          isClientChat,
          isGroupChat,
          sessionClosed,
          showPresence: online && !isGroupChat && !sessionClosed,
        }}
        back={showBack ? { onBack } : undefined}
        info={{ open: infoOpen, onToggle: toggleInfo }}
        session={{ closing: closingSession, onClose: handleCloseSession }}
        onOpenGroupInfo={() => {
          if (channel) {
            groupModalCtx.openEdit?.(channel);
          }
        }}
      />
      {isClientChat && (
        <>
          {infoOpen && (
            <ConversationInfoPanel
              channel={channel ?? null}
              name={title}
              subtitle={[companion?.name, statusText].filter(Boolean).join(' · ')}
              online={online && !sessionClosed}
              clientRecordHref={patientId ? buildCompanionOverviewHref(patientId) : undefined}
              muted={infoMuted}
              onToggleMute={handleToggleMute}
              onArchive={handleArchiveConversation}
              onClose={closeInfo}
            />
          )}
          <ChatHeaderContext
            allergy={companion?.allergy?.trim() || undefined}
            alerts={companion?.alerts}
            appointment={appointment}
            completing={completingAppointment}
            pinned={pinnedMessages}
            onOpenPinned={openInfo}
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
  const channel = previewProps.channel;

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
        onPreviewSelect?.(channel ?? null);
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
      <div className="flex justify-center p-3">
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

const ChatClosedFooter: FC<{ closedAt?: string }> = ({ closedAt }) => {
  const formattedClosedTime = formatClosedTime(closedAt);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 border-t border-chat-divider bg-chat-surface-soft p-4">
      <Text as="p" variant="body-4-emphasis" className="text-neutral-700">
        Chat session closed
      </Text>
      {formattedClosedTime && (
        <Text as="p" variant="caption-2" className="text-text-tertiary">
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
    <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-chat-panel text-[var(--blue-text)]">
      <IoChatbubbleEllipsesOutline className="h-6 w-6" />
    </span>
    <Text as="p" variant="body-3-emphasis" className="text-neutral-700">
      No messages yet
    </Text>
    <Text as="p" variant="caption-1" className="text-text-tertiary">
      Send the first message to start the conversation.
    </Text>
  </div>
);

const ChatWindow: FC<ChatWindowProps> = ({ showBackButton, onBack, currentUserId }) => {
  const backContextValue = useMemo(
    () => ({ showBack: showBackButton, onBack }),
    [showBackButton, onBack]
  );

  return (
    <ChatBackContext.Provider value={backContextValue}>
      <Channel Message={ChatMessage} EmptyStateIndicator={ChatEmptyThread}>
        <RegularChannelWindow currentUserId={currentUserId} />
        <Thread />
      </Channel>
    </ChatBackContext.Provider>
  );
};

const ChatMainPanel: FC<ChatMainPanelProps> = ({ mode, onBack, currentUserId, showEmpty }) => {
  const shouldShowChat = mode !== 'mobile-list';
  const showBackButton = mode === 'mobile-chat';

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
        <ChatWindow showBackButton={showBackButton} onBack={onBack} currentUserId={currentUserId} />
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
  const panelMode = getChatPanelMode(isMobile, isChannelSelected);

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
        mode={panelMode}
        onBack={onBack}
        currentUserId={currentUserId}
        showEmpty={showEmpty}
      />
    </div>
  );
};

const ChatSidebarHeader: FC<ChatSidebarHeaderProps> = ({
  showArchived,
  onToggleArchived,
  scope,
  onScopeChange,
  searchTerm,
  onSearchTermChange,
  crossOrgEnabled,
  onOpenNetworkDirectory,
  directSearch,
  onDirectSearchChange,
  onDirectSearchFocus,
  onDirectSearchBlur,
  onDirectListMouseEnter,
  onDirectListMouseLeave,
  searchFocused,
  directListHover,
  orgUsersLoading,
  orgUsers,
  currentUserId,
  creatingChat,
  onStartDirectChat,
  onOpenCreateGroupModal,
}) => {
  const normalizedDirectSearch = directSearch.toLowerCase();
  const directSearchResults = orgUsers
    .reduce<Array<OrgUserOption & { keyId: string | undefined }>>((results, user) => {
      if (
        normalizedDirectSearch &&
        !(user.name + (user.email ?? '') + (user.role ?? ''))
          .toLowerCase()
          .includes(normalizedDirectSearch)
      ) {
        return results;
      }
      const keyId = user.userId ?? user.id;
      if (keyId === currentUserId) return results;
      results.push({ ...user, keyId });
      return results;
    }, [])
    .slice(0, 8);
  const hasNoDirectMatches =
    !orgUsersLoading &&
    searchFocused &&
    directSearch.trim().length > 0 &&
    directSearchResults.length === 0;

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="m-0 font-newsreader text-[20px] font-normal tracking-[-0.015em] text-[var(--ink)] xl:text-[23px]">
          Chat
        </h2>
        <button
          type="button"
          onClick={onToggleArchived}
          aria-pressed={showArchived}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
            showArchived
              ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue-text)]'
              : 'border-[var(--hairline)] text-[var(--ink-faint)] hover:bg-[var(--screen-2)] hover:text-[var(--ink)]'
          )}
        >
          <IoArchiveOutline className="size-3.5" />
          Archived
        </button>
      </div>
      <div className="px-3 pt-2">
        <ChatScopeSwitcher scope={scope} onScopeChange={onScopeChange} />
      </div>
      <div className="border-b border-chat-divider p-3">
        {/* Design (channel-list search): 38px pill, --field-bg + --hairline,
            0 13px padding, 14px icon, 12.5px --ink-faint placeholder. */}
        <div className="flex min-h-[38px] items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] px-[13px] py-2 transition-colors focus-within:border-input-border-active">
          <IoSearchOutline className="size-3.5 shrink-0 text-[var(--ink-faint)]" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full bg-transparent font-satoshi text-[12.5px] text-[var(--ink-body)] outline-none placeholder:text-[var(--ink-faint)]"
          />
          <span className="hidden shrink-0 items-center gap-0.5 rounded-md border border-[var(--hairline)] px-1.5 py-0.5 text-xs font-semibold text-[var(--ink-faint)] sm:flex">
            <LuCommand className="size-3" />K
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
                  onClick={onOpenNetworkDirectory}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl border border-chat-divider bg-neutral-0 px-3 py-2.5 text-left transition-colors duration-200 hover:border-input-border-active hover:bg-chat-surface-soft"
                >
                  <IoGlobeOutline className="size-4 shrink-0 text-[var(--blue-text)]" />
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
                onFocus={onDirectSearchFocus}
                onBlur={onDirectSearchBlur}
                onChange={(e) => onDirectSearchChange(e.target.value)}
              />
              <ul
                className="m-0 flex max-h-40 list-none flex-col gap-2 overflow-y-auto p-0"
                onMouseEnter={onDirectListMouseEnter}
                onMouseLeave={onDirectListMouseLeave}
              >
                {orgUsersLoading && (
                  <span className="text-caption-1 text-text-secondary">Loading teammates…</span>
                )}
                {!orgUsersLoading &&
                  (searchFocused || directListHover) &&
                  directSearchResults.map((user) => (
                    <button
                      key={user.keyId}
                      type="button"
                      onClick={() =>
                        onStartDirectChat({
                          ...user,
                          id: user.id,
                          userId: user.userId,
                          practitionerId: user.practitionerId,
                        })
                      }
                      disabled={creatingChat}
                      className="flex min-h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-chat-divider bg-neutral-0 p-3 text-left transition-colors duration-200 hover:border-input-border-active hover:bg-chat-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {/* `name` is always a non-empty string: the org-user mapping
                          below falls back to the email and then to 'User'. */}
                      <ChatAvatar name={user.name} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <Text
                          as="span"
                          variant="body-4-emphasis"
                          className="truncate text-neutral-900"
                        >
                          {user.name}
                        </Text>
                        {user.email && (
                          <Text
                            as="span"
                            variant="caption-2"
                            className="truncate text-text-tertiary"
                          >
                            {user.email}
                          </Text>
                        )}
                      </span>
                    </button>
                  ))}
                {hasNoDirectMatches && (
                  <span className="text-caption-1 text-text-secondary">
                    No teammates found. Adjust your search.
                  </span>
                )}
              </ul>
            </div>
          )}

          {scope === 'groups' && (
            <Primary text="Create Group" onClick={onOpenCreateGroupModal} className="w-fit" />
          )}
        </div>
      )}
    </>
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
        /* v8 ignore next 3 -- unreachable: <Chat> is keyed on appointmentId, so any change remounts this initializer and resets prevAppointmentIdRef, meaning prevAppointmentId is never truthy here */
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

type GroupModalState = {
  open: boolean;
  mode: 'create' | 'edit';
  channel: StreamChannel | null;
  title: string;
  placeholder: string;
  members: string[];
  search: string;
  busy: boolean;
};

const INITIAL_GROUP_MODAL: GroupModalState = {
  open: false,
  mode: 'create',
  channel: null,
  title: '',
  placeholder: '',
  members: [],
  search: '',
  busy: false,
};

const useChatContainerView = ({
  appointmentId,
  onChannelSelect,
  className = '',
  scope = 'clients',
  onScopeChange,
}: ChatContainerProps) => {
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
  const [orgUsersStatus, setOrgUsersStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const orgUsersLoading = orgUsersStatus === 'loading';
  const [chatSessionChannels, setChatSessionChannels] = useState<any[]>([]);
  // Stream returns every channel the signed-in user belongs to, across all of
  // their organisations, so the list is scoped against the channels the backend
  // reports for the active organisation. Tagged with the org it was loaded for
  // so a stale response is never applied to the org switched into.
  const [orgChannelIds, setOrgChannelIds] = useState<{
    orgId: string;
    ids: Set<string>;
  } | null>(null);
  const [directSearch, setDirectSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [shareChannelId, setShareChannelId] = useState<string | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [directListHover, setDirectListHover] = useState(false);
  const [groupModal, setGroupModal] = useState<GroupModalState>(INITIAL_GROUP_MODAL);
  const {
    open: groupModalOpen,
    mode: groupModalMode,
    channel: groupModalChannel,
    title: groupModalTitle,
    placeholder: groupModalPlaceholder,
    members: groupModalMembers,
    search: groupModalSearch,
    busy: groupModalBusy,
  } = groupModal;
  const patchGroupModal = useCallback(
    (patch: Partial<GroupModalState>) => setGroupModal((state) => ({ ...state, ...patch })),
    []
  );
  const setGroupModalOpen = useCallback(
    (open: boolean) => patchGroupModal({ open }),
    [patchGroupModal]
  );
  const setGroupModalTitle = useCallback(
    (title: string) => patchGroupModal({ title }),
    [patchGroupModal]
  );
  const setGroupModalSearch = useCallback(
    (search: string) => patchGroupModal({ search }),
    [patchGroupModal]
  );
  const setGroupModalBusy = useCallback(
    (busy: boolean) => patchGroupModal({ busy }),
    [patchGroupModal]
  );
  const setGroupModalMembers = useCallback(
    (value: string[] | ((prev: string[]) => string[])) =>
      setGroupModal((state) => ({
        ...state,
        members: typeof value === 'function' ? value(state.members) : value,
      })),
    []
  );
  const groupModalBackendIdRef = useRef<string | undefined>(undefined);
  const { confirm, confirmDialog } = useConfirm();
  // Rendered into the modal, so state (not a ref); only written in the open
  // handlers below.
  const [groupModalOwner, setGroupModalOwner] = useState<string | undefined>(undefined);
  const orgUsersRequestKeyRef = useRef<string | null>(null);

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
    const requestedOrgId = primaryOrgId;
    getChatSessions(requestedOrgId, { includeClosed: true })
      .then((response) => {
        const payload: any = response ?? {};
        const channels = getSessionChannels(payload);
        setChatSessionChannels(channels);
        setOrgChannelIds({
          orgId: requestedOrgId,
          ids: new Set<string>(
            channels.reduce((ids: string[], session: any) => {
              const channelId = String(session?.channelId ?? '');
              if (channelId.length > 0) ids.push(channelId);
              return ids;
            }, [])
          ),
        });
      })
      .catch((err) => {
        console.error('Failed to load chat session statuses:', err);
        // Without the organisation's session list there is nothing to scope the
        // channel list by, so drop the allow-list rather than emptying the
        // sidebar on a transient API failure.
        setOrgChannelIds(null);
      });
  }, [getSessionChannels, primaryOrgId]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  // Drop the previous organisation's colleague list during render (compare-guard)
  // when the org switches; the effect below only clears the request-dedupe ref.
  const [prevOrgUsersOrgId, setPrevOrgUsersOrgId] = useState(primaryOrgId);
  if (prevOrgUsersOrgId !== primaryOrgId) {
    setPrevOrgUsersOrgId(primaryOrgId);
    setOrgUsersStatus('idle');
    setOrgUsers([]);
  }

  useEffect(() => {
    orgUsersRequestKeyRef.current = null;
  }, [primaryOrgId]);

  // Deselect the channel when an appointment scope arrives or changes, computed
  // during render (compare-guard, seeded so it also fires on the first render).
  const [prevAppointmentKey, setPrevAppointmentKey] = useState<{ id?: string } | null>(null);
  if (prevAppointmentKey === null || prevAppointmentKey.id !== appointmentId) {
    setPrevAppointmentKey({ id: appointmentId });
    if (appointmentId) {
      setIsChannelSelected(false);
      setShowEmptyPlaceholder(true);
    }
  }

  const resolveGroupIdForChannel = useCallback(
    async (chan: StreamChannel | null) => {
      if (!chan) {
        /* v8 ignore next -- unreachable: openEdit is only invoked from the group header behind an `if (channel)` guard, so `chan` is always a channel */
        return undefined;
      }
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

  // Read through a ref so an inline callback prop cannot re-trigger the scope
  // reset below on every parent render. Synced in a layout effect so the reset
  // below (also a layout effect, declared after) reads the latest value.
  const onChannelSelectRef = useRef(onChannelSelect);
  useLayoutEffect(() => {
    onChannelSelectRef.current = onChannelSelect;
  });

  useLayoutEffect(() => {
    // Reset selection when switching audience scopes so stale channels do not persist
    const hasInitialized = scopeInitialized.current;
    scopeInitialized.current = true;
    if (!hasInitialized) return;

    setIsChannelSelected(false);
    setShowEmptyPlaceholder(true);
    onChannelSelectRef.current?.(null);
  }, [scope]);

  // Load org users for colleague/group creation flows
  useLayoutEffect(() => {
    const shouldLoadUsers = (scope === 'colleagues' || scope === 'groups') && primaryOrgId;
    if (!shouldLoadUsers) return;
    const requestKey = `${primaryOrgId}:${scope}`;
    if (orgUsersRequestKeyRef.current === requestKey) return;

    orgUsersRequestKeyRef.current = requestKey;
    setOrgUsersStatus('loading');
    if (!primaryOrgId) {
      /* v8 ignore next -- unreachable: `shouldLoadUsers` above is only truthy when `primaryOrgId` is truthy; this guard exists purely to narrow `string | null` for fetchOrgUsers */
      return;
    }
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
        setOrgUsersStatus('loaded');
      })
      .catch((err) => {
        console.error('Failed to load org users for chat:', err);
        orgUsersRequestKeyRef.current = null;
        setOrgUsersStatus('idle');
      });
  }, [scope, primaryOrgId]);

  const openCreateGroupModal = useCallback(() => {
    groupModalBackendIdRef.current = undefined;
    setGroupModalOwner(client?.userID);
    setGroupModal({ ...INITIAL_GROUP_MODAL, mode: 'create', open: true });
  }, [client]);

  const openEditGroupModal = useCallback(
    async (chan: StreamChannel) => {
      patchGroupModal({ mode: 'edit', channel: chan });
      const placeholder =
        normalizeName(
          typeof (chan.data as any)?.title === 'string' ? (chan.data as any).title : undefined
        ) ||
        normalizeName(
          typeof (chan.data as any)?.name === 'string' ? (chan.data as any).name : undefined
        ) ||
        '';
      patchGroupModal({ placeholder, title: '' });
      const memberIds = chan.state?.members ? Object.keys(chan.state.members) : [];
      setGroupModalMembers(memberIds);
      // Find owner from members array (role: "owner") or fallback to created_by
      const membersArray = chan.state?.members ? Object.values(chan.state.members) : [];
      const ownerMember = membersArray.find((m: any) => m.role === 'owner');
      setGroupModalOwner(
        ownerMember?.user_id ||
          ownerMember?.user?.id ||
          (chan.data as any)?.createdBy ||
          (chan as any)?.created_by?.id
      );
      const backendId = await resolveGroupIdForChannel(chan);
      groupModalBackendIdRef.current = backendId;
      patchGroupModal({ search: '', open: true });
    },
    [resolveGroupIdForChannel, patchGroupModal, setGroupModalMembers]
  );

  const previewComponent = useMemo(
    () => createPreviewComponent(handlePreviewSelect, client?.userID, showArchived),
    [handlePreviewSelect, client?.userID, showArchived]
  );

  const belongsToPrimaryOrg = useCallback(
    (chan: StreamChannel) => {
      /* v8 ignore next -- unreachable: the Stream client is only created once an org is selected, and nothing that uses this predicate renders until the client exists */
      if (!primaryOrgId) return true;
      const data = chan.data as { organisationId?: string; organisationIds?: string[] } | undefined;
      // Cross-clinic conversations belong to both sides, so the stamp is a
      // list; single-org channels written before it existed carry the scalar.
      const declaredOrgIds = data?.organisationIds ?? [];
      const stamped = declaredOrgIds.length
        ? declaredOrgIds
        : [data?.organisationId].filter(Boolean);
      if (stamped.length) return stamped.includes(primaryOrgId);
      // Channels created before the stamp fall back to the backend's org-scoped
      // session list, which is only trusted once it has loaded for the
      // organisation currently selected.
      if (orgChannelIds?.orgId !== primaryOrgId) return true;
      return orgChannelIds.ids.has(chan.id ?? '');
    },
    [primaryOrgId, orgChannelIds]
  );

  const channelFilter = useCallback<NonNullable<ChannelListProps['channelRenderFilterFn']>>(
    (channels) => {
      const scopeMatches = (chan: StreamChannel) => {
        if (!scope) {
          /* v8 ignore next -- unreachable: `scope` is destructured with a 'clients' default, so it is always one of the three ChatScope values */
          return true;
        }
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
      return channels.filter(
        (chan) => belongsToPrimaryOrg(chan) && scopeMatches(chan) && searchMatches(chan)
      );
    },
    [scope, searchTerm, belongsToPrimaryOrg]
  );

  const shareContextValue = useMemo(
    () => ({ openShare: (id: string) => setShareChannelId(id) }),
    []
  );

  const activateChannelById = useCallback(
    async (channelId: string) => {
      if (!client) {
        /* v8 ignore next -- unreachable: this callback is only reached from the rendered chat tree (command-palette jump, post-create activation), and the `if (!client) return null` guard below means nothing renders until `client` is set */
        return;
      }
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      setIsChannelSelected(true);
      setShowEmptyPlaceholder(false);
      onChannelSelect?.(channel);
    },
    [client, onChannelSelect]
  );

  /**
   * Shared post-create activation for backend chat sessions: query the
   * session's channel so it appears in lists, stamp the chat metadata on it,
   * and select it (falling back to activateChannelById when the query misses).
   */
  const activateSessionChannel = useCallback(
    async (chatClient: StreamChat, channelId: string, metadata: Record<string, unknown>) => {
      const applyMetadata = (chan: StreamChannel) => chan.update(metadata, {});
      const queried = await chatClient.queryChannels(
        { id: { $eq: channelId } },
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
        await activateChannelById(channelId);
        const chan = chatClient.channel('team', channelId);
        await applyMetadata(chan);
      }
    },
    [activateChannelById, onChannelSelect]
  );

  const handleStartDirectChat = useCallback(
    async (user: OrgUserOption) => {
      if (!primaryOrgId || !client) return;
      const candidateIds = Array.from(
        new Set([user.userId, user.practitionerId, user.id].filter(Boolean))
      ) as string[];
      /* v8 ignore start -- unreachable: fetchOrgUsers only yields users with a truthy id, so a rendered teammate always produces at least one candidate id */
      if (!candidateIds.length) {
        notify('error', {
          title: 'Can’t start chat',
          text: 'No valid user identifier found for this teammate.',
        });
        return;
      }
      /* v8 ignore stop */
      setCreatingChat(true);
      const candidateIdSet = new Set(candidateIds);

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
            return candidateIdSet.has(memberId);
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
          if (candidateIdSet.has(otherMemberId)) return true;

          // Also check user.id and user.name from member object
          const otherMember = members[otherMemberId];
          const otherUserIdFromMember = otherMember?.user?.id || otherMember?.user_id;
          if (otherUserIdFromMember && candidateIdSet.has(otherUserIdFromMember)) return true;

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
          await activateSessionChannel(client, session.channelId, {
            directId: session._id,
            title: session.title,
            description: session.description,
            type: session.type,
            chatCategory: 'colleagues',
            organisationId: session.organisationId,
            createdBy: session.createdBy,
          });
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
    [primaryOrgId, client, activateSessionChannel, onChannelSelect, notify]
  );

  const handleNetworkChatStarted = useCallback(
    async (channelId: string) => {
      setNetworkModalOpen(false);
      if (!client) {
        /* v8 ignore next -- unreachable: NetworkDirectoryModal is only rendered inside the chat tree, which the `if (!client) return null` guard below gates on a non-null client */
        return;
      }
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
        await activateSessionChannel(client, session.channelId, {
          groupId: session._id,
          title: session.title || title,
          description: session.description,
          type: session.type,
          chatCategory: 'group',
          organisationId: session.organisationId,
          createdBy: session.createdBy,
        });
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
    [primaryOrgId, client, activateSessionChannel, notify, setGroupModalBusy, setGroupModalOpen]
  );

  const handleModalUpdateTitle = useCallback(
    async (title: string) => {
      const groupModalBackendId = groupModalBackendIdRef.current;
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
        patchGroupModal({ placeholder: title, title: '' });
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
    [groupModalChannel, notify, patchGroupModal, setGroupModalBusy]
  );

  const handleModalAddMember = useCallback(
    async (userId: string) => {
      const groupModalBackendId = groupModalBackendIdRef.current;
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
    [groupModalChannel, notify, setGroupModalBusy, setGroupModalMembers]
  );

  const handleModalRemoveMember = useCallback(
    async (userId: string) => {
      const groupModalBackendId = groupModalBackendIdRef.current;
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
    [groupModalChannel, notify, setGroupModalBusy, setGroupModalMembers]
  );

  const handleModalDelete = useCallback(async () => {
    const groupModalBackendId = groupModalBackendIdRef.current;
    if (!groupModalBackendId) {
      notify('error', {
        title: 'Can’t delete group',
        text: 'Group id not available.',
      });
      return;
    }
    const confirmed = await confirm({
      title: 'Delete this group?',
      body: 'The group and its messages are removed for everyone. This cannot be undone.',
      confirmLabel: 'Delete group',
      tone: 'danger',
    });
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
  }, [groupModalChannel, onChannelSelect, notify, setGroupModalBusy, setGroupModalOpen, confirm]);

  const groupModalContextValue = useMemo(
    () => ({
      openCreate: openCreateGroupModal,
      openEdit: openEditGroupModal,
    }),
    [openCreateGroupModal, openEditGroupModal]
  );
  const statusByAppointmentId = useMemo(() => {
    const next: Record<string, 'active' | 'ended'> = {};
    chatSessionChannels.forEach((session: any) => {
      if (session.appointmentId) {
        const rawStatus = String(session.status || '').toLowerCase();
        next[session.appointmentId] =
          rawStatus === 'closed' || rawStatus === 'ended' ? 'ended' : 'active';
      }
    });
    return next;
  }, [chatSessionChannels]);
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
    let errorMessage = error;
    if (!errorMessage) {
      /* v8 ignore next -- unreachable: `hasError` can only be truthy when `error` holds a message — when `error` is null and `client` is null the isLoading guard above returns first — so this generic fallback never renders */
      errorMessage = 'Unable to load chat';
    }
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

  /* v8 ignore start -- unreachable: the isLoading/hasError guards above already return for every null-client state, so control never reaches here with a null client */
  if (!client) {
    return null;
  }
  /* v8 ignore stop */

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
          <ChatSidebarHeader
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived((value) => !value)}
            scope={scope}
            onScopeChange={onScopeChange}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            crossOrgEnabled={crossOrgEnabled}
            onOpenNetworkDirectory={() => setNetworkModalOpen(true)}
            directSearch={directSearch}
            onDirectSearchChange={setDirectSearch}
            onDirectSearchFocus={() => {
              if (directBlurTimeout.current) {
                clearTimeout(directBlurTimeout.current);
                directBlurTimeout.current = null;
              }
              setSearchFocused(true);
            }}
            onDirectSearchBlur={() => {
              directBlurTimeout.current = setTimeout(() => {
                if (!directListHover) {
                  setSearchFocused(false);
                }
              }, 120);
            }}
            onDirectListMouseEnter={() => setDirectListHover(true)}
            onDirectListMouseLeave={() => {
              setDirectListHover(false);
              if (!searchFocused) setSearchFocused(false);
            }}
            searchFocused={searchFocused}
            directListHover={directListHover}
            orgUsersLoading={orgUsersLoading}
            orgUsers={orgUsers}
            currentUserId={client.userID}
            creatingChat={creatingChat}
            onStartDirectChat={handleStartDirectChat}
            onOpenCreateGroupModal={openCreateGroupModal}
          />
        }
      />
      <ChatCommandPalette
        client={client}
        filters={filters}
        onJump={activateChannelById}
        channelBelongsToOrg={belongsToPrimaryOrg}
      />
    </>
  );

  return (
    <ChatSessionStatusContext.Provider value={chatSessionStatusContextValue}>
      {confirmDialog}
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
                /* v8 ignore start -- unreachable: onCleared is only invoked from a code path that the appointmentId-keyed <Chat> remount makes dead (see AppointmentChannelInitializer) */
                onCleared={() => {
                  setIsChannelSelected(false);
                  setShowEmptyPlaceholder(true);
                  onChannelSelect?.(null);
                }}
                /* v8 ignore stop */
              />
              {chatContent}
            </Chat>
            <GroupModal
              open={groupModalOpen}
              mode={groupModalMode}
              title={groupModalTitle}
              placeholder={groupModalPlaceholder}
              members={groupModalMembers}
              ownerId={groupModalOwner}
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

export const ChatContainer: FC<ChatContainerProps> = (props) => useChatContainerView(props);

const ProtectedChatContainer = () => {
  return (
    <ProtectedRoute skeleton={CHAT_PAGE_SKELETON}>
      <OrgGuard skeleton={CHAT_PAGE_SKELETON}>
        <ChatContainer />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export { ChannelPreviewWrapper, ChatClosedFooter };

export default ProtectedChatContainer;
