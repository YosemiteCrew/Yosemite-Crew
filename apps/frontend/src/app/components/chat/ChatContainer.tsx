"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from "react";
import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
  ChannelPreviewMessenger,
  useChannelStateContext,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import type { Channel as StreamChannel } from "stream-chat";
import type {
  ChannelPreviewUIComponentProps,
  ChannelListProps,
} from "stream-chat-react";
import { MdDeleteForever } from "react-icons/md";
import { IoIosAddCircleOutline } from "react-icons/io";

import "stream-chat-react/dist/css/v2/index.css";
import "./ChatContainer.css";

import {
  getChatClient,
  connectStreamUser,
  endChatChannel,
} from "@/app/services/streamChatService";
import {
  createOrgDirectChat,
  createOrgGroupChat,
  fetchOrgUsers,
  addGroupMembers,
  removeGroupMembers,
  updateGroup,
  deleteGroup,
  listOrgChatSessions,
} from "@/app/services/chatService";
import { YosemiteLoader } from "../Loader";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import Modal from "../Modal";
import FormInput from "../Inputs/FormInput/FormInput";
import Close from "../Icons/Close";

const GroupModalContext = React.createContext<{
  openEdit?: (channel: StreamChannel) => void;
  openCreate?: () => void;
}>({});
import ProtectedRoute from "../ProtectedRoute";
import OrgGuard from "../OrgGuard";

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
  scope?: ChatScope;
}

interface ChannelPreviewWrapperProps extends ChannelPreviewUIComponentProps {
  onPreviewSelect?: (channel: StreamChannel | null) => void;
  currentUserId?: string | null;
}

interface ChatLayoutProps {
  filters: ChannelListProps["filters"];
  sort: ChannelListProps["sort"];
  options: ChannelListProps["options"];
  isMobile: boolean;
  isChannelSelected: boolean;
  previewComponent: React.ComponentType<ChannelPreviewUIComponentProps>;
  onBack: () => void;
  currentUserId?: string | null;
  channelFilter?: ChannelListProps["channelRenderFilterFn"];
  showEmpty?: boolean;
  channelListHeader?: React.ReactNode;
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
}

export type ChatScope = "clients" | "colleagues" | "groups";

const normalizeName = (value?: string) => {
  if (!value) return "";
  // Remove templated space markers like {' '} using iterative approach
  let result = "";
  let i = 0;
  while (i < value.length) {
    if (value[i] === "{") {
      const closeIdx = value.indexOf("}", i + 1);
      if (closeIdx !== -1) {
        result += " ";
        i = closeIdx + 1;
        continue;
      }
    }
    result += value[i];
    i++;
  }
  // collapse whitespace
  return result.replaceAll(/\s+/g, " ").trim();
};

type OrgUserOption = {
  id: string;
  userId?: string;
  practitionerId?: string;
  name: string;
  email?: string;
  image?: string;
  role?: string;
};

const primaryActionClasses =
  "px-8 py-[12px] flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 font-satoshi text-[18px] font-medium leading-[26px] text-center bg-text-primary text-white";
const outlineActionClasses =
  "px-8 py-[12px] flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out border border-text-primary! text-text-primary! hover:text-text-brand! hover:border-text-brand!";
const dangerActionClasses =
  "px-8 py-[12px] flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 font-satoshi text-[18px] font-medium leading-[26px] text-center bg-text-error text-white";
const disabledActionClasses = "opacity-60 cursor-not-allowed";

