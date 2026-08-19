import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { GroupModal, type OrgUserOption } from './GroupModal';

const ORG_USERS: OrgUserOption[] = [
  {
    id: 'u-1',
    userId: 'u-1',
    name: 'Ruth Baumann',
    email: 'ruth@clinic.test',
    role: 'Veterinarian',
  },
  { id: 'u-2', userId: 'u-2', name: 'Ana Okafor', email: 'ana@clinic.test', role: 'Technician' },
  {
    id: 'u-3',
    userId: 'u-3',
    name: 'Tomás Ferreira',
    email: 'tomas@clinic.test',
    role: 'Receptionist',
  },
  {
    id: 'u-4',
    userId: 'u-4',
    name: 'Priya Raman',
    email: 'priya@clinic.test',
    role: 'Veterinarian',
  },
  { id: 'u-5', userId: 'u-5', name: 'Milo Jansen', email: 'milo@clinic.test', role: 'Assistant' },
  { id: 'me', userId: 'me', name: 'Dr Lena Hartmann', email: 'lena@clinic.test', role: 'Owner' },
];

/**
 * `title`, `search` and `members` are controlled by ChatContainer in the app, so the
 * picker only moves if something holds them. The harness owns those three and forwards
 * every action to the spies as well, which is what makes add/remove reachable from a
 * `play` rather than only from a live Stream channel.
 */
