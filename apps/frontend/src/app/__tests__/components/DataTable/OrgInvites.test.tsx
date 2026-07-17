import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgInvites from '@/app/ui/tables/OrgInvites';
import { Invite } from '@/app/features/organization/types/team';

jest.mock('@/app/features/organization/services/teamService', () => ({
  acceptInvite: jest.fn(),
  rejectInvite: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolveOrgScopedRedirect: jest.fn(),
}));

const inviteCardSpy = jest.fn();

// Mock InviteCard: expose accept/reject affordances and record received props
jest.mock('@/app/ui/cards/InviteCard/InviteCard', () => ({
  __esModule: true,
  default: (props: any) => {
    inviteCardSpy(props);
    return (
      <div data-testid={`invite-card-${props.invite._id}`}>
        <button onClick={() => props.handleAccept(props.invite)}>accept</button>
        <button onClick={() => props.handleReject(props.invite)}>reject</button>
      </div>
    );
  },
}));

const invite: Invite = {
  _id: 'invite-1',
  organisationId: 'org-1',
  organisationName: 'Yosemite Vet',
  organisationType: 'HOSPITAL',
  role: 'SUPERVISOR',
  employmentType: 'FULL_TIME',
  invitedByUserId: '',
  departmentId: '',
  inviteeEmail: '',
  token: '',
  status: 'PENDING',
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

  it('renders nothing when there are no invites', () => {
    const { container } = render(<OrgInvites {...makeProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an InviteCard per invite', () => {
    render(<OrgInvites {...makeProps({ invites: [invite] })} />);
    expect(screen.getByTestId('invite-card-invite-1')).toBeInTheDocument();
    expect(inviteCardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ invite, disabled: false })
    );
  });

  it('accepts an invite: removes it from state and navigates to the resolved route', async () => {
    acceptInviteMock.mockResolvedValue(undefined);
    resolveOrgScopedRedirectMock.mockResolvedValue('/team-onboarding?orgId=org-1');

    const setInvites = jest.fn();
    const onAccepting = jest.fn();
    const onNavigate = jest.fn();

    render(
      <OrgInvites {...makeProps({ invites: [invite], setInvites, onAccepting, onNavigate })} />
    );

    fireEvent.click(screen.getByText('accept'));

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

    fireEvent.click(screen.getByText('reject'));

    expect(rejectInviteMock).toHaveBeenCalledWith(invite);
    await waitFor(() => expect(setInvites).toHaveBeenCalled());

    const updater = setInvites.mock.calls[0][0];
    expect(updater([invite])).toEqual([]);
  });

  it('calls onAccepting(false) and keeps the invite on accept error', async () => {
    acceptInviteMock.mockRejectedValue(new Error('network error'));
    const onAccepting = jest.fn();
    const setInvites = jest.fn();

    render(<OrgInvites {...makeProps({ invites: [invite], onAccepting, setInvites })} />);

    fireEvent.click(screen.getByText('accept'));

    await waitFor(() => expect(onAccepting).toHaveBeenCalledWith(false));
    expect(setInvites).not.toHaveBeenCalled();
  });
});
