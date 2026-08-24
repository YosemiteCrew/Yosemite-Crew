import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import FederationSection from '@/app/features/settings/pages/Settings/Sections/FederationSection';
import type {
  APActorSettings,
  APFollower,
  APFollowing,
  APReferral,
} from '@/app/features/federation/types/federation';

// ─── Service mocks ────────────────────────────────────────────────────────────

jest.mock('@/app/features/federation/services/federationService', () => ({
  getActorSettings: jest.fn(),
  listFollowers: jest.fn(),
  listFollowing: jest.fn(),
  listInboundReferrals: jest.fn(),
  listOutboundReferrals: jest.fn(),
  followRemoteActor: jest.fn(),
  unfollowRemoteActor: jest.fn(),
  approveFollower: jest.fn(),
  rejectFollower: jest.fn(),
  respondToReferral: jest.fn(),
  sendReferral: jest.fn(),
  updateLicenseToken: jest.fn(),
  setDirectoryListed: jest.fn(),
  sendNote: jest.fn(),
  announceEmergency: jest.fn(),
}));

import {
  getActorSettings,
  listFollowers,
  listFollowing,
  listInboundReferrals,
  listOutboundReferrals,
  followRemoteActor,
  approveFollower,
  rejectFollower,
  respondToReferral,
  updateLicenseToken,
  setDirectoryListed,
  announceEmergency,
} from '@/app/features/federation/services/federationService';