const Harness = ({
  open,
  mode,
  placeholder,
  initialTitle,
  initialMembers,
  ownerId,
  currentUserId,
  busy,
  orgUsers,
  orgUsersLoading,
  onClose,
  onCreate,
  onUpdateTitle,
  onAddMember,
  onRemoveMember,
  onDelete,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  placeholder: string;
  initialTitle: string;
  initialMembers: string[];
  ownerId?: string;
  currentUserId?: string;
  busy: boolean;
  orgUsers: OrgUserOption[];
  orgUsersLoading: boolean;
  onClose: () => void;
  onCreate: (title: string, memberIds: string[]) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState(initialMembers);

  return (
    <div className="min-h-[640px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Conversation list behind the drawer, so the scrim tint and blur are visible.
      </p>
      <GroupModal
        open={open}
        mode={mode}
        title={title}
        placeholder={placeholder}
        members={members}
        ownerId={ownerId}
        currentUserId={currentUserId}
        search={search}
        busy={busy}
        orgUsers={orgUsers}
        orgUsersLoading={orgUsersLoading}
        channel={null}
        onClose={onClose}
        onTitleChange={setTitle}
        onSearchChange={setSearch}
        onMembersChange={setMembers}
        onCreate={onCreate}
        onUpdateTitle={onUpdateTitle}
        // Edit mode routes through the server callbacks rather than onMembersChange,
        // so the harness mirrors the optimistic update ChatContainer applies after them.
        onAddMember={async (userId) => {
          setMembers((prev) => [...prev, userId]);
          await onAddMember(userId);
        }}
        onRemoveMember={async (userId) => {
          setMembers((prev) => prev.filter((id) => id !== userId));
          await onRemoveMember(userId);
        }}
        onDelete={onDelete}
      />
    </div>
  );
};

/** The drawer portals to document.body, so nothing in it is inside `canvasElement`. */
const panel = () => within(document.body).getByRole('dialog');

const meta = {
  title: 'Chat/GroupModal',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The create/edit drawer for a group conversation. It is `createPortal`ed to ' +
          '`document.body` behind a single `open` prop and had no story at all, so none of it had ' +
          'ever been drawn - not the member rows, not the picker, not the footer.\n\n' +
          'The reason that matters is that this one component renders four materially different ' +
          'trees off `mode` and `resolveIsCreator`, and three of them are unreachable without ' +
          'state a snapshot cannot supply. In create mode there is a title field, a picker and a ' +
          'stretched "Create Group" primary. In edit mode as the creator the title field gains its ' +
          'own "Save Title" button, member rows gain an Owner pill and inline Remove links, and the ' +
          'footer swaps the primary for a full-width `Delete` - the only destructive footer in the ' +
          'chat feature. In edit mode as anyone else the title field, the picker and the whole ' +
          'footer are removed and replaced by a single notice card; nothing is merely disabled, so ' +
          'a regression there silently hands out edit affordances rather than dimming them.\n\n' +
          'The picker is the part with real logic behind it. `availableUsers` drops the current ' +
          'user, drops anyone already a member, filters on name + email + role concatenated, and ' +
          '**breaks at ten** - so a large clinic never renders an eleventh row no matter what is ' +
          'typed. Its empty state has three different sentences depending on why it is empty, and ' +
          'only one of them ("All teammates have been added") is reachable by interacting.\n\n' +
          'The stories below assert the panel holds its rows rather than that `open` flipped: an ' +
          'empty drawer satisfies the dialog role just as well as a populated one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    mode: 'create',
    placeholder: '',
    initialTitle: '',
    initialMembers: [],
    currentUserId: 'me',
    busy: false,
    orgUsers: ORG_USERS,
    orgUsersLoading: false,
    onClose: fn(),
    onCreate: fn(),
    onUpdateTitle: fn(),
    onAddMember: fn(),
    onRemoveMember: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateEmpty: Story = {
  name: 'Create (nothing chosen yet)',
  play: async () => {
    const dialog = within(panel());
    await expect(dialog.getByRole('heading', { name: 'Create group' })).toBeInTheDocument();
    // The picker must actually be populated - five teammates, with `me` filtered out.
    const addButtons = dialog.getAllByRole('button', { name: /to group$/ });
    await expect(addButtons).toHaveLength(5);
    await expect(dialog.getByText('Members (0)')).toBeInTheDocument();
    // Create stays blocked until there is both a title and at least one member.
    await expect(dialog.getByRole('button', { name: 'Create Group' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens from the "+" in the conversation list: an empty title, a zero ' +
          'member count, and the whole roster in the picker minus the person creating the group.',
      },
    },
  },
};

export const CreateWithMembers: Story = {
  name: 'Create (adding members)',
  play: async () => {
    const dialog = within(panel());
    await userEvent.type(dialog.getByRole('textbox', { name: 'Group Title' }), 'Surgery team');
    await userEvent.click(dialog.getByRole('button', { name: 'Add Ruth Baumann to group' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Add Ana Okafor to group' }));

    // Chosen teammates move out of the picker and into the member list.
    await expect(dialog.getByText('Members (2)')).toBeInTheDocument();
    await expect(dialog.getAllByRole('button', { name: /to group$/ })).toHaveLength(3);
    // Create mode has no owner, so every member row offers a Remove link.
    await expect(dialog.getAllByRole('button', { name: /^Remove .* from group$/ })).toHaveLength(2);
    await expect(dialog.getByRole('button', { name: 'Create Group' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A row cannot sit in both lists, so each pick moves it: five available becomes three, and ' +
          'the Members count and the Create button both follow. This is the state that decides ' +
          'whether the drawer scrolls, since the two lists grow into the same fixed-height column.',
      },
    },
  },
};

export const CreateAllTeammatesAdded: Story = {
  name: 'Create (every teammate added)',
  args: { initialTitle: 'Whole clinic', initialMembers: ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'] },
  play: async () => {
    const dialog = within(panel());
    // One of three different empty sentences - this is the only one reachable by adding.
    await expect(dialog.getByText('All teammates have been added.')).toBeInTheDocument();
    await expect(dialog.queryByRole('button', { name: /to group$/ })).toBeNull();
    await expect(dialog.getByText('Members (5)')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The picker empties into a sentence rather than collapsing, so the `min-h-30` box holds ' +
          'its height and the footer does not jump up the drawer.',
      },
    },
  },
};

export const CreateSearchNoMatch: Story = {
  name: 'Create (search matches nothing)',
  play: async () => {
    const dialog = within(panel());
    await userEvent.type(dialog.getByRole('textbox', { name: 'Search teammates' }), 'zzz');
    await expect(dialog.getByText('No teammates match your search.')).toBeInTheDocument();
    await expect(dialog.queryByRole('button', { name: /to group$/ })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second empty sentence. The filter runs over name + email + role joined together, so ' +
          '"vet" would keep two rows here while "zzz" keeps none - and the copy has to say which of ' +
          'the two reasons applies.',
      },
    },
  },
};

export const CreateSearchByRole: Story = {
  name: 'Create (search hits role, not name)',
  play: async () => {
    const dialog = within(panel());
    await userEvent.type(dialog.getByRole('textbox', { name: 'Search teammates' }), 'veterinarian');
    // Neither name contains the query - the match came from the role text alone.
    const rows = dialog.getAllByRole('button', { name: /to group$/ });
    await expect(rows).toHaveLength(2);
    await expect(dialog.getByText('Ruth Baumann')).toBeInTheDocument();
    await expect(dialog.getByText('Priya Raman')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The role is part of the haystack but is never printed on the row, so a search that hits ' +
          'it leaves a result set with no visible reason for being there. Worth seeing, because it ' +
          'is the case where the row would want a role line and does not have one.',
      },
    },
  },
};

export const EditAsCreator: Story = {
  name: 'Edit as creator',
  args: {
    mode: 'edit',
    placeholder: 'Surgery team',
    initialTitle: 'Surgery team',
    initialMembers: ['me', 'u-1', 'u-2'],
    ownerId: 'me',
  },
  play: async () => {
    const dialog = within(panel());
    await expect(
      dialog.getByRole('heading', { name: 'Group chat · Surgery team' })
    ).toBeInTheDocument();
    // Edit mode adds a Save Title action the create mode does not have.
    await expect(dialog.getByRole('button', { name: 'Save Title' })).toBeEnabled();
    // The owner keeps the pill and loses the Remove link; the other two keep theirs.
    await expect(dialog.getByText('Owner')).toBeInTheDocument();
    await expect(dialog.getAllByRole('button', { name: /^Remove .* from group$/ })).toHaveLength(2);
    await expect(
      dialog.queryByRole('button', { name: 'Remove Dr Lena Hartmann from group' })
    ).toBeNull();
    // The destructive footer replaces the create primary entirely.
    await expect(dialog.getByRole('button', { name: 'Delete Group' })).toBeInTheDocument();
    await expect(dialog.queryByRole('button', { name: 'Create Group' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full creator tree, and the only place the Owner pill exists: a soft-blue 9.5px ' +
          'uppercase chip on a hairline border, deliberately not the solid brand badge. The owner ' +
          'row has no Remove link at all rather than a disabled one, so a group can never be left ' +
          'without its creator.',
      },
    },
  },
};

export const EditRemoveMember: Story = {
  name: 'Edit (removing a member)',
  args: {
    mode: 'edit',
    placeholder: 'Surgery team',
    initialTitle: 'Surgery team',
    initialMembers: ['me', 'u-1', 'u-2'],
    ownerId: 'me',
  },
  play: async ({ args }) => {
    const dialog = within(panel());
    await expect(dialog.getByText('Members (3)')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Remove Ana Okafor from group' }));

    // Edit mode goes through the server callback, not the local members setter.
    await expect(args.onRemoveMember).toHaveBeenCalledWith('u-2');
    await waitFor(() => expect(dialog.getByText('Members (2)')).toBeInTheDocument());
    // The removed teammate returns to the picker.
    await expect(
      dialog.getByRole('button', { name: 'Add Ana Okafor to group' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Removal is a round trip in edit mode, so the row has to leave the member list and ' +
          'reappear in the picker below it. The two lists are rendered from the same `orgUsers` ' +
          'array, which is exactly why a member can only ever be in one of them.',
      },
    },
  },
};

export const EditAsNonCreator: Story = {
  name: 'Edit as a non-creator',
  args: {
    mode: 'edit',
    placeholder: 'Surgery team',
    initialTitle: 'Surgery team',
    initialMembers: ['u-1', 'u-2', 'me'],
    ownerId: 'u-1',
    currentUserId: 'me',
  },
  play: async () => {
    const dialog = within(panel());
    await expect(
      dialog.getByText('Only the group creator can modify this group.')
    ).toBeInTheDocument();
    // Every write affordance is absent rather than disabled.
    await expect(dialog.queryByRole('textbox', { name: 'Group Title' })).toBeNull();
    await expect(dialog.queryByRole('textbox', { name: 'Search teammates' })).toBeNull();
    await expect(dialog.queryByRole('button', { name: /^Remove .* from group$/ })).toBeNull();
    await expect(dialog.queryByRole('button', { name: 'Delete Group' })).toBeNull();
    // The member list itself still renders - this is a read view, not an empty one.
    await expect(dialog.getByText('Members (3)')).toBeInTheDocument();
    await expect(dialog.getByText('Ruth Baumann')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tree a member who did not create the group sees. Nothing here is dimmed: the title ' +
          'field, the picker and the delete footer are all removed, and a single notice card takes ' +
          'their place. A dim that still responds to a click would be the defect.',
      },
    },
  },
};

export const Busy: Story = {
  name: 'Busy (write in flight)',
  args: {
    mode: 'edit',
    placeholder: 'Surgery team',
    initialTitle: 'Surgery team',
    initialMembers: ['me', 'u-1'],
    ownerId: 'me',
    busy: true,
  },
  play: async () => {
    const dialog = within(panel());
    await expect(dialog.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    // Row-level actions dim rather than vanish, since they come back on settle.
    await expect(
      dialog.getByRole('button', { name: 'Remove Ruth Baumann from group' })
    ).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One `busy` flag relabels and disables every write in the drawer at once - Save Title, ' +
          'Delete Group and every per-row Add and Remove. Reachable only while a promise is open, ' +
          'so it had never been composited with the member rows before.',
      },
    },
  },
};

export const TeammatesLoading: Story = {
  name: 'Teammates still loading',
  args: { orgUsers: [], orgUsersLoading: true },
  play: async () => {
    const dialog = within(panel());
    await expect(dialog.getByText('Loading teammates…')).toBeInTheDocument();
    await expect(dialog.queryByText('No teammates available. Please wait...')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The loading branch guards the empty branch, so the drawer never flashes "No teammates ' +
          'available" while the roster is still in flight.',
      },
    },
  },
};

export const Closed: Story = {
  name: 'Closed',
  args: { open: false },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer still mounts when closed - it slides out on `translate-x-[120%]` rather than ' +
          'unmounting - so the page behind it is what the reader should see and nothing inside it ' +
          'should be focusable.',
      },
    },
  },
};
