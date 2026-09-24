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
const mockConfirm = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));
jest.mock('@/app/ui/overlays/Modal/ConfirmModal', () => ({
  useConfirm: () => ({ confirm: mockConfirm, confirmDialog: null }),
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

// A real-shaped organisation id (what Mongo-era orgs carry). A slug like `org1`
// could never trip the raw-id check below, which is how the leak shipped.
const ORG_ID = '6971e5d25934bff94ee07942';
const ACTOR_URI = `https://example.com/ap/organizations/${ORG_ID}`;
// Same pattern as rawIdViolations in e2e/support/pageInvariants.ts.
const RAW_ID = /\b[0-9a-f]{24}\b/;

// Other clinics' actor URIs, one per id shape, and how each is printed.
const REMOTE_HEX = 'https://remote.example/ap/organizations/a1b2c3d4e5f6a7b8c9d0e1f2';
const SHORT_HEX = 'https://remote.example/ap/organizations/…d0e1f2';
const REMOTE_UUID = 'https://other.example/ap/organizations/0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c';
const SHORT_UUID = 'https://other.example/ap/organizations/…4a5b6c';

const mockActor: APActorSettings = {
  uri: ACTOR_URI,
  preferredUsername: 'clinic-a',
  publicKeyId: `${ACTOR_URI}#main-key`,
  inboxUri: `${ACTOR_URI}/inbox`,
  outboxUri: `${ACTOR_URI}/outbox`,
  followersUri: `${ACTOR_URI}/followers`,
  followingUri: `${ACTOR_URI}/following`,
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
  mockConfirm.mockResolvedValue(true);
  setupMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FederationSection', () => {
  it('never prints the organisation id that the actor and inbox URIs end in', async () => {
    render(<FederationSection />);
    expect(await screen.findByText('Federation identity')).toBeInTheDocument();
    await waitFor(() => expect(listOutboundReferrals).toHaveBeenCalled());

    // Per text node, like the e2e rule: container.textContent glues the URI to
    // the "Copy" label beside it, and "…07942Copy" has no word boundary to match.
    expect(screen.queryAllByText(RAW_ID)).toHaveLength(0);
    // The host stays readable, with only the id's tail standing in for the id.
    expect(screen.getByText('https://example.com/ap/organizations/…e07942')).toBeInTheDocument();
    // The inbox has no human use; remote servers read it from the actor document.
    expect(screen.queryByRole('button', { name: 'Copy Inbox' })).not.toBeInTheDocument();
    expect(screen.getByText('@clinic-a')).toBeInTheDocument();
    // Nothing to copy by hand until a copy has actually failed.
    expect(screen.queryByRole('textbox', { name: /to copy by hand/ })).not.toBeInTheDocument();
  });

  it('still copies the full actor URI, the one value another clinic needs', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<FederationSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Actor URI' }));

    // Called a microtask later, inside the chain that also catches a missing API.
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ACTOR_URI));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ text: 'Actor URI copied to clipboard.' })
      )
    );
  });

  /*
   * The printed URI is abbreviated, so Copy is the way to get the whole value.
   * When the clipboard refuses, the user is told and handed the value in a field
   * to copy by hand; before, the click did nothing visible and left an
   * unhandled rejection.
   */
  it('hands over the full actor URI to copy by hand when the clipboard refuses', async () => {
    const writeText = jest
      .fn()
      .mockRejectedValueOnce(new DOMException('Write permission denied.', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<FederationSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Actor URI' }));

    const fallback = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Actor URI, to copy by hand',
    });
    expect(fallback).toHaveValue(ACTOR_URI);
    expect(fallback).toHaveAttribute('readonly');
    // Focusing it selects the whole value, ready for a manual copy.
    fireEvent.focus(fallback);
    expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, ACTOR_URI.length]);
    expect(mockNotify).toHaveBeenCalledWith('error', {
      title: 'Copy failed',
      text: 'Could not copy the Actor URI. Select it below and copy it by hand.',
    });
    expect(mockNotify).not.toHaveBeenCalledWith('success', expect.anything());

    // A copy that then works puts things back as they were.
    fireEvent.click(screen.getByRole('button', { name: 'Copy Actor URI' }));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /to copy by hand/ })).not.toBeInTheDocument()
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ text: 'Actor URI copied to clipboard.' })
    );
  });

  it('treats a browser with no clipboard API like a refused copy', async () => {
    // What an insecure context (a plain-http self-host) looks like.
    Object.assign(navigator, { clipboard: undefined });
    render(<FederationSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Actor URI' }));

    expect(await screen.findByRole('textbox', { name: 'Actor URI, to copy by hand' })).toHaveValue(
      ACTOR_URI
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Copy failed' })
    );
  });

  it("abbreviates the database ids other clinics' URIs end in, and acts on the full URI", async () => {
    (listFollowers as jest.Mock).mockResolvedValue([
      { ...mockFollower, remoteActorUri: REMOTE_HEX },
    ]);
    (listFollowing as jest.Mock).mockResolvedValue([
      { ...mockFollowing, remoteActorUri: REMOTE_UUID },
    ]);
    (listInboundReferrals as jest.Mock).mockResolvedValue([
      { ...mockReferral, fromActorUri: REMOTE_HEX },
    ]);
    (listOutboundReferrals as jest.Mock).mockResolvedValue([
      { ...mockReferral, id: 'ref2', toActorUri: REMOTE_UUID },
    ]);
    (approveFollower as jest.Mock).mockResolvedValue(undefined);
    render(<FederationSection />);

    // Follower and inbound sender; following and outbound recipient.
    await waitFor(() => expect(screen.getAllByText(SHORT_HEX)).toHaveLength(2));
    await waitFor(() => expect(screen.getAllByText(SHORT_UUID)).toHaveLength(2));
    expect(screen.getByText('from')).toBeInTheDocument();
    expect(screen.getByText('to')).toBeInTheDocument();
    expect(screen.queryAllByText(RAW_ID)).toHaveLength(0);
    expect(screen.queryAllByText(/0b6f3c1e/)).toHaveLength(0);

    // Only the text is shortened: the action still names the follower in full.
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approveFollower).toHaveBeenCalledWith(REMOTE_HEX));
  });

  /*
   * These rows are where a vet finds another clinic's actor URI, and Send
   * referral asks for one in a free-text field. The printed URI is shortened, so
   * each row carries a Copy for the whole value.
   */
  it("copies another clinic's full actor URI from its row, the value Send referral needs", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    (listFollowers as jest.Mock).mockResolvedValue([mockFollower]);
    (listFollowing as jest.Mock).mockResolvedValue([
      { ...mockFollowing, remoteActorUri: REMOTE_UUID },
    ]);
    (listInboundReferrals as jest.Mock).mockResolvedValue([
      { ...mockReferral, fromActorUri: REMOTE_HEX },
    ]);
    render(<FederationSection />);

    fireEvent.click(await screen.findByRole('button', { name: `Copy ${SHORT_UUID}` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REMOTE_UUID));
    // An inbound referral's sender, the clinic a referral would go back to.
    fireEvent.click(await screen.findByRole('button', { name: `Copy ${SHORT_HEX}` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REMOTE_HEX));
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ text: 'Actor URI copied to clipboard.' })
    );

    // Selected by hand, a shortened URI is not a valid one, so it cannot be
    // selected; text with nothing shortened stays selectable.
    expect(screen.getByText(SHORT_UUID)).toHaveClass('select-none');
    expect(screen.getByText(SHORT_HEX)).toHaveClass('select-none');
    expect(screen.getByText('https://example.com/ap/organizations/…e07942')).toHaveClass(
      'select-none'
    );
    expect(screen.getByText('https://remote.example/ap/organizations/r1')).not.toHaveClass(
      'select-none'
    );
    expect(screen.getByText('@clinic-a')).not.toHaveClass('select-none');
  });

  it("hands over another clinic's full actor URI to copy by hand when the clipboard refuses", async () => {
    Object.assign(navigator, { clipboard: undefined });
    (listFollowing as jest.Mock).mockResolvedValue([
      { ...mockFollowing, remoteActorUri: REMOTE_UUID },
    ]);
    render(<FederationSection />);

    fireEvent.click(await screen.findByRole('button', { name: `Copy ${SHORT_UUID}` }));

    expect(
      await screen.findByRole('textbox', { name: `${SHORT_UUID}, to copy by hand` })
    ).toHaveValue(REMOTE_UUID);
    expect(mockNotify).toHaveBeenCalledWith('error', {
      title: 'Copy failed',
      text: 'Could not copy the Actor URI. Select it below and copy it by hand.',
    });
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

    it('gives the token input an accessible name, not just a placeholder', async () => {
      // A placeholder alone isn't an accessible label - it disappears once typed into
      // and isn't reliably announced as a persistent label by assistive tech.
      // getByLabelText only resolves through a real aria-label/aria-labelledby/htmlFor
      // association, so this fails if the label is ever removed.
      (getActorSettings as jest.Mock).mockResolvedValue({
        ...mockActor,
        licenseTokenStatus: 'none',
      });
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Not set'));
      expect(screen.getByLabelText('Federation license token')).toBeInTheDocument();
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

    it('gives the follow-actor input an accessible name, not just a placeholder', async () => {
      (listFollowing as jest.Mock).mockResolvedValue([]);
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Not following any instances yet.'));
      expect(screen.getByLabelText('Remote organisation URI to follow')).toBeInTheDocument();
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

    it('requires confirmation before broadcasting an emergency', async () => {
      (announceEmergency as jest.Mock).mockResolvedValueOnce(undefined);
      let resolveConfirmation!: (approved: boolean) => void;
      mockConfirm.mockImplementationOnce(
        () => new Promise<boolean>((resolve) => (resolveConfirmation = resolve))
      );
      render(<FederationSection />);
      await waitFor(() => screen.getByText('Emergency broadcast'));

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Describe the emergency or critical notice...'),
          { target: { value: 'All staff alert' } }
        );
      });

      fireEvent.click(screen.getByRole('button', { name: 'Broadcast emergency' }));

      await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
      expect(announceEmergency).not.toHaveBeenCalled();
      await act(async () => resolveConfirmation(true));

      await waitFor(() =>
        expect(announceEmergency).toHaveBeenCalledWith('All staff alert', 'EMERGENCY')
      );
    });
  });
});
