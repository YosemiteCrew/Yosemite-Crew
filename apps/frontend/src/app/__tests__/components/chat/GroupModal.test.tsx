import { render, screen, fireEvent } from '@testing-library/react';
import { GroupModal, type GroupModalProps } from '@/app/features/chat/components/GroupModal';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children, showModal }: { children: React.ReactNode; showModal: boolean }) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" aria-label="Close dialog" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    inname,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    inname: string;
  }) => (
    <input
      aria-label={inlabel}
      placeholder={inlabel}
      name={inname}
      value={value}
      onChange={onChange}
    />
  ),
}));

jest.mock('react-icons/md', () => ({ MdDeleteForever: () => <span data-testid="remove-icon" /> }));
jest.mock('react-icons/io', () => ({
  IoIosAddCircleOutline: () => <span data-testid="add-icon" />,
}));

const ORG_USERS = [
  { id: 'u1', userId: 'u1', name: 'Alice Vet', email: 'alice@clinic.com', role: 'vet' },
  { id: 'u2', userId: 'u2', name: 'Bob Tech', email: 'bob@clinic.com', role: 'tech' },
  { id: 'me', userId: 'me', name: 'Me Myself', email: 'me@clinic.com' },
];

const baseProps = (): GroupModalProps => ({
  open: true,
  mode: 'create',
  title: '',
  placeholder: '',
  members: [],
  ownerId: undefined,
  currentUserId: 'me',
  search: '',
  busy: false,
  orgUsers: ORG_USERS,
  orgUsersLoading: false,
  channel: null,
  onClose: jest.fn(),
  onTitleChange: jest.fn(),
  onSearchChange: jest.fn(),
  onMembersChange: jest.fn(),
  onCreate: jest.fn().mockResolvedValue(undefined),
  onUpdateTitle: jest.fn().mockResolvedValue(undefined),
  onAddMember: jest.fn().mockResolvedValue(undefined),
  onRemoveMember: jest.fn().mockResolvedValue(undefined),
  onDelete: jest.fn().mockResolvedValue(undefined),
});

const setup = (over: Partial<GroupModalProps> = {}) => {
  const props = { ...baseProps(), ...over };
  render(<GroupModal {...props} />);
  return props;
};

