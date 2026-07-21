import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HoursEditModal from '@/app/features/settings/pages/Settings/Sections/HoursEditModal';
import * as availabilityUtils from '@/app/features/appointments/components/Availability/utils';

const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryAvailabilityMock = jest.fn();
const useAuthStoreMock = jest.fn();
const usePrimaryOrgIdMock = jest.fn();
const mockNotify = jest.fn();
const mockUpsertAvailability = jest.fn();
const mockUpsertTeamAvailability = jest.fn();
const mockGetProfileForUser = jest.fn();

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrgWithMembership: () => usePrimaryOrgWithMembershipMock(),
}));

jest.mock('@/app/hooks/useAvailabiities', () => ({
  usePrimaryAvailability: () => usePrimaryAvailabilityMock(),
}));

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  upsertAvailability: (...args: any[]) => mockUpsertAvailability(...args),
  upsertTeamAvailability: (...args: any[]) => mockUpsertTeamAvailability(...args),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  getProfileForUserForPrimaryOrg: (...args: any[]) => mockGetProfileForUser(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: usePrimaryOrgIdMock() }),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  ...jest.requireActual('@/app/features/appointments/components/Availability/utils'),
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
}));

// Render the modal shell as a plain wrapper so its content is directly testable.
jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close-x
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/appointments/components/Availability/Availability', () => ({
  __esModule: true,
  default: () => <div>Availability Editor</div>,
}));

const buildAvailability = () =>
  availabilityUtils.daysOfWeek.reduce((acc, day) => {
    acc[day] = {
      enabled: day === 'Monday',
      intervals: [{ ...availabilityUtils.DEFAULT_INTERVAL }],
    };
    return acc;
  }, {} as availabilityUtils.AvailabilityState);

const renderModal = () => {
  const setShowModal = jest.fn();
  const utils = render(<HoursEditModal showModal setShowModal={setShowModal} />);
  return { setShowModal, ...utils };
};

describe('Settings HoursEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: 'Taylor', family_name: 'Fox', email: 'tf@example.com' },
    });
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: 'Clinic' },
      membership: { roleDisplay: 'Admin' },
    });
    usePrimaryAvailabilityMock.mockReturnValue({ availabilities: buildAvailability() });
    usePrimaryOrgIdMock.mockReturnValue(null);
    mockUpsertAvailability.mockResolvedValue({});
    mockUpsertTeamAvailability.mockResolvedValue({});
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: [] });
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: 'Monday', intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
  });

  it('renders the availability editor chrome from the design', () => {
    renderModal();
    expect(screen.getByText('Availability & consultation hours')).toBeInTheDocument();
    expect(
      screen.getByText('Taylor Fox · drives booking slots and the team planner')
    ).toBeInTheDocument();
    expect(screen.getByText(/booking slots follow each service's duration/)).toBeInTheDocument();
    expect(screen.getByText('Availability Editor')).toBeInTheDocument();
  });

  // Auth attributes without a name -> the subtitle collapses to the trailing clause.
  it('drops the practitioner prefix from the subtitle when the user has no name', () => {
    useAuthStoreMock.mockReturnValue({ attributes: { email: 'tf@example.com' } });
    renderModal();
    expect(screen.getByText('drives booking slots and the team planner')).toBeInTheDocument();
  });

  it('saves availability for a non-practitioner and closes the modal', async () => {
    const { setShowModal } = renderModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });
    // The converted payload (not the raw state) is persisted with the trailing null arg.
    await waitFor(() =>
      expect(mockUpsertAvailability).toHaveBeenCalledWith([{ day: 'Monday', intervals: [] }], null)
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Availability updated' })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('skips saving when no availability is selected', async () => {
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const { setShowModal } = renderModal();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => expect(logSpy).toHaveBeenCalledWith('No availability selected'));
    expect(mockUpsertAvailability).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalledWith('success', expect.anything());
    expect(setShowModal).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('notifies an error when availability persistence throws', async () => {
    mockUpsertAvailability.mockRejectedValue(new Error('boom'));

    renderModal();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update availability details' })
      );
    });
  });

  it('loads and saves availability for a practitioner via upsertTeamAvailability', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-1', id: 'mem-1' },
    });
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: [] });

    renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-1'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(mockUpsertTeamAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'mem-1', practionerId: 'pr-1', organisationId: 'org-9' }),
        expect.anything(),
        null
      );
    });
  });

  it('prefers the selected primaryOrgId over the org record id for team availability', async () => {
    usePrimaryOrgIdMock.mockReturnValue('org-primary');
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-1', id: 'mem-1' },
    });
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: [] });

    renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-1'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(mockUpsertTeamAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: 'org-primary' }),
        expect.anything(),
        null
      );
    });
  });

  it('falls back to practitioner reference and empty org id when ids are missing', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-2' },
    });
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: [] });

    renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-2'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(mockUpsertTeamAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'pr-2', practionerId: 'pr-2', organisationId: '' }),
        expect.anything(),
        null
      );
    });
  });

  it('swallows a rejected practitioner fetch', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-err' },
    });
    mockGetProfileForUser.mockRejectedValue(new Error('boom'));

    renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-err'));
    expect(screen.getByText('Availability Editor')).toBeInTheDocument();
  });

  it('ignores a practitioner fetch that resolves after unmount', async () => {
    let resolveFetch!: (value: unknown) => void;
    mockGetProfileForUser.mockReturnValue(
      new Promise((res) => {
        resolveFetch = res;
      })
    );
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-late' },
    });

    const { unmount } = renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-late'));

    unmount();
    await act(async () => {
      resolveFetch({ baseAvailability: [] });
    });
    expect(mockGetProfileForUser).toHaveBeenCalledTimes(1);
  });

  it('handles a non-array baseAvailability from the practitioner fetch', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { roleDisplay: 'Vet', practitionerReference: 'pr-3' },
    });
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: 'not-an-array' });

    renderModal();
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-3'));
    expect(screen.getByText('Availability Editor')).toBeInTheDocument();
  });

  it('closes the modal from the Cancel button and the close icon', () => {
    const { setShowModal } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setShowModal).toHaveBeenCalledWith(false);

    setShowModal.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'close-x' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
