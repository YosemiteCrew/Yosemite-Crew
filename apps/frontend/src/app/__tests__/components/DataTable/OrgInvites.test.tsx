import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrgInvites from '@/app/ui/tables/OrgInvites';
import { Invite } from '@/app/features/organization/types/team';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  acceptInvite: jest.fn(),
  rejectInvite: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolveOrgScopedRedirect: jest.fn(),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="generic-table">
      {data.map((item: any, idx: number) => (
        <div key={item._id ?? idx}>
          {columns.map((col: any) => (
            <div key={String(col.key)}>{col.render ? col.render(item) : item[col.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const inviteCardSpy = jest.fn();

jest.mock('@/app/ui/cards/InviteCard/InviteCard', () => ({
  __esModule: true,
  default: (props: any) => {
    inviteCardSpy(props);
    return <div data-testid="invite-card" />;
  },
}));

const invite: Invite = {
  _id: 'invite-1',
  organisationId: 'org-1',
  organisationName: 'Yosemite Vet',
  organisationType: 'HOSPITAL',
  role: 'SUPERVISOR',
  employmentType: 'FULL_TIME',
  name: 'Invite 1',
  invitedByUserId: '',
  inviteeEmail: '',
  departmentId: '',
  token: '',
  status: 'ACCEPTED',
  expiresAt: '',
  updatedAt: '',
  createdAt: '',
} as Invite;

const makeProps = (overrides = {}) => ({
  invites: [] as Invite[],
  setInvites: jest.fn(),
  onAccepting: jest.fn(),
  onNavigate: jest.fn(),
  ...overrides,
});

describe('OrgInvites', () => {
  let acceptInviteMock: jest.Mock;
  let rejectInviteMock: jest.Mock;
  let resolveOrgScopedRedirectMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    acceptInviteMock = jest.requireMock(
      '@/app/features/organization/services/teamService'
    ).acceptInvite;
    rejectInviteMock = jest.requireMock(
      '@/app/features/organization/services/teamService'
    ).rejectInvite;
    resolveOrgScopedRedirectMock = jest.requireMock(
      '@/app/lib/postAuthRedirect'
    ).resolveOrgScopedRedirect;
  });

  it('renders table and cards with invites', () => {
    render(<OrgInvites {...makeProps({ invites: [invite] })} />);

    expect(screen.getByTestId('generic-table')).toBeInTheDocument();
    expect(screen.getByTestId('invite-card')).toBeInTheDocument();
    expect(inviteCardSpy).toHaveBeenCalledWith(expect.objectContaining({ invite }));
  });

  it('accepts an invite: removes it from state and navigates to resolved route', async () => {
    acceptInviteMock.mockResolvedValue(undefined);
    resolveOrgScopedRedirectMock.mockResolvedValue('/team-onboarding?orgId=org-1');

    const setInvites = jest.fn();
    const onAccepting = jest.fn();
    const onNavigate = jest.fn();

    render(
      <OrgInvites {...makeProps({ invites: [invite], setInvites, onAccepting, onNavigate })} />
    );

    const acceptButton = screen.getByRole('button', { name: 'Accept invite' });
    fireEvent.click(acceptButton);

    expect(acceptInviteMock).toHaveBeenCalledWith(invite);
    expect(onAccepting).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(setInvites).toHaveBeenCalled();
      expect(onNavigate).toHaveBeenCalledWith('/team-onboarding?orgId=org-1');
    });

    const updater = setInvites.mock.calls[0][0];
    expect(updater([invite])).toEqual([]);
  });

  it('rejects an invite and removes it from state', async () => {
    rejectInviteMock.mockResolvedValue(undefined);
    const setInvites = jest.fn();

    render(<OrgInvites {...makeProps({ invites: [invite], setInvites })} />);

    const declineButton = screen.getByRole('button', { name: 'Decline invite' });
    fireEvent.click(declineButton);

    expect(rejectInviteMock).toHaveBeenCalledWith(invite);
    await waitFor(() => {
      expect(setInvites).toHaveBeenCalled();
    });

    const updater = setInvites.mock.calls[0][0];
    expect(updater([invite])).toEqual([]);
  });

  it('shows empty state when no invites', () => {
    render(<OrgInvites {...makeProps()} />);
    expect(screen.getByText('No pending invites')).toBeInTheDocument();
  });

  it('calls onAccepting(false) and keeps invite in list on accept error', async () => {
    acceptInviteMock.mockRejectedValue(new Error('network error'));
    const onAccepting = jest.fn();
    const setInvites = jest.fn();

    render(<OrgInvites {...makeProps({ invites: [invite], onAccepting, setInvites })} />);

    const acceptButton = screen.getByRole('button', { name: 'Accept invite' });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(onAccepting).toHaveBeenCalledWith(false);
    });
    expect(setInvites).not.toHaveBeenCalled();
  });
});
