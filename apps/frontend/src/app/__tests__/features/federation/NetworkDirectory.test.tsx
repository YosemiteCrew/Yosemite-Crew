import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import NetworkDirectory from '@/app/features/federation/components/NetworkDirectory';
import type { APDirectoryClinic } from '@/app/features/federation/types/federation';

jest.mock('@/app/features/federation/services/federationService', () => ({
  listDirectory: jest.fn(),
  followRemoteActor: jest.fn(),
}));

import {
  listDirectory,
  followRemoteActor,
} from '@/app/features/federation/services/federationService';

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

const clinicA: APDirectoryClinic = {
  actorUri: 'https://a.example/ap/organizations/a',
  orgName: 'Alpha Vet Clinic',
  instanceHost: 'a.example',
  handle: '@alpha-vet',
};

const clinicB: APDirectoryClinic = {
  actorUri: 'https://b.example/ap/organizations/b',
  orgName: 'Beta Animal Hospital',
  instanceHost: 'b.example',
  handle: '@beta-animal',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockNotify.mockClear();
});

describe('NetworkDirectory', () => {
  it('shows the loading state before data resolves', async () => {
    let resolve: (value: { clinics: APDirectoryClinic[] }) => void = () => {};
    (listDirectory as jest.Mock).mockReturnValue(
      new Promise<{ clinics: APDirectoryClinic[] }>((r) => {
        resolve = r;
      })
    );

    render(<NetworkDirectory />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await act(async () => {
      resolve({ clinics: [] });
    });
  });

  it('shows the empty state when no clinics are listed', async () => {
    (listDirectory as jest.Mock).mockResolvedValue({ clinics: [], unavailable: false });
    render(<NetworkDirectory />);
    await waitFor(() =>
      expect(screen.getByText('No clinics are listed in the directory yet.')).toBeInTheDocument()
    );
  });

  it('renders clinic cards with name, handle, and host', async () => {
    (listDirectory as jest.Mock).mockResolvedValue({
      clinics: [clinicA, clinicB],
      unavailable: false,
    });
    render(<NetworkDirectory />);
    await waitFor(() => screen.getByText('Alpha Vet Clinic'));
    expect(screen.getByText('@alpha-vet')).toBeInTheDocument();
    expect(screen.getByText('a.example')).toBeInTheDocument();
    expect(screen.getByText('Beta Animal Hospital')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Follow' })).toHaveLength(2);
  });

  it('notifies error when the directory fails to load', async () => {
    (listDirectory as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<NetworkDirectory />);
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Directory unavailable',
        text: 'Could not load the clinic directory.',
      })
    );
    // Previously this fell through to the empty state, so an unreachable or
    // switched-off federation service read as "nobody has listed yet".
    expect(screen.getByText(/directory is unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByText('No clinics are listed in the directory yet.')
    ).not.toBeInTheDocument();
  });

  it('reports unavailable when the API answers 200 but flags the authority as unreachable', async () => {
    // The backend degrades gracefully rather than erroring, so a successful
    // response can still mean "could not load". Without honouring the flag this
    // rendered as "no clinics listed yet", which is how the whole feature came
    // to look like it was simply doing nothing.
    (listDirectory as jest.Mock).mockResolvedValueOnce({ clinics: [], unavailable: true });
    render(<NetworkDirectory />);
    expect(await screen.findByText(/directory is unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByText('No clinics are listed in the directory yet.')
    ).not.toBeInTheDocument();
  });

  it('shows the empty state, not the error state, when the directory is genuinely empty', async () => {
    (listDirectory as jest.Mock).mockResolvedValueOnce({ clinics: [], unavailable: false });
    render(<NetworkDirectory />);
    expect(
      await screen.findByText('No clinics are listed in the directory yet.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/directory is unavailable/i)).not.toBeInTheDocument();
  });

  it('follows a clinic and notifies success', async () => {
    (listDirectory as jest.Mock).mockResolvedValue({ clinics: [clinicA], unavailable: false });
    (followRemoteActor as jest.Mock).mockResolvedValueOnce(undefined);

    render(<NetworkDirectory />);
    await waitFor(() => screen.getByRole('button', { name: 'Follow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(followRemoteActor).toHaveBeenCalledWith('https://a.example/ap/organizations/a')
    );
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('success', {
        title: 'Follow sent',
        text: 'Follow request sent to Alpha Vet Clinic.',
      })
    );
  });

  it('notifies error when following a clinic fails', async () => {
    (listDirectory as jest.Mock).mockResolvedValue({ clinics: [clinicA], unavailable: false });
    (followRemoteActor as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    render(<NetworkDirectory />);
    await waitFor(() => screen.getByRole('button', { name: 'Follow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Follow failed',
        text: 'Could not send follow request.',
      })
    );
  });
});
