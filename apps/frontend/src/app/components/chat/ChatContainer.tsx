"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [closingSession, setClosingSession] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersSearch, setMembersSearch] = useState("");
  const [orgUsersForModal, setOrgUsersForModal] = useState<OrgUserOption[]>([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [groupDescDraft, setGroupDescDraft] = useState("");
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [updatingMembers, setUpdatingMembers] = useState(false);
  const [groupBackendId, setGroupBackendId] = useState<string | undefined>();
  const addMemberInputRef = useRef<HTMLInputElement | null>(null);
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
  const organisationId = (channel?.data as any)?.organisationId as string | undefined;
  const createdById =
    (channel?.data as any)?.createdBy ||
    (channel?.data as any)?.created_by_id ||
    (channel as any)?.created_by?.id;
  const isCreator = createdById && currentUserId && createdById === currentUserId;

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

  useEffect(() => {
    if (!showMembersModal || !isGroupChat) return;
    const dataGroupId =
      (channel?.data as any)?.groupId ||
      (channel?.data as any)?._id;
    if (dataGroupId) {
      setGroupBackendId(String(dataGroupId));
    } else if (organisationId && channelId) {
      listOrgChatSessions(organisationId)
        .then((sessions) => {
          const matched = sessions.find((s) => s.channelId === channelId);
          if (matched?._id) {
            setGroupBackendId(matched._id);
            (channel as StreamChannel | undefined)?.update(
              {
                groupId: matched._id,
                title: matched.title,
                description: matched.description,
                chatCategory: "group",
                organisationId: matched.organisationId,
                createdBy: matched.createdBy,
              },
              {}
            );
          }
        })
        .catch((err) =>
          console.error("Failed to resolve backend group id for channel", err)
        );
    }

    setGroupTitleDraft(normalizeName((channel?.data as any)?.title as string));
    setGroupDescDraft(
      normalizeName((channel?.data as any)?.description as string) ||
        normalizeName((channel?.data as any)?.desc as string)
    );
    if (!organisationId) return;
    setOrgUsersLoading(true);
    fetchOrgUsers(organisationId)
      .then((users) => {
        setOrgUsersForModal(
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
      })
      .catch((err) => console.error("Failed to load org users for modal", err))
      .finally(() => setOrgUsersLoading(false));
  }, [showMembersModal, isGroupChat, organisationId, channelId, channel]);

  const membersArray = channel?.state?.members
    ? Object.values(channel.state.members)
    : [];
  const memberOptions = membersArray.map((m) => ({
    id: m.user?.id || m.user_id,
    name: normalizeName(m.user?.name || m.user_id),
    role: (m as any)?.role,
  }));
  const channelId = channel?.id;
  const backendGroupId = (groupBackendId ||
    (channel?.data as any)?.groupId ||
    (channel?.data as any)?._id) as string | undefined;

  const handleUpdateGroupMeta = async () => {
    if (!isCreator || !backendGroupId) return;
    setUpdatingGroup(true);
    try {
      await updateGroup(backendGroupId, {
        title: groupTitleDraft.trim() || undefined,
        description: groupDescDraft.trim() || undefined,
      });
      await (channel as StreamChannel | undefined)?.update({
        title: groupTitleDraft.trim() || undefined,
        description: groupDescDraft.trim() || undefined,
      });
      alert("Group updated");
    } catch (err) {
      console.error("Failed to update group", err);
      alert("Unable to update group right now.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleAddMember = async (userId?: string) => {
    if (!isCreator || !backendGroupId || !userId) return;
    setUpdatingMembers(true);
    try {
      await addGroupMembers(backendGroupId, [userId]);
      await (channel as StreamChannel | undefined)?.watch();
      alert("Member added");
    } catch (err) {
      console.error("Failed to add member", err);
      alert("Unable to add member right now.");
    } finally {
      setUpdatingMembers(false);
    }
  };

  const handleRemoveMember = async (userId?: string) => {
    if (!isCreator || !backendGroupId || !userId) return;
    setUpdatingMembers(true);
    try {
      await removeGroupMembers(backendGroupId, [userId]);
      await (channel as StreamChannel | undefined)?.watch();
      alert("Member removed");
    } catch (err) {
      console.error("Failed to remove member", err);
      alert("Unable to remove member right now.");
    } finally {
      setUpdatingMembers(false);
    }
  };

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
              padding: '8px 12px',
              backgroundColor: '#eef2ff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setShowMembersModal(true)}
          >
            Members ({memberOptions.length})
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
        {isGroupChat && (
          <button
            type="button"
            className="font-satoshi"
            style={{
              padding: '8px 16px',
              backgroundColor: '#fff0f0',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={async () => {
              if (!isCreator || !backendGroupId) {
                alert("Group id not available. Please reopen the chat and try again.");
                return;
              }
              const confirmDelete = confirm("Delete this group? This cannot be undone.");
              if (!confirmDelete) return;
              try {
                await deleteGroup(backendGroupId);
                alert("Group deleted");
                setShowMembersModal(false);
                // Hide channel locally
                await (channel as StreamChannel | undefined)?.hide?.();
              } catch (err) {
                console.error("Failed to delete group", err);
                alert("Unable to delete group right now.");
              }
            }}
          >
            Delete group
          </button>
        )}
      </div>
      {showMembersModal && (
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
          onClick={() => setShowMembersModal(false)}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontFamily: "var(--font-satoshi)", fontWeight: 700, fontSize: "16px" }}>
                Group members
              </div>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {isCreator && (
                <>
                  <input
                    type="text"
                    placeholder="Group title"
                    value={groupTitleDraft}
                    onChange={(e) => setGroupTitleDraft(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #d1d5db",
                      fontFamily: "var(--font-satoshi)",
                      fontSize: "14px",
                    }}
                  />
                  <textarea
                    placeholder="Group description"
                    value={groupDescDraft}
                    onChange={(e) => setGroupDescDraft(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #d1d5db",
                      fontFamily: "var(--font-satoshi)",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleUpdateGroupMeta}
                    disabled={updatingGroup}
                    style={{
                      padding: "8px 12px",
                      alignSelf: "flex-start",
                      background: "#111827",
                      color: "#fff",
                      borderRadius: "10px",
                      border: "1px solid #111827",
                      fontWeight: 600,
                      cursor: updatingGroup ? "not-allowed" : "pointer",
                    }}
                  >
                    {updatingGroup ? "Saving..." : "Save changes"}
                  </button>
                </>
              )}
              {memberOptions.map((m) => (
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
                  {m.id === createdById && (
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Owner</span>
                  )}
                  {isCreator && m.id !== createdById && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={updatingMembers}
                      style={{
                        padding: "4px 8px",
                        background: "#fff0f0",
                        color: "#b91c1c",
                        border: "1px solid #fecdd3",
                        borderRadius: "8px",
                        cursor: updatingMembers ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isCreator && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "13px", color: "#111827", fontWeight: 600, fontFamily: "var(--font-satoshi)" }}>
                  Add members
                </div>
                <input
                  type="text"
                  placeholder="Search teammates"
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  ref={addMemberInputRef}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    fontFamily: "var(--font-satoshi)",
                    fontSize: "14px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => addMemberInputRef.current?.focus()}
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 10px",
                    background: "#eef2ff",
                    color: "#111827",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontFamily: "var(--font-satoshi)",
                  }}
                >
                  Add member
                </button>
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {orgUsersLoading && (
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Loading teammates…</span>
                  )}
                  {!orgUsersLoading &&
                    orgUsersForModal
                      .map((u) => ({ ...u, keyId: u.userId ?? u.id }))
                      .filter((u) => u.keyId)
                      .filter(
                        (u) =>
                          !memberOptions.some((m) => m.id === u.keyId) &&
                          (u.name + (u.email ?? "") + (u.role ?? ""))
                            .toLowerCase()
                            .includes(membersSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((u) => (
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
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>{u.email}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMember(u.keyId!)}
                            style={{
                              padding: "6px 10px",
                              background: "#111827",
                              color: "#fff",
                              borderRadius: "8px",
                              border: "1px solid #111827",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                </div>
              </div>
            )}
            {!isCreator && isGroupChat && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px", fontFamily: "var(--font-satoshi)" }}>
                Only the group creator can add members.
              </div>
            )}
          </div>
        </div>
      )}
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
  const [groupSearchFocused, setGroupSearchFocused] = useState(false);
  const [directListHover, setDirectListHover] = useState(false);
  const [groupListHover, setGroupListHover] = useState(false);
  const [groupListPinned, setGroupListPinned] = useState(false);
  const [directListPinned, setDirectListPinned] = useState(false);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [groupModalSearch, setGroupModalSearch] = useState("");
  const directAreaRef = useRef<HTMLDivElement | null>(null);
  const groupAreaRef = useRef<HTMLDivElement | null>(null);

  const directBlurTimeout = useRef<NodeJS.Timeout | null>(null);
  const groupBlurTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setOrgUsersLoaded(false);
    setOrgUsers([]);
  }, [primaryOrgId]);

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
              },
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
    [primaryOrgId, client, activateChannelById]
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
          },
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
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Group title"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    fontFamily: "var(--font-satoshi)",
                    fontSize: "14px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search and add members"
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  onFocus={() => {
                    if (groupBlurTimeout.current) {
                      clearTimeout(groupBlurTimeout.current);
                      groupBlurTimeout.current = null;
                    }
                    setGroupSearchFocused(true);
                    setGroupListPinned(true);
                  }}
                  onBlur={() => {
                    groupBlurTimeout.current = setTimeout(() => {
                      if (!groupListHover && !groupListPinned) {
                        setGroupSearchFocused(false);
                      }
                    }, 120);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    fontFamily: "var(--font-satoshi)",
                    fontSize: "14px",
                  }}
                />
                {groupSearchFocused && (
                  <div
                    style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", background: "#fff" }}
                    onMouseEnter={() => setGroupListHover(true)}
                    onMouseLeave={() => {
                      setGroupListHover(false);
                      if (!groupSearchFocused && !groupListPinned) {
                        setGroupSearchFocused(false);
                      }
                    }}
                    onClick={() => setGroupListPinned(true)}
                  >
                    {orgUsersLoading && (
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Loading teammates…
                      </span>
                    )}
                    {!orgUsersLoading &&
                      (groupSearchFocused || groupListHover || groupListPinned) &&
                      orgUsers
                        .map((u) => ({
                          ...u,
                          keyId: u.userId ?? u.id,
                        }))
                        .filter((u) =>
                          (u.name + (u.email ?? "") + (u.role ?? ""))
                            .toLowerCase()
                            .includes(directSearch.toLowerCase())
                        )
                        .filter((u) => u.keyId !== client.userID)
                        .map((u) => {
                          const checked = groupMembers.includes(u.keyId);
                          return (
                            <label
                              key={u.keyId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: "pointer",
                                fontFamily: "var(--font-satoshi)",
                                fontSize: "13px",
                                padding: "6px 4px",
                                borderRadius: "8px",
                                background: checked ? "#eef2ff" : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setGroupMembers((prev) =>
                                    e.target.checked
                                      ? [...prev, u.keyId]
                                      : prev.filter((id) => id !== u.keyId)
                                  );
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                              {u.role && (
                                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                                  {u.role}
                                </span>
                              )}
                            </label>
                          );
                        })}
                    {!orgUsersLoading &&
                      (groupSearchFocused || groupListHover || groupListPinned) &&
                      directSearch.trim().length > 0 &&
                      orgUsers.filter((u) =>
                        (u.name + (u.email ?? "") + (u.role ?? ""))
                          .toLowerCase()
                          .includes(directSearch.toLowerCase())
                      ).length === 0 && (
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          No teammates found for this search.
                        </span>
                      )}
                  </div>
                )}
                {!!groupMembers.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {groupMembers.map((m) => {
                      const user = orgUsers.find(
                        (u) => (u.userId ?? u.id) === m
                      );
                      return (
                        <span
                          key={m}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            background: "#eef2ff",
                            color: "#111827",
                            fontSize: "12px",
                            fontFamily: "var(--font-satoshi)",
                          }}
                        >
                          {user?.name || m}
                          <button
                            type="button"
                            onClick={() =>
                              setGroupMembers((prev) =>
                                prev.filter((id) => id !== m)
                              )
                            }
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              color: "#6b7280",
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCreateGroupChat}
                  disabled={creatingChat}
                  style={{
                    padding: "10px 12px",
                    background: "#111827",
                    color: "#fff",
                    borderRadius: "10px",
                    border: "1px solid #111827",
                    fontFamily: "var(--font-satoshi)",
                    fontWeight: 600,
                    cursor: creatingChat ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingChat ? "Creating..." : "Create group"}
                </button>
              </div>
            )}
          </div>
        )
      }
    />
  );

  return (
    <div className={className}>
      <Chat
        key={appointmentId ? `appointment-${appointmentId}` : `scope-${scope}`}
        client={client}
        theme="str-chat__theme-light"
      >
        {chatContent}
      </Chat>
    </div>
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
