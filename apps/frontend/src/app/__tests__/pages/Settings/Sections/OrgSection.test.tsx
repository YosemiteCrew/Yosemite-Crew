import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgSection from '@/app/features/settings/pages/Settings/Sections/OrgSection';
import * as availabilityUtils from '@/app/features/appointments/components/Availability/utils';
import { updateUser } from '@/app/features/users/services/userService';
import { resolveTimezoneFromCountry, setPreferredTimeZone } from '@/app/lib/timezone';

const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryAvailabilityMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAuthStoreMock = jest.fn();
const mockNotify = jest.fn();

const mockUpsertAvailability = jest.fn();
const mockUpsertTeamAvailability = jest.fn();
const mockUpsertUserProfile = jest.fn();
const mockGetProfileForUser = jest.fn();

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/features/users/services/userService', () => ({
  updateUser: jest.fn(),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrgWithMembership: () => usePrimaryOrgWithMembershipMock(),
  usePrimaryOrg: () => ({ name: 'Clinic' }),
}));

jest.mock('@/app/hooks/useAvailabiities', () => ({
  usePrimaryAvailability: () => usePrimaryAvailabilityMock(),
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  upsertAvailability: (...args: any[]) => mockUpsertAvailability(...args),
  upsertTeamAvailability: (...args: any[]) => mockUpsertTeamAvailability(...args),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: (...args: any[]) => mockUpsertUserProfile(...args),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  getProfileForUserForPrimaryOrg: (...args: any[]) => mockGetProfileForUser(...args),
}));

