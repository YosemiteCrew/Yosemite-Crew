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
  return value
    // remove templated space markers like {' '}
    .replace(/\{[^}]*\}/g, " ")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
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
  if (!open) return null;

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
      // In create mode, just update local state
      onMembersChange([...members, userId]);
    } else {
      // In edit mode, call API
      onAddMember(userId);
    }
  };

  const handleRemoveMemberClick = (userId: string) => {
    if (mode === "create") {
      // In create mode, just update local state
      onMembersChange(members.filter((id) => id !== userId));
    } else {
      // In edit mode, call API
      onRemoveMember(userId);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "16px",
          width: "min(420px, 95vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 45px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-satoshi)",
              fontWeight: 700,
              fontSize: "16px",
            }}
          >
            {mode === "create" ? "Create group" : "Group members"}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Title input */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {(mode === "create" || isCreator) && (
            <>
              <input
                type="text"
                placeholder={mode === "edit" ? placeholder || "Group title" : "Group title"}
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                  fontFamily: "var(--font-satoshi)",
                  fontSize: "14px",
                }}
              />
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={busy || !title.trim()}
                  className="font-satoshi"
                  style={{
                    padding: "12px 32px",
                    alignSelf: "flex-start",
                    background: "var(--color-text-primary)",
                    color: "#fff",
                    borderRadius: "16px",
                    border: "none",
                    fontWeight: 500,
                    fontSize: "18px",
                    lineHeight: "26px",
                    cursor: busy || !title.trim() ? "not-allowed" : "pointer",
                    opacity: busy || !title.trim() ? 0.6 : 1,
                    transition: "all 300ms ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    if (!busy && title.trim()) e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {busy ? "Saving..." : "Save title"}
                </button>
              )}
            </>
          )}

          {/* Members list - show in both create and edit mode */}
          {memberDetails.length > 0 &&
            memberDetails.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  fontFamily: "var(--font-satoshi)",
                  fontSize: "13px",
                }}
              >
                <span>{m.name}</span>
                {mode === "edit" && m.id === ownerId && (
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Owner</span>
                )}
                {isCreator && m.id !== ownerId && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMemberClick(m.id)}
                    disabled={busy}
                    className="font-satoshi"
                    style={{
                      padding: "8px 20px",
                      background: "var(--color-danger-600)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: 500,
                      opacity: busy ? 0.6 : 1,
                      transition: "all 300ms ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      if (!busy) e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
        </div>

        {/* Add members section */}
        {(mode === "create" || isCreator) && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#111827",
                fontWeight: 600,
                fontFamily: "var(--font-satoshi)",
              }}
            >
              {mode === "create" ? "Add members" : "Add more members"}
            </div>
            <input
              type="text"
              placeholder="Search teammates"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                fontFamily: "var(--font-satoshi)",
                fontSize: "14px",
              }}
            />
            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {orgUsersLoading && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Loading teammates…
                </span>
              )}
              {!orgUsersLoading && availableUsers.length === 0 && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {orgUsers.length === 0
                    ? "No teammates available. Please wait..."
                    : search.trim()
                      ? "No teammates match your search."
                      : "All teammates have been added."}
                </span>
              )}
              {!orgUsersLoading &&
                availableUsers.map((u) => (
                  <div
                    key={u.keyId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "10px",
                      fontFamily: "var(--font-satoshi)",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{u.name}</span>
                      {u.email && (
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          {u.email}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddMemberClick(u.keyId!)}
                      disabled={busy}
                      className="font-satoshi"
                      style={{
                        padding: "8px 20px",
                        background: "var(--color-text-primary)",
                        color: "#fff",
                        borderRadius: "12px",
                        border: "none",
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 500,
                        fontSize: "14px",
                        opacity: busy ? 0.6 : 1,
                        transition: "all 300ms ease-in-out",
                      }}
                      onMouseEnter={(e) => {
                        if (!busy) e.currentTarget.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
            justifyContent: "flex-end",
          }}
        >
          {mode === "create" && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="font-satoshi"
              style={{
                padding: "12px 32px",
                background: "var(--color-text-primary)",
                color: "#fff",
                borderRadius: "16px",
                border: "none",
                fontWeight: 500,
                fontSize: "18px",
                lineHeight: "26px",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                transition: "all 300ms ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (!busy) e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {busy ? "Creating..." : "Create group"}
            </button>
          )}
          {mode === "edit" && isCreator && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="font-satoshi"
              style={{
                padding: "12px 32px",
                background: "var(--color-danger-600)",
                color: "#fff",
                borderRadius: "16px",
                border: "none",
                fontWeight: 500,
                fontSize: "18px",
                lineHeight: "26px",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                transition: "all 300ms ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (!busy) e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {busy ? "Deleting..." : "Delete group"}
            </button>
          )}
        </div>

        {!isCreator && mode === "edit" && (
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "8px",
              fontFamily: "var(--font-satoshi)",
            }}
          >
            Only the group creator can modify this group.
          </div>
        )}
      </div>
    </div>
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
    <div
      className="chat-header-bar"
    >
      <ChannelHeader title={title} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isGroupChat && (
          <button
            type="button"
            className="font-satoshi"
            style={{
              padding: '12px 32px',
              backgroundColor: 'var(--color-text-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontWeight: 500,
              lineHeight: '26px',
              cursor: 'pointer',
              transition: 'all 300ms ease-in-out',
            }}
            onClick={() => groupModalCtx.openEdit?.(channel as StreamChannel)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Group Info
          </button>
        )}
        {isClientChat && hasSessionClosed && (
          <div style={{
            padding: '6px 12px',
            backgroundColor: 'var(--grey-light)',
            border: '1px solid var(--grey-border)',
            borderRadius: '8px',
          }}>
            <p className="font-satoshi" style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--grey-text)',
              margin: 0,
            }}>
              Session Closed
            </p>
          </div>
        )}
        {isClientChat && !hasSessionClosed && (
          <button
            onClick={handleCloseSession}
            disabled={closingSession}
            className="font-satoshi"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--black-bg)',
              color: 'var(--white-text)',
              border: '1px solid var(--black-bg)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: closingSession ? 'not-allowed' : 'pointer',
              opacity: closingSession ? 0.6 : 1,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!closingSession) {
                e.currentTarget.style.backgroundColor = 'var(--black-hover)';
                e.currentTarget.style.boxShadow = '0 0 16px 0 rgba(0, 0, 0, 0.16)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--black-bg)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {closingSession ? 'Closing...' : 'Close Session'}
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

  return (
    <div
      role="button"
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
          <div
            style={{
              padding: "12px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {scope === "colleagues" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Search teammate to chat"
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
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    fontFamily: "var(--font-satoshi)",
                    fontSize: "14px",
                  }}
                />
                <div
                  style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}
                  onMouseEnter={() => setDirectListHover(true)}
                  onMouseLeave={() => {
                    setDirectListHover(false);
                    if (!searchFocused) setSearchFocused(false);
                  }}
                >
                  {orgUsersLoading && (
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
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
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 10px",
                            borderRadius: "10px",
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "var(--font-satoshi)",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#eef2ff",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#4b5563",
                            }}
                          >
                            {(u.name || u.email || "?")
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 600 }}>{u.name}</span>
                            {u.email && (
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>{u.email}</span>
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
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        No teammates found. Adjust your search.
                      </span>
                    )}
                </div>
              </div>
            )}

            {scope === "groups" && (
              <button
                type="button"
                className="font-satoshi"
                onClick={openCreateGroupModal}
                style={{
                  padding: "12px 32px",
                  background: "var(--color-text-primary)",
                  color: "#fff",
                  borderRadius: "16px",
                  border: "none",
                  fontSize: "18px",
                  fontWeight: 500,
                  lineHeight: "26px",
                  cursor: "pointer",
                  width: "fit-content",
                  transition: "all 300ms ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                Create group
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