// ─── UI mocks ─────────────────────────────────────────────────────────────────

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({
    text,
    onClick,
    isDisabled,
  }: {
    text: string;
    onClick: () => void;
    isDisabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={isDisabled ?? false}>
      {text}
    </button>
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockActor: APActorSettings = {
  uri: 'https://example.com/ap/organizations/org1',
  preferredUsername: 'clinic-a',
  publicKeyId: 'https://example.com/ap/organizations/org1#main-key',
  inboxUri: 'https://example.com/ap/organizations/org1/inbox',
  outboxUri: 'https://example.com/ap/organizations/org1/outbox',
  followersUri: 'https://example.com/ap/organizations/org1/followers',
  followingUri: 'https://example.com/ap/organizations/org1/following',
  sharedInboxUri: null,
  summary: null,
  iconUrl: null,
  createdAt: '2026-06-30T00:00:00.000Z',
  licenseTokenStatus: 'valid',
  isVerified: true,
  directoryListed: false,
};

const mockFollower: APFollower = {
  id: 'f1',
  remoteActorUri: 'https://remote.example/ap/organizations/r1',
  remoteInboxUri: 'https://remote.example/ap/organizations/r1/inbox',
  state: 'PENDING',
  approvedAt: null,
  createdAt: '2026-06-30T00:00:00.000Z',
};

const mockFollowing: APFollowing = {
  id: 'fw1',
  remoteActorUri: 'https://remote.example/ap/organizations/r2',
  state: 'ACCEPTED',
  createdAt: '2026-06-30T00:00:00.000Z',
};

const mockReferral: APReferral = {
  id: 'ref1',
  activityUri: 'https://example.com/ap/activities/ref1',
  fromActorUri: 'https://example.com/ap/organizations/org1',
  toActorUri: 'https://remote.example/ap/organizations/r1',
  fromOrgId: 'org1',
  toOrgId: null,
  patientSummary: { species: 'Canine', chiefComplaint: 'Limping' },
  clinicalContext: null,
  urgency: 'URGENT',
  state: 'PENDING',
  acceptedAt: null,
  declinedAt: null,
  createdAt: '2026-06-30T00:00:00.000Z',
};

function setupMocks() {
  (getActorSettings as jest.Mock).mockResolvedValue(mockActor);
  (listFollowers as jest.Mock).mockResolvedValue([]);
  (listFollowing as jest.Mock).mockResolvedValue([]);
  (listInboundReferrals as jest.Mock).mockResolvedValue([]);
  (listOutboundReferrals as jest.Mock).mockResolvedValue([]);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockNotify.mockClear();
  setupMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FederationSection', () => {
  it('renders actor URI after loading', async () => {
    render(<FederationSection />);
    await waitFor(() =>
      expect(screen.getByText('https://example.com/ap/organizations/org1')).toBeInTheDocument()
    );
    expect(screen.getByText('Federation identity')).toBeInTheDocument();
  });

  it('explains the failure instead of disappearing when getActorSettings rejects', async () => {
    // It used to return null, so on an instance with federation switched off the
    // entire section vanished from Settings and the only signal was a toast that
    // had already faded. That reads as "the feature does not exist".
    (getActorSettings as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    render(<FederationSection />);
    await waitFor(() => expect(getActorSettings).toHaveBeenCalled());

    expect(await screen.findByText('Federation')).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // The working cards are still absent, so this is the failure state.
    expect(screen.queryByText('Federation identity')).not.toBeInTheDocument();
  });

  it('retries loading when Try again is clicked', async () => {
    (getActorSettings as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    render(<FederationSection />);
    const retry = await screen.findByRole('button', { name: 'Try again' });

    (getActorSettings as jest.Mock).mockResolvedValueOnce(mockActor);
    fireEvent.click(retry);

    expect(await screen.findByText('Federation identity')).toBeInTheDocument();
  });

  describe('LicenseTokenCard', () => {
    it('shows verified badge when licenseTokenStatus is valid', async () => {
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Federation license'));
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Paste license token...')).not.toBeInTheDocument();
    });

    it('shows token input when licenseTokenStatus is none', async () => {
      (getActorSettings as jest.Mock).mockResolvedValue({
        ...mockActor,
        licenseTokenStatus: 'none',
      });
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Not set'));
      expect(screen.getByPlaceholderText('Paste license token...')).toBeInTheDocument();
    });

    it('shows token input when licenseTokenStatus is invalid', async () => {
      (getActorSettings as jest.Mock).mockResolvedValue({
        ...mockActor,
        licenseTokenStatus: 'invalid',
      });
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Invalid / expired'));
      expect(screen.getByPlaceholderText('Paste license token...')).toBeInTheDocument();
    });

    it('calls updateLicenseToken and reloads actor on save', async () => {
      (getActorSettings as jest.Mock)
        .mockResolvedValueOnce({ ...mockActor, licenseTokenStatus: 'none' })
        .mockResolvedValueOnce({ ...mockActor, licenseTokenStatus: 'valid' });
      (updateLicenseToken as jest.Mock).mockResolvedValueOnce({ ok: true });

      render(<FederationSection />);
      await waitFor(() => screen.getByPlaceholderText('Paste license token...'));

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Paste license token...'), {
          target: { value: 'eyJhbGci...' },
        });
      });

      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(updateLicenseToken).toHaveBeenCalledWith('eyJhbGci...');
      });
      await waitFor(() => expect(getActorSettings).toHaveBeenCalledTimes(2));
    });
  });

  describe('FollowersCard', () => {
    it('shows empty state when no followers', async () => {
      render(<FederationSection />);
      await waitFor(() => expect(screen.getByText('No followers yet.')).toBeInTheDocument());
    });

    it('renders pending follower with approve/reject buttons', async () => {
      (listFollowers as jest.Mock).mockResolvedValue([mockFollower]);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('https://remote.example/ap/organizations/r1'));
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });

    it('calls approveFollower when Approve clicked', async () => {
      (listFollowers as jest.Mock).mockResolvedValueOnce([mockFollower]).mockResolvedValueOnce([]);
      (approveFollower as jest.Mock).mockResolvedValueOnce(undefined);

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      await waitFor(() =>
        expect(approveFollower).toHaveBeenCalledWith('https://remote.example/ap/organizations/r1')
      );
    });

    it('calls rejectFollower when Reject clicked', async () => {
      (listFollowers as jest.Mock).mockResolvedValueOnce([mockFollower]).mockResolvedValueOnce([]);
      (rejectFollower as jest.Mock).mockResolvedValueOnce(undefined);

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'Reject' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

      await waitFor(() =>
        expect(rejectFollower).toHaveBeenCalledWith('https://remote.example/ap/organizations/r1')
      );
    });
  });

  describe('FollowingCard', () => {
    it('shows empty state when not following anyone', async () => {
      render(<FederationSection />);
      await waitFor(() =>
        expect(screen.getByText('Not following any instances yet.')).toBeInTheDocument()
      );
    });

    it('renders a following entry with unfollow button', async () => {
      (listFollowing as jest.Mock).mockResolvedValue([mockFollowing]);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('https://remote.example/ap/organizations/r2'));
      expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
    });

    it('calls followRemoteActor when Follow button clicked', async () => {
      (followRemoteActor as jest.Mock).mockResolvedValueOnce(undefined);
      (listFollowing as jest.Mock).mockResolvedValue([]);

      render(<FederationSection />);
      await waitFor(() => screen.getByText('Not following any instances yet.'));

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('https://other-clinic.example/ap/organizations/abc'),
          { target: { value: 'https://other.example/ap/organizations/xyz' } }
        );
      });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Follow' })).not.toBeDisabled()
      );
      fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

      await waitFor(() =>
        expect(followRemoteActor).toHaveBeenCalledWith('https://other.example/ap/organizations/xyz')
      );
    });
  });

  describe('ReferralInboxCard', () => {
    it('shows empty state when no inbound referrals', async () => {
      render(<FederationSection />);
      await waitFor(() =>
        expect(screen.getByText('No inbound referrals yet.')).toBeInTheDocument()
      );
    });

    it('renders an inbound referral row', async () => {
      (listInboundReferrals as jest.Mock).mockResolvedValue([mockReferral]);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Canine'));
      expect(screen.getByText('Limping')).toBeInTheDocument();
      // 'Urgent' also appears in the send-referral <select>, use getAllByText
      expect(screen.getAllByText('Urgent').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Accept and Decline buttons for a PENDING inbound referral', async () => {
      (listInboundReferrals as jest.Mock).mockResolvedValue([mockReferral]);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Canine'));
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    });

    it('calls respondToReferral with accept when Accept clicked', async () => {
      (listInboundReferrals as jest.Mock)
        .mockResolvedValueOnce([mockReferral])
        .mockResolvedValueOnce([]);
      (respondToReferral as jest.Mock).mockResolvedValueOnce({ id: 'ref1', state: 'ACCEPTED' });

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'Accept' }));
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(respondToReferral).toHaveBeenCalledWith('ref1', 'accept'));
    });

    it('calls respondToReferral with decline when Decline clicked', async () => {
      (listInboundReferrals as jest.Mock)
        .mockResolvedValueOnce([mockReferral])
        .mockResolvedValueOnce([]);
      (respondToReferral as jest.Mock).mockResolvedValueOnce({ id: 'ref1', state: 'DECLINED' });

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'Decline' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

      await waitFor(() => expect(respondToReferral).toHaveBeenCalledWith('ref1', 'decline'));
    });
  });

  describe('SendReferralCard', () => {
    it('associates each field label with its control (accessible by label)', async () => {
      render(<FederationSection />);
      await waitFor(() => screen.getByLabelText('Recipient actor URI *'));

      // Labels are wired via htmlFor/id, so getByLabelText resolves each control.
      expect(screen.getByLabelText('Recipient actor URI *')).toBeInTheDocument();
      expect(screen.getByLabelText('Species *')).toBeInTheDocument();
      expect(screen.getByLabelText('Breed')).toBeInTheDocument();
      expect(screen.getByLabelText('Age')).toBeInTheDocument();
      expect(screen.getByLabelText('Urgency')).toBeInTheDocument();
      expect(screen.getByLabelText('Chief complaint *')).toBeInTheDocument();
      expect(screen.getByLabelText('Clinical context')).toBeInTheDocument();
    });

    it('edits fields via their labels and enables Send referral', async () => {
      render(<FederationSection />);
      await waitFor(() => screen.getByLabelText('Recipient actor URI *'));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Recipient actor URI *'), {
          target: { value: 'https://remote.example/ap/organizations/r1' },
        });
        fireEvent.change(screen.getByLabelText('Species *'), {
          target: { value: 'Canine' },
        });
        fireEvent.change(screen.getByLabelText('Chief complaint *'), {
          target: { value: 'Limping' },
        });
      });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Send referral' })).not.toBeDisabled()
      );
    });
  });

  describe('DirectoryListingCard', () => {
    it('shows Not listed and enables the button when verified and not listed', async () => {
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Directory listing'));
      expect(screen.getByText('Not listed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'List in directory' })).not.toBeDisabled();
    });

    it('shows Listed and a remove button when already listed', async () => {
      (getActorSettings as jest.Mock).mockResolvedValue({ ...mockActor, directoryListed: true });
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Directory listing'));
      expect(screen.getByText('Listed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove from directory' })).toBeInTheDocument();
    });

    it('disables the button with a hint when not verified', async () => {
      (getActorSettings as jest.Mock).mockResolvedValue({
        ...mockActor,
        isVerified: false,
      });
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Directory listing'));
      expect(screen.getByRole('button', { name: 'List in directory' })).toBeDisabled();
      expect(
        screen.getByText(
          'Verify this clinic with a license token before you can list it in the directory.'
        )
      ).toBeInTheDocument();
    });

    it('calls setDirectoryListed(true) and reloads on list', async () => {
      (getActorSettings as jest.Mock)
        .mockResolvedValueOnce(mockActor)
        .mockResolvedValueOnce({ ...mockActor, directoryListed: true });
      (setDirectoryListed as jest.Mock).mockResolvedValueOnce({ listed: true });

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'List in directory' }));
      fireEvent.click(screen.getByRole('button', { name: 'List in directory' }));

      await waitFor(() => expect(setDirectoryListed).toHaveBeenCalledWith(true));
      await waitFor(() => expect(getActorSettings).toHaveBeenCalledTimes(2));
    });

    it('calls setDirectoryListed(false) when removing', async () => {
      (getActorSettings as jest.Mock).mockResolvedValue({ ...mockActor, directoryListed: true });
      (setDirectoryListed as jest.Mock).mockResolvedValueOnce({ listed: false });

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'Remove from directory' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove from directory' }));

      await waitFor(() => expect(setDirectoryListed).toHaveBeenCalledWith(false));
    });

    it('notifies error when setDirectoryListed rejects', async () => {
      (setDirectoryListed as jest.Mock).mockRejectedValueOnce(new Error('nope'));

      render(<FederationSection />);
      await waitFor(() => screen.getByRole('button', { name: 'List in directory' }));
      fireEvent.click(screen.getByRole('button', { name: 'List in directory' }));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('error', {
          title: 'Update failed',
          text: 'Could not update the directory listing.',
        })
      );
    });
  });

  describe('EmergencyCard', () => {
    it('broadcast button is disabled when content is empty', async () => {
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Emergency broadcast'));
      expect(screen.getByRole('button', { name: 'Broadcast emergency' })).toBeDisabled();
    });

    it('calls announceEmergency when broadcast button clicked', async () => {
      (announceEmergency as jest.Mock).mockResolvedValueOnce(undefined);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Emergency broadcast'));

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Describe the emergency or critical notice...'),
          { target: { value: 'All staff alert' } }
        );
      });

      fireEvent.click(screen.getByRole('button', { name: 'Broadcast emergency' }));

      await waitFor(() =>
        expect(announceEmergency).toHaveBeenCalledWith('All staff alert', 'EMERGENCY')
      );
    });
  });
});
