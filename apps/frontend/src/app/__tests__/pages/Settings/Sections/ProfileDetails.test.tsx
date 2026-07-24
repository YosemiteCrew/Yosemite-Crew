import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileDetails from '@/app/features/settings/pages/Settings/Sections/ProfileDetails';
import { updateUser } from '@/app/features/users/services/userService';
import { resolveTimezoneFromCountry, setPreferredTimeZone } from '@/app/lib/timezone';

const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAuthStoreMock = jest.fn();
const mockNotify = jest.fn();
const mockUpsertUserProfile = jest.fn();

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

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: (...args: any[]) => mockUpsertUserProfile(...args),
}));

jest.mock('@/app/lib/timezone', () => ({
  ...jest.requireActual('@/app/lib/timezone'),
  resolveTimezoneFromCountry: jest.fn(),
  setPreferredTimeZone: jest.fn(),
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

describe('Settings ProfileDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: 'Taylor', family_name: 'Fox', email: 'tf@example.com' },
    });
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: 'Clinic' },
      membership: { roleDisplay: 'Admin' },
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
    mockUpsertUserProfile.mockResolvedValue({});
    (updateUser as jest.Mock).mockResolvedValue({});
    (resolveTimezoneFromCountry as jest.Mock).mockReturnValue('Asia/Kolkata');
    (setPreferredTimeZone as jest.Mock).mockReturnValue(true);
  });

  it('renders nothing without org', () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: null, membership: null });
    const { container } = render(<ProfileDetails />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without attributes', () => {
    useAuthStoreMock.mockReturnValue({ attributes: null });
    const { container } = render(<ProfileDetails />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without membership', () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: { name: 'Clinic' }, membership: null });
    const { container } = render(<ProfileDetails />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the three profile cards', () => {
    render(<ProfileDetails />);
    expect(screen.getByText('User profile')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Professional details')).toBeInTheDocument();
  });

  it('updates the user org profile fields and syncs the resolved timezone', async () => {
    render(<ProfileDetails />);
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

    render(<ProfileDetails />);
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

    render(<ProfileDetails />);
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
    render(<ProfileDetails />);
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

    render(<ProfileDetails />);
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
    render(<ProfileDetails />);
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

    render(<ProfileDetails />);
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
    useAuthStoreMock.mockReturnValue({ attributes: { email: 'x@y.z' } });
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: { name: 'C' }, membership: {} });
    usePrimaryOrgProfileMock.mockReturnValue(null);

    render(<ProfileDetails />);

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
