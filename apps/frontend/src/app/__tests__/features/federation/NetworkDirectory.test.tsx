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
    let resolve: (value: APDirectoryClinic[]) => void = () => {};
    (listDirectory as jest.Mock).mockReturnValue(
      new Promise<APDirectoryClinic[]>((r) => {
        resolve = r;
      })
    );

    render(<NetworkDirectory />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await act(async () => {
      resolve([]);
    });
  });

  it('shows the empty state when no clinics are listed', async () => {
    (listDirectory as jest.Mock).mockResolvedValue([]);
    render(<NetworkDirectory />);
    await waitFor(() =>
      expect(screen.getByText('No clinics are listed in the directory yet.')).toBeInTheDocument()
    );
  });

  it('renders clinic cards with name, handle, and host', async () => {
    (listDirectory as jest.Mock).mockResolvedValue([clinicA, clinicB]);
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
    expect(screen.getByText('No clinics are listed in the directory yet.')).toBeInTheDocument();
  });

  it('follows a clinic and notifies success', async () => {
    (listDirectory as jest.Mock).mockResolvedValue([clinicA]);
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
    (listDirectory as jest.Mock).mockResolvedValue([clinicA]);
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