interface GroupModalProps {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  placeholder: string;
  members: string[];
  backendId?: string;
  ownerId?: string;
  currentUserId?: string;
  search: string;
  busy: boolean;
  orgUsers: OrgUserOption[];
  orgUsersLoading: boolean;
  channel: StreamChannel | null;
  onClose: () => void;
  onTitleChange: (val: string) => void;
  onSearchChange: (val: string) => void;
  onMembersChange: (ids: string[]) => void;
  onCreate: (title: string, memberIds: string[]) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

const GroupModal: React.FC<GroupModalProps> = ({
  open,
  mode,
  title,
  placeholder,
  members,
  backendId,
  ownerId,
  currentUserId,
  search,
  busy,
  orgUsers,
  orgUsersLoading,
  channel,
  onClose,
  onTitleChange,
  onSearchChange,
  onMembersChange,
  onCreate,
  onUpdateTitle,
  onAddMember,
  onRemoveMember,
  onDelete,
}) => {
  const [showModal, setShowModal] = useState(open);

  useEffect(() => {
    setShowModal(open);
  }, [open]);

  const handleClose = () => {
    setShowModal(false);
    onClose();
  };

  // In create mode, the current user is always the creator
  // In edit mode, check if ownerId matches currentUserId (with flexible ID matching)
  const isCreator = mode === "create" || Boolean(
    ownerId && currentUserId && (
      ownerId === currentUserId ||
      // Also check if the owner matches any variant of the user's ID in orgUsers
      orgUsers.some(u =>
        (u.userId === currentUserId || u.id === currentUserId || u.practitionerId === currentUserId) &&
        (u.userId === ownerId || u.id === ownerId || u.practitionerId === ownerId)
      )
    )
  );

  const memberDetails = members
    .map((id) => {
      const user = orgUsers.find(
        (u) => u.userId === id || u.id === id || u.practitionerId === id
      );
      const channelMember = channel?.state?.members?.[id];
      return {
        id,
        name: user?.name || channelMember?.user?.name || id,
        email: user?.email,
      };
    });

  const availableUsers = orgUsers
    .map((u) => ({ ...u, keyId: u.userId ?? u.id }))
    .filter((u) => u.keyId)
    .filter((u) => u.keyId !== currentUserId) // Exclude current user from add list
    .filter(
      (u) =>
        !members.includes(u.keyId!) &&
        !members.includes(u.id) &&
        (u.name + (u.email ?? "") + (u.role ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase())
    )
    .slice(0, 10);

  const handleCreate = async () => {
    if (!title.trim() || members.length === 0) {
      alert("Add a group title and at least one member.");
      return;
    }
    await onCreate(title.trim(), members);
  };

  const handleSaveTitle = async () => {
    if (!title.trim()) return;
    await onUpdateTitle(title.trim());
  };

  const handleAddMemberClick = (userId: string) => {
    if (mode === "create") {
      onMembersChange([...members, userId]);
    } else {
      onAddMember(userId);
    }
  };

  const handleRemoveMemberClick = (userId: string) => {
    if (mode === "create") {
      onMembersChange(members.filter((id) => id !== userId));
    } else {
      onRemoveMember(userId);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} onClose={handleClose}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="text-body-1 text-text-primary">
            {mode === "create" ? "Create group" : "Group info"}
          </div>
          <Close onClick={handleClose} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden gap-6">
          <div className="flex-1 overflow-y-auto flex flex-col gap-6 pt-1 scrollbar-hidden pr-1 px-3">
            {(mode === "create" || isCreator) && (
              <div className="flex flex-col gap-3">
                <FormInput
                  intype="text"
                  inname="groupTitle"
                  inlabel={mode === "edit" && placeholder ? placeholder : "Group Title"}
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
              />
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={busy || !title.trim()}
                  className={`${primaryActionClasses} self-start ${
                    busy || !title.trim() ? disabledActionClasses : "cursor-pointer"
                  }`}
                >
                  {busy ? "Saving..." : "Save Title"}
                </button>
              )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="text-body-2 text-text-primary font-medium">
                Members ({memberDetails.length})
              </div>

              {memberDetails.length > 0 && (
                <div className="flex flex-col gap-2">
                  {memberDetails.map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between items-center px-3 py-3 border border-grey-light rounded-2xl bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-card-hover flex items-center justify-center">
                          <span className="font-satoshi text-black-text text-sm font-medium">
                            {(m.name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-body-4 text-text-primary">{m.name}</span>
                          {m.email && (
                            <span className="text-caption-2 text-text-secondary">{m.email}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mode === "edit" && m.id === ownerId && (
                          <span className="text-caption-1 text-text-brand px-2 py-1 bg-blue-50 rounded-lg">Owner</span>
                        )}
                        {isCreator && m.id !== ownerId && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberClick(m.id)}
                            disabled={busy}
                            className={`p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200 ${
                              busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                            }`}
                            title="Remove member"
                          >
                            <MdDeleteForever size={20} color="#EA3729" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(mode === "create" || isCreator) && (
              <div className="flex flex-col gap-3">
                <div className="text-body-2 text-text-primary font-medium">
                  {mode === "create" ? "Add members" : "Add more members"}
                </div>

                <FormInput
                  intype="text"
                  inname="searchMembers"
                  inlabel="Search teammates"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                />

                <div className="min-h-[120px] max-h-[300px] overflow-y-auto flex flex-col gap-2 pr-1">
                  {orgUsersLoading && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-caption-1 text-text-secondary">Loading teammates…</span>
                    </div>
                  )}
                  {!orgUsersLoading && availableUsers.length === 0 && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-caption-1 text-text-secondary">
                        {(() => {
                          if (orgUsers.length === 0) return "No teammates available. Please wait...";
                          if (search.trim()) return "No teammates match your search.";
                          return "All teammates have been added.";
                        })()}
                      </span>
                    </div>
                  )}
                  {!orgUsersLoading &&
                    availableUsers.map((u) => (
                      <div
                        key={u.keyId}
                        className="flex justify-between items-center px-3 py-3 border border-grey-light rounded-2xl bg-white hover:border-input-border-active transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-card-hover flex items-center justify-center">
                            <span className="font-satoshi text-black-text text-sm font-medium">
                              {(u.name || u.email || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-body-4 text-text-primary">{u.name}</span>
                            {u.email && (
                              <span className="text-caption-2 text-text-secondary">{u.email}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMemberClick(u.keyId!)}
                          disabled={busy}
                          className={`p-1.5 rounded-lg hover:bg-green-50 transition-all duration-200 ${
                            busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                          title="Add member"
                        >
                          <IoIosAddCircleOutline size={24} color="#302f2e" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {!isCreator && mode === "edit" && (
              <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
                <span className="text-caption-1 text-yellow-700">
                  Only the group creator can modify this group.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 pb-1 px-3">
            {mode === "create" && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className={`${primaryActionClasses} ${
                  busy ? disabledActionClasses : "cursor-pointer"
                }`}
              >
                {busy ? "Creating..." : "Create Group"}
              </button>
            )}
            {mode === "edit" && isCreator && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className={`${dangerActionClasses} ${
                  busy ? disabledActionClasses : "cursor-pointer"
                }`}
              >
                {busy ? "Deleting..." : "Delete Group"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const getChannelDisplayInfo = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): ChannelDisplayInfo => {
  if (!channel) {
    return { title: "Chat" };
  }

  const channelData = (channel.data || {}) as Record<string, unknown>;
  const explicitTitle =
    normalizeName(typeof channelData.title === "string" ? channelData.title : undefined) ||
    normalizeName(typeof channelData.name === "string" ? channelData.name : undefined);
  const membersArray = channel.state?.members
    ? Object.values(channel.state.members)
    : [];
  const counterpart =
    membersArray.find((member) => member.user?.id !== currentUserId) ??
    membersArray[0];

  const petOwnerName =
    typeof channelData.petOwnerName === "string"
      ? channelData.petOwnerName
      : undefined;
  const petName =
    typeof channelData.petName === "string" ? channelData.petName : undefined;

  const counterpartName = normalizeName(
    counterpart?.user?.name || counterpart?.user_id
  );
  const counterpartImage = counterpart?.user?.image;

  const title =
    explicitTitle ||
    (petName && petOwnerName ? `${petName}{' '}(${petOwnerName})` : undefined) ||
    petOwnerName ||
    petName ||
    counterpartName ||
    explicitTitle ||
    channel.id ||
    "Chat";

  const image =
    (typeof channelData.image === "string" ? channelData.image : undefined) ||
    counterpartImage;

  return { title, image };
};

const resolveChannelScope = (
  channel: StreamChannel,
  currentUserId?: string | null
): ChatScope => {
  const data = (channel.data || {}) as Record<string, unknown>;
  const rawCategory = [
    data.chatCategory,
    data.channelCategory,
    data.category,
    (data.chat_type as string | undefined),
    (data.channelType as string | undefined),
  ].find((value) => typeof value === "string") as string | undefined;

  const normalizedCategory = rawCategory?.toLowerCase();

  if (
    normalizedCategory === "client" ||
    normalizedCategory === "clients" ||
    normalizedCategory === "pet-parent" ||
    normalizedCategory === "pet_parent"
  ) {
    return "clients";
  }

  if (
    normalizedCategory === "colleague" ||
    normalizedCategory === "colleagues" ||
    normalizedCategory === "team" ||
    normalizedCategory === "staff" ||
    normalizedCategory === "internal"
  ) {
    return "colleagues";
  }

  if (
    normalizedCategory === "group" ||
    normalizedCategory === "groups" ||
    normalizedCategory === "common" ||
    normalizedCategory === "broadcast"
  ) {
    return "groups";
  }

  const memberCount =
    channel.state?.members && Object.keys(channel.state.members).length > 0
      ? Object.keys(channel.state.members).length
      : typeof (data as any)?.member_count === "number"
        ? Number((data as any)?.member_count)
        : 0;

  const hasAppointmentDetails = Boolean(
    (data as any)?.appointmentId ||
      (data as any)?.petOwnerId ||
      (data as any)?.petOwnerName
  );

  if (hasAppointmentDetails) {
    return "clients";
  }

  if (
    (data as any)?.isGroup === true ||
    (data as any)?.group === true ||
    memberCount > 2
  ) {
    return "groups";
  }

  // Default to colleagues for internal PMS chats when no metadata is present
  return "colleagues";
};

// Custom hook for channel state management
const useChannelState = () => {
  const { channel } = useChannelStateContext();
  const [state, setState] = useState<ChannelState>({
    frozen: false,
    updatedAt: undefined,
  });

  useEffect(() => {
    if (channel) {
      const channelData = channel.data as any;
      const isFrozen = channelData?.frozen === true;
      const updatedAt = channelData?.updated_at;

      setState({ frozen: isFrozen, updatedAt });

      // Listen for channel updates
      const handleChannelUpdate = () => {
        const updatedData = channel.data as any;
        const newFrozen = updatedData?.frozen === true;
        const newUpdatedAt = updatedData?.updated_at;
        setState({ frozen: newFrozen, updatedAt: newUpdatedAt });
      };

      channel.on('channel.updated', handleChannelUpdate);

      return () => {
        channel.off('channel.updated', handleChannelUpdate);
      };
    }
  }, [channel]);

  return state;
};

const ChannelHeaderWithCounterpart: React.FC<{
  currentUserId?: string | null;
}> = ({ currentUserId }) => {
  const { channel } = useChannelStateContext();
  const orgIdFromStore = useOrgStore((state) => state.primaryOrgId);
  const groupModalCtx = useContext(GroupModalContext);
  const [closingSession, setClosingSession] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const { title } = getChannelDisplayInfo(
    channel as StreamChannel | null,
    currentUserId
  );
  const scope = channel ? resolveChannelScope(channel as StreamChannel, currentUserId) : "colleagues";
  const channelMemberCount = channel?.state?.members ? Object.keys(channel.state.members).length : 0;
  const dataType = (channel?.data as any)?.type as string | undefined;
  const chatCategory = (channel?.data as any)?.chatCategory as string | undefined;
  const isTeamChannel = (channel?.type || "").toLowerCase() === "team";
  const isOrgGroupType =
    dataType === "ORG_GROUP" ||
    (chatCategory || "").toLowerCase() === "group";
  const isClientChat = scope === "clients";
  const isGroupChat =
    scope === "groups" ||
    isOrgGroupType ||
    (isTeamChannel && channelMemberCount > 2);
  const organisationId =
    ((channel?.data as any)?.organisationId as string | undefined) ||
    orgIdFromStore ||
    undefined;
  const createdById =
    (channel?.data as any)?.createdBy ||
    (channel?.data as any)?.created_by_id ||
    (channel as any)?.created_by?.id;
  const memberRoleForCurrentUser =
    currentUserId && channel?.state?.members?.[currentUserId]
      ? (channel.state.members[currentUserId] as any)?.role ||
        (channel.state.members[currentUserId] as any)?.channel_role
      : undefined;
  const isCreator =
    Boolean(createdById && currentUserId && createdById === currentUserId) ||
    (memberRoleForCurrentUser === "owner");
  const channelId = channel?.id;

  // Check if session is already closed
  useEffect(() => {
    if (channel) {
      const status = (channel.data as any)?.status;
      const frozen = (channel.data as any)?.frozen;
      const isSessionClosed = status === 'ended' || frozen === true;
      setSessionClosed(isSessionClosed);
    }
  }, [channel]);

  const handleCloseSession = async () => {
    if (!channel) return;

    // Prevent duplicate calls if already closing or already closed
    if (closingSession || sessionClosed) return;

    const confirmed = confirm("Are you sure you want to close this chat session? The client will no longer be able to send messages.");
    if (!confirmed) {
      return;
    }

    setClosingSession(true);
    try {
      const appointmentId = (channel.data as any)?.appointmentId;
      if (appointmentId) {
        await endChatChannel(appointmentId);
        setSessionClosed(true);
        alert("Chat session closed successfully");
      }
    } catch (error) {
      console.error("Failed to close chat session:", error);
      alert("Failed to close chat session. Please try again.");
    } finally {
      setClosingSession(false);
    }
  };

  const hasSessionClosed = sessionClosed;

  const memberCount = channel?.state?.members
    ? Object.keys(channel.state.members).length
    : 0;

  return (
    <div className="chat-header-bar">
      <ChannelHeader title={title} />
      <div className="flex items-center gap-3">
        {isGroupChat && (
          <button
            type="button"
            onClick={() => groupModalCtx.openEdit?.(channel as StreamChannel)}
            className={`${primaryActionClasses} cursor-pointer`}
          >
            Group Info
          </button>
        )}
        {isClientChat && hasSessionClosed && (
          <div className="px-3 py-1.5 bg-grey-light border border-grey-border rounded-lg">
            <p className="text-caption-1 text-text-secondary font-medium m-0">
              Session Closed
            </p>
          </div>
        )}
        {isClientChat && !hasSessionClosed && (
          <button
            onClick={handleCloseSession}
            disabled={closingSession}
            className={`${primaryActionClasses} bg-black-bg border border-black-bg hover:shadow-lg ${
              closingSession ? disabledActionClasses : "cursor-pointer"
            }`}
          >
            {closingSession ? "Closing..." : "Close Session"}
          </button>
        )}
      </div>
    </div>
  );
};

const ChannelPreviewWrapper: React.FC<ChannelPreviewWrapperProps> = ({
  onPreviewSelect,
  currentUserId,
  ...previewProps
}) => {
  const handlePreviewSelect: React.MouseEventHandler<HTMLDivElement> = (
    event
  ) => {
    previewProps.onSelect?.(event);
    onPreviewSelect?.(previewProps.channel ?? null);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (
    event
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePreviewSelect(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const { title, image } = getChannelDisplayInfo(
    previewProps.channel ?? null,
    currentUserId
  );

  // Using div with role="option" since this is inside a listbox (ChannelList)
  // and ChannelPreviewMessenger contains interactive elements (buttons)
  return (
    <div
      role="option"
      aria-selected={previewProps.active}
      tabIndex={0}
      className="chat-preview-trigger"
      onClick={handlePreviewSelect}
      onKeyDown={handleKeyDown}
      style={{
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        textAlign: "left",
        width: "100%",
      }}
    >
      <ChannelPreviewMessenger
        {...previewProps}
        displayTitle={title}
        displayImage={image}
      />
    </div>
  );
};

const createPreviewComponent = (
  onPreviewSelect: (channel: StreamChannel | null) => void,
  currentUserId?: string | null
): React.ComponentType<ChannelPreviewUIComponentProps> => {
  const PreviewComponent: React.FC<ChannelPreviewUIComponentProps> = (
    props
  ) => (
    <ChannelPreviewWrapper
      {...props}
      onPreviewSelect={onPreviewSelect}
      currentUserId={currentUserId}
    />
  );

  PreviewComponent.displayName = "ChatChannelPreview";
  return PreviewComponent;
};

const ChatClosedFooter: React.FC<{ closedAt?: string }> = ({ closedAt }) => {
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

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      // show year only when it's different from current year
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formattedClosedTime = formatClosedTime(closedAt);

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--grey-light)',
      borderTop: '1px solid var(--grey-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px'
    }}>
      <p className="font-satoshi" style={{
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--grey-text)',
        margin: 0,
      }}>
        Chat session closed
      </p>
      {formattedClosedTime && (
        <p className="font-satoshi" style={{
          fontSize: '12px',
          color: 'var(--grey-noti)',
          margin: 0,
        }}>
          {formattedClosedTime}
        </p>
      )}
    </div>
  );
};

// Shared component for channel window content with different header components
interface ChannelWindowContentProps {
  currentUserId?: string | null;
  headerComponent: React.ComponentType<{ currentUserId?: string | null }>;
}

const ChannelWindowContent: React.FC<ChannelWindowContentProps> = ({ 
  currentUserId, 
  headerComponent: HeaderComponent 
}) => {
  const channelState = useChannelState();
  const HeaderComponentTyped = HeaderComponent;

  return (
    <div className="str-chat__window">
      <Window>
        <HeaderComponentTyped currentUserId={currentUserId} />
        <MessageList />
        {channelState.frozen ? (
          <ChatClosedFooter closedAt={channelState.updatedAt} />
        ) : (
          <MessageInput />
        )}
      </Window>
    </div>
  );
};


// Specialized components for different use cases with distinct implementations
// Reuse ChannelWindowContent for both appointment and regular channels
const AppointmentChannelWindow: React.FC<{ currentUserId?: string | null }> = ({ currentUserId }) => (
  <ChannelWindowContent headerComponent={ChannelHeaderWithCounterpart} currentUserId={currentUserId} />
);

const RegularChannelWindow: React.FC<{ currentUserId?: string | null }> = ({ currentUserId }) => (
  <ChannelWindowContent headerComponent={ChannelHeaderWithCounterpart} currentUserId={currentUserId} />
);

const ChatWindow: React.FC<ChatWindowProps> = ({
  showBackButton,
  onBack,
  currentUserId,
}) => {
  const shouldShowBackButton = showBackButton;

  return (
    <>
      {shouldShowBackButton && (
        <button type="button" className="chat-back-button" onClick={onBack}>
          ← Back
        </button>
      )}
      <Channel>
        <RegularChannelWindow currentUserId={currentUserId} />
        <Thread />
      </Channel>
    </>
  );
};

const ChatMainPanel: React.FC<ChatMainPanelProps> = ({
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
        display: shouldShowChat ? "flex" : "none",
        flex: 1,
        minHeight: 0,
      }}
    >
      {showEmpty ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fbff",
            color: "#595958",
            fontFamily: "var(--font-satoshi)",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "16px" }}>
              Select a conversation to start chatting
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#747473" }}>
              Choose a channel from the list to load messages here.
            </p>
          </div>
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


const ChatLayout: React.FC<ChatLayoutProps> = ({
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
        style={{ display: shouldShowChannelList ? "flex" : "none" }}
      >
        {channelListHeader}
        <ChannelList
          filters={filters}
          sort={sort}
          options={options}
          Preview={previewComponent}
          channelRenderFilterFn={channelFilter}
          setActiveChannelOnMount={false}
        />
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

export const ChatContainer: React.FC<ChatContainerProps> = ({
  appointmentId,
  onChannelSelect,
  className = "",
  scope = "clients",
}) => {
  const attributes = useAuthStore((state) => state.attributes);
  const authStatus = useAuthStore((state) => state.status);
  const authLoading = useAuthStore((state) => state.loading);

  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const orgStatus = useOrgStore((state) => state.status);
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
  const [directSearch, setDirectSearch] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creatingChat, setCreatingChat] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [directListHover, setDirectListHover] = useState(false);
  const [groupSearchFocused, setGroupSearchFocused] = useState(false);
  const [groupListHover, setGroupListHover] = useState(false);
  const [groupListPinned, setGroupListPinned] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [groupModalChannel, setGroupModalChannel] = useState<StreamChannel | null>(null);
  const [groupModalTitle, setGroupModalTitle] = useState("");
  const [groupModalPlaceholder, setGroupModalPlaceholder] = useState("");
  const [groupModalMembers, setGroupModalMembers] = useState<string[]>([]);
  const [groupModalBackendId, setGroupModalBackendId] = useState<string | undefined>();
  const [groupModalSearch, setGroupModalSearch] = useState("");
  const [groupModalBusy, setGroupModalBusy] = useState(false);
  const groupModalOwnerRef = useRef<string | undefined>(undefined);
  const groupBlurTimeout = useRef<NodeJS.Timeout | null>(null);

  const directBlurTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setOrgUsersLoaded(false);
    setOrgUsers([]);
  }, [primaryOrgId]);

  const deriveGroupIdFromChannelId = useCallback((chanId?: string) => {
    if (!chanId) return undefined;
    if (chanId.startsWith("org-group-")) return chanId.replace("org-group-", "");
    return undefined;
  }, []);

  const resolveGroupIdForChannel = useCallback(
    async (chan: StreamChannel | null) => {
      if (!chan) return undefined;
      // ALWAYS query backend sessions API to get the correct session _id
      // The groupId/directId stored in channel data might be the Stream channel ID, not the backend session ID
      if (!primaryOrgId) {
        // Fallback to channel data if no org ID available
        const dataId =
          (chan.data as any)?.groupId ||
          (chan.data as any)?.directId ||
          (chan.data as any)?._id ||
          undefined;
        return dataId ? String(dataId) : undefined;
      }
      try {
        // First check if channel already has a valid backend session ID stored
        const storedGroupId = (chan.data as any)?.groupId;
        const storedDirectId = (chan.data as any)?.directId;

        console.log("Resolving group ID for channel:", chan.id, "cid:", chan.cid, "org:", primaryOrgId);
        console.log("Stored IDs in channel data - groupId:", storedGroupId, "directId:", storedDirectId);

        const sessions = await listOrgChatSessions(primaryOrgId);
        console.log("Sessions from API:", sessions);

        // Get channel members for matching
        const channelMemberIds = chan.state?.members ? Object.keys(chan.state.members) : [];
        const channelTitle = (chan.data as any)?.title || (chan.data as any)?.name;

        // First, check if the stored groupId/directId matches any session _id
        if (storedGroupId) {
          const matchedByStoredId = sessions.find((s) => s._id === storedGroupId);
          if (matchedByStoredId) {
            console.log("Matched by stored groupId:", matchedByStoredId);
            return matchedByStoredId._id;
          }
        }
        if (storedDirectId) {
          const matchedByStoredId = sessions.find((s) => s._id === storedDirectId);
          if (matchedByStoredId) {
            console.log("Matched by stored directId:", matchedByStoredId);
            return matchedByStoredId._id;
          }
        }

        // Match by channelId first, then by members as fallback
        const matched = sessions.find((s) => {
          // Exact match on channelId
          if (s.channelId === chan.id) return true;
          // Also check if channel cid matches (format: type:id)
          if (chan.cid && s.channelId === chan.cid) return true;
          // Check if channel ID contains the session channelId or vice versa
          if (chan.id && s.channelId && chan.id.includes(s.channelId)) return true;
          if (chan.id && s.channelId && s.channelId.includes(chan.id)) return true;

          // Match by members for ORG_DIRECT (2 members)
          if (s.type === "ORG_DIRECT" && channelMemberIds.length === 2) {
            const sessionMembers = s.members || [];
            // Check if both session members are in the channel
            const allMembersMatch = sessionMembers.every((sm: string) =>
              channelMemberIds.includes(sm)
            );
            if (allMembersMatch && sessionMembers.length === channelMemberIds.length) {
              return true;
            }
          }

          // Match by members and title for ORG_GROUP
          if (s.type === "ORG_GROUP" && channelMemberIds.length > 2) {
            const sessionMembers = s.members || [];
            // Check if members overlap significantly
            const matchingMembers = sessionMembers.filter((sm: string) =>
              channelMemberIds.includes(sm)
            );
            // If most members match and title matches, it's likely the same group
            if (matchingMembers.length >= Math.min(sessionMembers.length, channelMemberIds.length) - 1) {
              if (s.title && channelTitle && s.title === channelTitle) {
                return true;
              }
              // If member count is exact match
              if (matchingMembers.length === sessionMembers.length && matchingMembers.length === channelMemberIds.length) {
                return true;
              }
            }
          }

          return false;
        });
        console.log("Matched session:", matched);
        if (matched?._id) {
          return matched._id;
        }

        console.warn("No matching session found for channel. Channel members:", channelMemberIds, "Channel title:", channelTitle);
        // Fallback to channel data if no session found
        const dataId =
          (chan.data as any)?.groupId ||
          (chan.data as any)?.directId ||
          (chan.data as any)?._id ||
          undefined;
        return dataId ? String(dataId) : undefined;
      } catch (err) {
        console.error("Failed to resolve group id for channel", err);
        // Fallback to channel data on error
        const dataId =
          (chan.data as any)?.groupId ||
          (chan.data as any)?.directId ||
          (chan.data as any)?._id ||
          undefined;
        return dataId ? String(dataId) : undefined;
      }
    },
    [primaryOrgId]
  );

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize chat
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (authStatus === "unauthenticated") {
          if (!cancelled) {
            setError("User not authenticated");
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
          [attributes.given_name, attributes.family_name]
            .filter(Boolean)
            .join(" ")
            .trim() || attributes.email;
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
          setError(err.message || "Failed to load chat");
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

  useEffect(() => {
    // Reset selection when switching audience scopes so stale channels do not persist
    const hasInitialized = scopeInitialized.current;
    scopeInitialized.current = true;
    if (!hasInitialized) return;

    setIsChannelSelected(false);
    setShowEmptyPlaceholder(true);
    onChannelSelect?.(null);
  }, [scope, onChannelSelect]);

  // Load org users for colleague/group creation flows
  useEffect(() => {
    const shouldLoadUsers =
      (scope === "colleagues" || scope === "groups") && primaryOrgId;
    if (!shouldLoadUsers) return;
    if (orgUsersLoaded || orgUsersLoading) return;

    setOrgUsersLoading(true);
    fetchOrgUsers(primaryOrgId!)
      .then((users) => {
        setOrgUsers(
          users
            .filter((u) => u?.id)
            .map((u) => ({
              id: u.id,
              userId: u.userId,
              practitionerId: u.practitionerId,
              name: u.name || u.email || "User",
              email: u.email,
              image: u.image,
              role: u.role,
            }))
        );
        setOrgUsersLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load org users for chat:", err);
      })
      .finally(() => setOrgUsersLoading(false));
  }, [scope, primaryOrgId, orgUsersLoaded, orgUsersLoading]);

  const openCreateGroupModal = useCallback(() => {
    setGroupModalMode("create");
    setGroupModalChannel(null);
    setGroupModalTitle("");
    setGroupModalPlaceholder("");
    setGroupModalMembers([]);
    setGroupModalBackendId(undefined);
    groupModalOwnerRef.current = client?.userID;
    setGroupModalSearch("");
    setGroupModalOpen(true);
  }, [client]);

  const openEditGroupModal = useCallback(
    async (chan: StreamChannel) => {
      setGroupModalMode("edit");
      setGroupModalChannel(chan);
      const placeholder =
        normalizeName((chan.data as any)?.title as string) ||
        normalizeName((chan.data as any)?.name as string) ||
        "";
      setGroupModalPlaceholder(placeholder);
      setGroupModalTitle("");
      const memberIds = chan.state?.members
        ? Object.keys(chan.state.members)
        : [];
      setGroupModalMembers(memberIds);
      // Find owner from members array (role: "owner") or fallback to created_by
      const membersArray = chan.state?.members ? Object.values(chan.state.members) : [];
      const ownerMember = membersArray.find((m: any) => m.role === "owner");
      groupModalOwnerRef.current =
        ownerMember?.user_id ||
        ownerMember?.user?.id ||
        (chan.data as any)?.createdBy ||
        (chan as any)?.created_by?.id;
      const backendId = await resolveGroupIdForChannel(chan);
      setGroupModalBackendId(backendId);
      setGroupModalSearch("");
      setGroupModalOpen(true);
    },
    [resolveGroupIdForChannel]
  );

  const previewComponent = useMemo(
    () => createPreviewComponent(handlePreviewSelect, client?.userID),
    [handlePreviewSelect, client?.userID]
  );

  const channelFilter = useCallback<NonNullable<ChannelListProps["channelRenderFilterFn"]>>(
    (channels) => {
      if (!scope) return channels;
      return channels.filter((chan) => {
        // Allow team/direct org channels regardless of missing chatCategory
        const type = (chan.type || "").toLowerCase();
        const resolvedScope = resolveChannelScope(chan, client?.userID);
        if (type === "team") {
          // team channels are colleague unless >2 members (then group)
          if (scope === "colleagues" && chan.state?.members && Object.keys(chan.state.members).length <= 2) {
            return true;
          }
          if (scope === "groups" && chan.state?.members && Object.keys(chan.state.members).length > 2) {
            return true;
          }
        }
        // fallback to standard category resolution
        return resolvedScope === scope;
      });
    },
    [scope, client?.userID]
  );

  const activateChannelById = useCallback(
    async (channelId: string) => {
      if (!client) return;
      const channel = client.channel("messaging", channelId);
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
        alert("No valid user identifier found for this teammate.");
        return;
      }
      setCreatingChat(true);

      // First, check if a direct channel already exists with this user
      // by querying backend sessions API and also Stream Chat channels
      try {
        // Check backend sessions for existing direct chat with this user
        const sessions = await listOrgChatSessions(primaryOrgId);
        const existingSession = sessions.find((s) => {
          if (s.type !== "ORG_DIRECT") return false;
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
            { id: { $eq: existingSession.channelId } } as Record<string, unknown>,
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
            type: "team",
            members: { $in: [client.userID!] },
          } as Record<string, unknown>,
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
          if (chatCategory && chatCategory !== "colleagues" && dataType !== "ORG_DIRECT") return false;

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
          if (otherUserName && user.name && otherUserName.toLowerCase() === user.name.toLowerCase()) {
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
        console.error("Error checking for existing channel:", err);
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
                chatCategory: "colleagues",
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
            const chan = client.channel("team", session.channelId);
            await applyMetadata(chan);
          }
          success = true;
          break;
        } catch (err) {
          console.error("Failed to start direct chat with id", otherUserId, err);
          // try next candidate if available
        }
      }
      if (!success) {
        alert("Unable to start chat. Please try again.");
      }
      setCreatingChat(false);
    },
    [primaryOrgId, client, activateChannelById, onChannelSelect]
  );

  const handleCreateGroupChat = useCallback(async () => {
    if (!primaryOrgId || !client) return;
    if (!groupTitle.trim() || groupMembers.length === 0) {
      alert("Add a group title and at least one member.");
      return;
    }
    setCreatingChat(true);
    try {
      const memberIds = Array.from(new Set([...groupMembers, client.userID!]));
      const session = await createOrgGroupChat({
        organisationId: primaryOrgId,
        title: groupTitle.trim(),
        memberIds,
        isPrivate: true,
      });
      const applyMetadata = async (chan: StreamChannel) => {
        await chan.update(
          {
            groupId: session._id,
            title: session.title || groupTitle.trim(),
            description: session.description,
            type: session.type,
            chatCategory: "group",
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
        const chan = client.channel("team", session.channelId);
        await applyMetadata(chan);
      }
      setGroupTitle("");
      setGroupMembers([]);
    } catch (err) {
      console.error("Failed to create group chat", err);
      alert("Unable to create group. Please try again.");
    } finally {
      setCreatingChat(false);
    }
  }, [primaryOrgId, client, groupTitle, groupMembers, activateChannelById]);

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
              chatCategory: "group",
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
          const chan = client.channel("team", session.channelId);
          await applyMetadata(chan);
        }
        setGroupModalOpen(false);
      } catch (err) {
        console.error("Failed to create group", err);
        alert("Unable to create group. Please try again.");
      } finally {
        setGroupModalBusy(false);
      }
    },
    [primaryOrgId, client, activateChannelById, onChannelSelect]
  );

  const handleModalUpdateTitle = useCallback(
    async (title: string) => {
      if (!groupModalBackendId) {
        console.error("Group ID not available. groupModalBackendId:", groupModalBackendId);
        alert("This group was created before the new system. Please create a new group to use this feature.");
        return;
      }
      setGroupModalBusy(true);
      try {
        await updateGroup(groupModalBackendId, { title });
        if (groupModalChannel) {
          await groupModalChannel.update({ title } as Record<string, unknown>, {});
        }
        setGroupModalPlaceholder(title);
        setGroupModalTitle("");
      } catch (err) {
        console.error("Failed to update group title", err);
        alert("Unable to update title. Please try again.");
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel]
  );

  const handleModalAddMember = useCallback(
    async (userId: string) => {
      if (!groupModalBackendId) {
        console.error("Group ID not available for add member. groupModalBackendId:", groupModalBackendId);
        alert("This group was created before the new system. Please create a new group to use this feature.");
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
        console.error("Failed to add member", err);
        alert("Unable to add member. Please try again.");
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel]
  );

  const handleModalRemoveMember = useCallback(
    async (userId: string) => {
      if (!groupModalBackendId) {
        console.error("Group ID not available for remove member. groupModalBackendId:", groupModalBackendId);
        alert("This group was created before the new system. Please create a new group to use this feature.");
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
        console.error("Failed to remove member", err);
        alert("Unable to remove member. Please try again.");
      } finally {
        setGroupModalBusy(false);
      }
    },
    [groupModalBackendId, groupModalChannel]
  );

  const handleModalDelete = useCallback(async () => {
    if (!groupModalBackendId) {
      alert("Group id not available.");
      return;
    }
    const confirmed = confirm("Delete this group? This cannot be undone.");
    if (!confirmed) return;
    setGroupModalBusy(true);
    try {
      await deleteGroup(groupModalBackendId);
      // Try to hide the channel from Stream Chat, but don't fail if it's already gone
      if (groupModalChannel) {
        try {
          await groupModalChannel.hide?.();
        } catch (hideErr) {
          // Channel might already be deleted on Stream Chat side, ignore this error
          console.log("Channel hide failed (likely already deleted):", hideErr);
        }
      }
      setGroupModalOpen(false);
      setIsChannelSelected(false);
      setShowEmptyPlaceholder(true);
      onChannelSelect?.(null);
      alert("Group deleted successfully");
    } catch (err) {
      console.error("Failed to delete group", err);
      alert("Unable to delete group. Please try again.");
    } finally {
      setGroupModalBusy(false);
    }
  }, [groupModalBackendId, groupModalChannel, onChannelSelect]);

  const groupModalContextValue = useMemo(
    () => ({
      openCreate: openCreateGroupModal,
      openEdit: openEditGroupModal,
    }),
    [openCreateGroupModal, openEditGroupModal]
  );

  // Extract conditional rendering logic
  const isAuthPending =
    authStatus === "checking" || authLoading || orgStatus === "loading";
  const isLoading = loading || (!client && (!error || isAuthPending));
  const hasError = error || (!client && !isAuthPending && !loading);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "360px",
        }}
      >
        <YosemiteLoader size={120} testId="chat-loader" />
      </div>
    );
  }

  if (hasError) {
    const errorMessage = error || "Unable to load chat";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "360px",
        }}
      >
        <p style={{ color: "#d32f2f" }}>{errorMessage}</p>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const filters = {
    type: { $in: ["messaging", "team"] },
    members: { $in: [client.userID!] },
  };

  const sort = [{ last_message_at: -1 as const }];

  const options = {
    state: true,
    watch: true,
    presence: true,
  };

  const renderAppointmentChannel = appointmentId ? (
    <Channel
      channel={client.channel("messaging", `appointment-${appointmentId}`)}
    >
      <AppointmentChannelWindow currentUserId={client.userID} />
      <Thread />
    </Channel>
  ) : null;

  const chatContent = appointmentId ? (
    renderAppointmentChannel
  ) : (
    <ChatLayout
      filters={filters}
      sort={sort}
      options={options}
      isMobile={isMobile}
      isChannelSelected={isChannelSelected}
      previewComponent={previewComponent}
      onBack={() => {
        setIsChannelSelected(false);
        setShowEmptyPlaceholder(true);
      }}
      currentUserId={client.userID}
      channelFilter={channelFilter}
      showEmpty={!appointmentId && showEmptyPlaceholder}
      channelListHeader={
        (scope === "colleagues" || scope === "groups") && (
          <div className="p-3 border-b border-grey-light flex flex-col gap-3">
            {scope === "colleagues" && (
              <div className="flex flex-col gap-2">
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
                <div
                  role="listbox"
                  tabIndex={-1}
                  className="max-h-40 overflow-y-auto flex flex-col gap-2"
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
                    orgUsers
                      .filter((u) =>
                        (u.name + (u.email ?? "") + (u.role ?? ""))
                          .toLowerCase()
                          .includes(directSearch.toLowerCase())
                      )
                      .map((u) => ({
                        ...u,
                        keyId: u.userId ?? u.id,
                      }))
                      .filter((u) => u.keyId !== client.userID)
                      .slice(0, 8)
                      .map((u) => (
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
                          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl! border border-grey-light bg-white cursor-pointer text-left hover:border-input-border-active transition-all duration-200 overflow-hidden"
                        >
                          <div className="w-8 h-8 rounded-full bg-card-hover flex items-center justify-center">
                            <span className="font-satoshi text-black-text text-sm font-medium">
                              {(u.name || u.email || "?")
                                .split(" ")
                                .map((p) => p[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-body-4 text-text-primary font-medium">{u.name}</span>
                            {u.email && (
                              <span className="text-caption-2 text-text-secondary">{u.email}</span>
                            )}
                          </div>
                        </button>
                      ))}
                  {!orgUsersLoading &&
                    searchFocused &&
                    directSearch.trim().length > 0 &&
                    orgUsers
                      .map((u) => ({
                        ...u,
                        keyId: u.userId ?? u.id,
                      }))
                      .filter((u) =>
                        (u.name + (u.email ?? "") + (u.role ?? ""))
                          .toLowerCase()
                          .includes(directSearch.toLowerCase())
                      ).length === 0 && (
                      <span className="text-caption-1 text-text-secondary">
                        No teammates found. Adjust your search.
                      </span>
                    )}
                </div>
              </div>
            )}

            {scope === "groups" && (
              <button
                type="button"
                onClick={openCreateGroupModal}
                className={`${primaryActionClasses} w-fit cursor-pointer`}
              >
                Create Group
              </button>
            )}
          </div>
        )
      }
    />
  );

  return (
    <GroupModalContext.Provider value={groupModalContextValue}>
      <div className={className}>
        <Chat
          key={appointmentId ? `appointment-${appointmentId}` : `scope-${scope}`}
          client={client}
          theme="str-chat__theme-light"
        >
          {chatContent}
        </Chat>
        <GroupModal
          open={groupModalOpen}
          mode={groupModalMode}
          title={groupModalTitle}
          placeholder={groupModalPlaceholder}
          members={groupModalMembers}
          backendId={groupModalBackendId}
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
      </div>
    </GroupModalContext.Provider>
  );
};

const ProtectedChatContainer = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <ChatContainer />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedChatContainer;
