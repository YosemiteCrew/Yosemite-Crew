'use client';

/**
 * Create / edit group-conversation drawer for the chat. Presentational: all data
 * and actions are passed in as props by ChatContainer, so it renders the same in
 * create mode (title + member picker) and edit mode (owner badge, save title,
 * add/remove members, delete, and a non-creator notice). Extracted from
 * ChatContainer so the create/edit logic is independently testable.
 */

import { type FC } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import { MdDeleteForever } from 'react-icons/md';
import { IoIosAddCircleOutline } from 'react-icons/io';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { Badge } from '@/app/ui';
import Modal from '@/app/ui/overlays/Modal';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Close from '@/app/ui/primitives/Icons/Close';
import { ChatAvatar } from './ChatAvatar';

export type OrgUserOption = {
  id: string;
  userId?: string;
  practitionerId?: string;
  name: string;
  email?: string;
  image?: string;
  role?: string;
};

export interface GroupModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  title: string;
  placeholder: string;
  members: string[];
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

/** Resolves whether the current user may modify the group (creator in edit mode). */
function resolveIsCreator(
  mode: 'create' | 'edit',
  ownerId: string | undefined,
  currentUserId: string | undefined,
  orgUsers: OrgUserOption[]
): boolean {
  if (mode === 'create') return true;
  if (!ownerId || !currentUserId) return false;
  if (ownerId === currentUserId) return true;
  return orgUsers.some(
    (u) =>
      (u.userId === currentUserId ||
        u.id === currentUserId ||
        u.practitionerId === currentUserId) &&
      (u.userId === ownerId || u.id === ownerId || u.practitionerId === ownerId)
  );
}

export const GroupModal: FC<GroupModalProps> = ({
  open,
  mode,
  title,
  placeholder,
  members,
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
  const handleClose = () => {
    onClose();
  };

  const isCreator = resolveIsCreator(mode, ownerId, currentUserId, orgUsers);

  const memberDetails = members.map((id) => {
    const user = orgUsers.find((u) => u.userId === id || u.id === id || u.practitionerId === id);
    const channelMember = channel?.state?.members?.[id];
    return {
      id,
      name: user?.name || channelMember?.user?.name || id,
      email: user?.email,
    };
  });

  type OrgUserOptionWithKey = OrgUserOption & { keyId: string };
  const searchLower = search.toLowerCase();
  const membersSet = new Set(members);
  const availableUsers: OrgUserOptionWithKey[] = [];
  for (const u of orgUsers) {
    const keyId = u.userId ?? u.id;
    if (
      !keyId ||
      keyId === currentUserId ||
      membersSet.has(keyId) ||
      membersSet.has(u.id) ||
      !(u.name + (u.email ?? '') + (u.role ?? '')).toLowerCase().includes(searchLower)
    )
      continue;
    availableUsers.push({ ...u, keyId });
    if (availableUsers.length === 10) break;
  }

  const handleCreate = async () => {
    if (!title.trim() || members.length === 0) return;
    await onCreate(title.trim(), members);
  };

  const handleSaveTitle = async () => {
    if (!title.trim()) return;
    await onUpdateTitle(title.trim());
  };

  const handleAddMemberClick = (userId: string) => {
    if (mode === 'create') {
      onMembersChange([...members, userId]);
    } else {
      onAddMember(userId);
    }
  };

  const handleRemoveMemberClick = (userId: string) => {
    if (mode === 'create') {
      onMembersChange(members.filter((id) => id !== userId));
    } else {
      onRemoveMember(userId);
    }
  };

  const emptyTeammatesMessage = () => {
    if (orgUsers.length === 0) return 'No teammates available. Please wait...';
    if (search.trim()) return 'No teammates match your search.';
    return 'All teammates have been added.';
  };

  return (
    <Modal showModal={open} setShowModal={() => undefined} onClose={handleClose}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <div className="text-body-1 text-text-primary">
            {mode === 'create' ? 'Create group' : 'Group info'}
          </div>
          <Close onClick={handleClose} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden gap-6">
          <div className="flex-1 overflow-y-auto flex flex-col gap-6 pt-1 scrollbar-hidden pr-1 px-3">
            {(mode === 'create' || isCreator) && (
              <div className="flex flex-col gap-3">
                <FormInput
                  intype="text"
                  inname="groupTitle"
                  inlabel={mode === 'edit' && placeholder ? placeholder : 'Group Title'}
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                />
                {mode === 'edit' && (
                  <Primary
                    text={busy ? 'Saving...' : 'Save Title'}
                    onClick={handleSaveTitle}
                    isDisabled={busy || !title.trim()}
                    className="self-start"
                  />
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
                      className="flex justify-between items-center p-3 border border-card-border rounded-2xl bg-chat-surface"
                    >
                      <div className="flex items-center gap-3">
                        <ChatAvatar name={m.name} size="sm" />
                        <div className="flex flex-col">
                          <span className="text-body-4 text-text-primary">{m.name}</span>
                          {m.email && (
                            <span className="text-caption-2 text-text-secondary">{m.email}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mode === 'edit' && m.id === ownerId && <Badge tone="brand">Owner</Badge>}
                        {isCreator && m.id !== ownerId && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberClick(m.id)}
                            disabled={busy}
                            className={`p-1.5 rounded-lg hover:bg-chat-surface-soft transition-all duration-200 ${
                              busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            title="Remove member"
                          >
                            <MdDeleteForever size={20} color="var(--color-danger-600)" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(mode === 'create' || isCreator) && (
              <div className="flex flex-col gap-3">
                <div className="text-body-2 text-text-primary font-medium">
                  {mode === 'create' ? 'Add members' : 'Add more members'}
                </div>

                <FormInput
                  intype="text"
                  inname="searchMembers"
                  inlabel="Search teammates"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                />

                <div className="min-h-30 max-h-75 overflow-y-auto flex flex-col gap-2 pr-1">
                  {orgUsersLoading && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-caption-1 text-text-secondary">Loading teammates…</span>
                    </div>
                  )}
                  {!orgUsersLoading && availableUsers.length === 0 && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-caption-1 text-text-secondary">
                        {emptyTeammatesMessage()}
                      </span>
                    </div>
                  )}
                  {!orgUsersLoading &&
                    availableUsers.map((u) => (
                      <div
                        key={u.keyId}
                        className="flex justify-between items-center p-3 border border-card-border rounded-2xl bg-chat-surface hover:border-input-border-active transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <ChatAvatar name={u.name || u.email || '?'} size="sm" />
                          <div className="flex flex-col">
                            <span className="text-body-4 text-text-primary">{u.name}</span>
                            {u.email && (
                              <span className="text-caption-2 text-text-secondary">{u.email}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMemberClick(u.keyId)}
                          disabled={busy}
                          className={`p-1.5 rounded-lg hover:bg-chat-surface-soft transition-all duration-200 ${
                            busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title="Add member"
                        >
                          <IoIosAddCircleOutline size={24} color="var(--color-neutral-900)" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {!isCreator && mode === 'edit' && (
              <div className="rounded-2xl border border-card-border bg-chat-surface px-4 py-3">
                <span className="text-caption-1 text-text-secondary">
                  Only the group creator can modify this group.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 pb-1 px-3">
            {mode === 'create' && (
              <Primary
                text={busy ? 'Creating...' : 'Create Group'}
                onClick={handleCreate}
                isDisabled={busy || !title.trim() || members.length === 0}
              />
            )}
            {mode === 'edit' && isCreator && (
              <Delete
                text={busy ? 'Deleting...' : 'Delete Group'}
                onClick={onDelete}
                isDisabled={busy}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GroupModal;