jest.mock('@/app/lib/timezone', () => ({
  ...jest.requireActual('@/app/lib/timezone'),
  resolveTimezoneFromCountry: jest.fn(),
  setPreferredTimeZone: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  ...jest.requireActual('@/app/features/appointments/components/Availability/utils'),
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

// ProfileCard mock exposes each card's onSave via a labelled button so the three
// field-save handlers can be exercised directly.
jest.mock('@/app/features/organization/pages/Organization/Sections/ProfileCard', () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      <div>{title}</div>
      <button
        type="button"
        onClick={() =>
          onSave?.({
            given_name: 'Sam',
            family_name: 'Doe',
            gender: 'female',
            dateOfBirth: '1990-05-05',
            phoneNumber: '555',
            country: 'India',
            addressLine: 'Line 1',
            state: 'ST',
            city: 'City',
            postalCode: '00000',
            linkedin: 'li',
            medicalLicenseNumber: 'ml',
            specialization: 'sp',
            qualification: 'q',
            biography: 'bio',
            yearsOfExperience: '9',
          })
        }
      >
        {`save-${title}`}
      </button>
    </div>
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

describe('Settings OrgSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: 'Taylor', family_name: 'Fox', email: 'tf@example.com' },
    });
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: 'Clinic' },
      membership: { roleDisplay: 'Admin' },
    });
    usePrimaryAvailabilityMock.mockReturnValue({
      availabilities: buildAvailability(),
    });
    usePrimaryOrgProfileMock.mockReturnValue({
      _id: 'profile-1',
      personalDetails: {
        employmentType: 'Full-time',
        gender: 'male',
        dateOfBirth: '2024-01-01',
        phoneNumber: '123',
        address: { country: 'USA', addressLine: 'A', state: 'S', city: 'C', postalCode: 'P' },
      },
      professionalDetails: { linkedin: 'x' },
    });
    mockUpsertAvailability.mockResolvedValue({});
    mockUpsertTeamAvailability.mockResolvedValue({});
    mockUpsertUserProfile.mockResolvedValue({});
    mockGetProfileForUser.mockResolvedValue({ baseAvailability: [] });
    (updateUser as jest.Mock).mockResolvedValue({});
    (resolveTimezoneFromCountry as jest.Mock).mockReturnValue('Asia/Kolkata');
    (setPreferredTimeZone as jest.Mock).mockReturnValue(true);
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: 'Monday', intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
  });

  it('renders nothing without org', () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: null, membership: null });

    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without attributes', () => {
    useAuthStoreMock.mockReturnValue({ attributes: null });

    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without membership', () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: { name: 'Clinic' }, membership: null });

    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('saves availability for a non-practitioner via upsertAvailability', async () => {
    render(<OrgSection />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => {
      expect(mockUpsertAvailability).toHaveBeenCalled();
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Availability updated' })
    );
  });

  it('skips saving when no availability is selected', async () => {
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(mockUpsertAvailability).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalledWith('success', expect.anything());
  });

  it('notifies an error when availability persistence throws', async () => {
    mockUpsertAvailability.mockRejectedValue(new Error('boom'));

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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

    render(<OrgSection />);

    // the practitioner effect fetches the base availability
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-1'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(mockUpsertTeamAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'mem-1',
          practionerId: 'pr-1',
          organisationId: 'org-9',
        }),
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

    render(<OrgSection />);
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-2'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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

    render(<OrgSection />);
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-err'));

    // the fetch's .catch(() => undefined) swallows the error; the card still renders
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

    const { unmount } = render(<OrgSection />);
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-late'));

    unmount(); // effect cleanup flips `cancelled` to true

    // resolving now hits the `if (cancelled) return` guard before setAvailability runs
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

    render(<OrgSection />);
    await waitFor(() => expect(mockGetProfileForUser).toHaveBeenCalledWith('pr-3'));

    // component still renders its availability card
    expect(screen.getByText('Availability Editor')).toBeInTheDocument();
  });

  it('updates the user org profile fields and syncs the resolved timezone', async () => {
    render(<OrgSection />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('Sam', 'Doe'));
    expect(mockUpsertUserProfile).toHaveBeenCalled();
    expect(resolveTimezoneFromCountry).toHaveBeenCalledWith('India');
    expect(setPreferredTimeZone).toHaveBeenCalledWith('Asia/Kolkata');
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Profile updated' })
    );
  });

  it('does not sync a timezone when the country cannot be resolved', async () => {
    (resolveTimezoneFromCountry as jest.Mock).mockReturnValue(null);

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });

    await waitFor(() => expect(mockUpsertUserProfile).toHaveBeenCalled());
    expect(setPreferredTimeZone).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Profile updated' })
    );
  });

  it('notifies an error when the user org profile update throws', async () => {
    (updateUser as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update profile' })
      );
    });
  });

  it('updates address fields', async () => {
    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Address' }));
    });

    await waitFor(() => expect(mockUpsertUserProfile).toHaveBeenCalled());
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Address details updated' })
    );
  });

  it('notifies an error when the address update throws', async () => {
    mockUpsertUserProfile.mockRejectedValue(new Error('boom'));

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Address' }));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update address details' })
      );
    });
  });

  it('updates professional fields', async () => {
    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));
    });

    await waitFor(() => expect(mockUpsertUserProfile).toHaveBeenCalled());
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Professional details updated' })
    );
  });

  it('notifies an error when the professional update throws', async () => {
    mockUpsertUserProfile.mockRejectedValue(new Error('boom'));

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update professional details' })
      );
    });
  });

  // profile null: the user-profile handler skips its `if (profile)` block (still notifies
  // success), and the address/professional handlers early-return via `if (!profile)`.
  // Minimal attributes/org/membership also exercise every `?? ''` fallback in the memos.
  it('handles an absent profile across all field-save handlers', async () => {
    useAuthStoreMock.mockReturnValue({ attributes: {} });
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: {}, membership: {} });
    usePrimaryOrgProfileMock.mockReturnValue(null);

    render(<OrgSection />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('Sam', 'Doe'));
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Profile updated' })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Address' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));
    });

    // both profile-guarded handlers returned early, so no profile upsert happened
    expect(mockUpsertUserProfile).not.toHaveBeenCalled();
  });
});