describe('GroupModal', () => {
  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('renders create mode with title, members and add-members sections, excluding self', () => {
    setup();
    expect(screen.getByText('Create group')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Group Title')).toBeInTheDocument();
    expect(screen.getByText('Members (0)')).toBeInTheDocument();
    expect(screen.getByText('Add members')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search teammates')).toBeInTheDocument();
    expect(screen.getByText('Alice Vet')).toBeInTheDocument();
    expect(screen.getByText('Bob Tech')).toBeInTheDocument();
    // current user is excluded from the picker
    expect(screen.queryByText('Me Myself')).not.toBeInTheDocument();
  });

  it('adds a member in create mode through onMembersChange', () => {
    const props = setup();
    fireEvent.click(screen.getAllByTitle('Add member')[0]);
    expect(props.onMembersChange).toHaveBeenCalledWith(['u1']);
  });

  it('removes a member in create mode through onMembersChange', () => {
    const props = setup({ members: ['u1'] });
    fireEvent.click(screen.getAllByTitle('Remove member')[0]);
    expect(props.onMembersChange).toHaveBeenCalledWith([]);
  });

  it('does not create the group when the form is empty', () => {
    const props = setup({ title: '', members: [] });
    fireEvent.click(screen.getByText('Create Group'));
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('does not create the group with a title but no members', () => {
    const props = setup({ title: 'Team', members: [] });
    fireEvent.click(screen.getByText('Create Group'));
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('creates the group when title and members are present', () => {
    const props = setup({ title: '  Core Team  ', members: ['u1'] });
    fireEvent.click(screen.getByText('Create Group'));
    expect(props.onCreate).toHaveBeenCalledWith('Core Team', ['u1']);
  });

  it('forwards title and search edits', () => {
    const props = setup();
    fireEvent.change(screen.getByPlaceholderText('Group Title'), { target: { value: 'X' } });
    expect(props.onTitleChange).toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Search teammates'), { target: { value: 'ali' } });
    expect(props.onSearchChange).toHaveBeenCalled();
  });

  it('shows the loading state while org users load', () => {
    setup({ orgUsersLoading: true });
    expect(screen.getByText('Loading teammates…')).toBeInTheDocument();
  });

  it('shows the "no teammates available" empty state', () => {
    setup({ orgUsers: [] });
    expect(screen.getByText('No teammates available. Please wait...')).toBeInTheDocument();
  });

  it('shows the "no match" empty state when a search excludes everyone', () => {
    setup({ search: 'zzzzz' });
    expect(screen.getByText('No teammates match your search.')).toBeInTheDocument();
  });

  it('shows the "all added" empty state when every teammate is a member', () => {
    setup({ members: ['u1', 'u2'] });
    expect(screen.getByText('All teammates have been added.')).toBeInTheDocument();
  });

  it('caps the teammate picker at ten results', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `x${i}`,
      userId: `x${i}`,
      name: `Person ${i}`,
      email: `p${i}@clinic.com`,
    }));
    setup({ orgUsers: many });
    expect(screen.getAllByTitle('Add member')).toHaveLength(10);
  });

  it('filters the teammate picker by the search term', () => {
    setup({ search: 'alice' });
    expect(screen.getByText('Alice Vet')).toBeInTheDocument();
    expect(screen.queryByText('Bob Tech')).not.toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Close dialog'));
    expect(props.onClose).toHaveBeenCalled();
  });

  describe('edit mode (creator)', () => {
    const editProps = (over: Partial<GroupModalProps> = {}): Partial<GroupModalProps> => ({
      mode: 'edit',
      ownerId: 'me',
      currentUserId: 'me',
      members: ['me', 'u1'],
      title: 'Team A',
      placeholder: 'Team A',
      ...over,
    });

    it('renders owner badge, save-title and delete controls', () => {
      setup(editProps());
      expect(screen.getByText('Group info')).toBeInTheDocument();
      expect(screen.getByText('Save Title')).toBeInTheDocument();
      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Delete Group')).toBeInTheDocument();
    });

    it('saves the title', () => {
      const props = setup(editProps());
      fireEvent.click(screen.getByText('Save Title'));
      expect(props.onUpdateTitle).toHaveBeenCalledWith('Team A');
    });

    it('does not save an empty title', () => {
      const props = setup(editProps({ title: '   ' }));
      fireEvent.click(screen.getByText('Save Title'));
      expect(props.onUpdateTitle).not.toHaveBeenCalled();
    });

    it('adds a member through onAddMember', () => {
      const props = setup(editProps({ members: ['me'] }));
      fireEvent.click(screen.getAllByTitle('Add member')[0]);
      expect(props.onAddMember).toHaveBeenCalled();
    });

    it('removes a non-owner member through onRemoveMember', () => {
      const props = setup(editProps());
      fireEvent.click(screen.getAllByTitle('Remove member')[0]);
      expect(props.onRemoveMember).toHaveBeenCalledWith('u1');
    });

    it('deletes the group', () => {
      const props = setup(editProps());
      fireEvent.click(screen.getByText('Delete Group'));
      expect(props.onDelete).toHaveBeenCalled();
    });

    it('treats a practitionerId-matched owner as the creator', () => {
      setup({
        mode: 'edit',
        ownerId: 'owner-prac',
        currentUserId: 'me-prac',
        members: ['me'],
        title: 'Team A',
        placeholder: 'Team A',
        // one org user links the current user (via userId) to the owner (via practitionerId)
        orgUsers: [
          { id: 'me', userId: 'me-prac', practitionerId: 'owner-prac', name: 'Me Myself' },
        ],
      });
      // creator controls are available
      expect(screen.queryByText('Only the group creator can modify this group.')).toBeNull();
    });
  });

  describe('edit mode (non-creator)', () => {
    it('shows the notice and hides the edit controls', () => {
      setup({
        mode: 'edit',
        ownerId: 'someone-else',
        currentUserId: 'me',
        members: ['someone-else', 'me'],
        title: 'Team A',
        placeholder: 'Team A',
      });
      expect(screen.getByText('Only the group creator can modify this group.')).toBeInTheDocument();
      expect(screen.queryByText('Save Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Group')).not.toBeInTheDocument();
      expect(screen.queryByText('Add more members')).not.toBeInTheDocument();
    });
  });

  it('resolves a member name from the channel state when absent from org users', () => {
    const channel = {
      state: { members: { ghost: { user: { name: 'Ghost User' } } } },
    } as unknown as GroupModalProps['channel'];
    setup({ members: ['ghost'], channel });
    expect(screen.getByText('Ghost User')).toBeInTheDocument();
  });

  it('falls back to the member id when no name is available', () => {
    setup({ members: ['unknown-id'] });
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });
});
