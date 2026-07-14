import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgSection from '@/app/features/settings/pages/Settings/Sections/OrgSection';
import * as availabilityUtils from '@/app/features/appointments/components/Availability/utils';

const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryAvailabilityMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAuthStoreMock = jest.fn();

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
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

const upsertAvailabilityMock = jest.fn();

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  upsertAvailability: (...args: any[]) => upsertAvailabilityMock(...args),
  upsertTeamAvailability: jest.fn(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: jest.fn(),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  getProfileForUserForPrimaryOrg: jest.fn().mockResolvedValue({}),
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

jest.mock('@/app/features/organization/pages/Organization/Sections/ProfileCard', () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      {title}
      <button
        type="button"
        onClick={() =>
          onSave?.({
            given_name: 'Taylor',
            family_name: 'Fox',
            gender: 'female',
            dateOfBirth: '1990-05-05',
            phoneNumber: '999',
            country: 'India',
            addressLine: '1 Vet Way',
            state: 'CA',
            city: 'Fresno',
            postalCode: '93650',
            linkedin: 'in/taylor',
            medicalLicenseNumber: 'ML-1',
            specialization: 'Surgery',
            qualification: 'DVM',
            biography: 'Bio',
            yearsOfExperience: '8',
          })
        }
      >
        save-{title}
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
      personalDetails: {
        employmentType: 'Full-time',
        gender: 'male',
        dateOfBirth: '2024-01-01',
        phoneNumber: '123',
        address: { country: 'USA' },
      },
      professionalDetails: {},
    });
  });

  it('renders nothing without org', () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: null, membership: null });

    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('saves availability', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: 'Clinic' },
      membership: { roleDisplay: 'Admin' },
    });

    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: 'Monday', intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);

    render(<OrgSection />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => {
      expect(upsertAvailabilityMock).toHaveBeenCalled();
    });
  });

  it('does not save when no availability is selected', async () => {
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(upsertAvailabilityMock).not.toHaveBeenCalled();
  });

  it('notifies on availability save failure', async () => {
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: 'Monday', intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
    upsertAvailabilityMock.mockRejectedValueOnce(new Error('down'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('updates the user profile, address, and professional details from the profile cards', async () => {
    render(<OrgSection />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });
    const { updateUser } = jest.requireMock('@/app/features/users/services/userService');
    expect(updateUser).toHaveBeenCalledWith('Taylor', 'Fox');
    const { upsertUserProfile } = jest.requireMock(
      '@/app/features/organization/services/profileService'
    );
    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        personalDetails: expect.objectContaining({
          gender: 'female',
          dateOfBirth: '1990-05-05',
          phoneNumber: '999',
          address: expect.objectContaining({ country: 'India' }),
        }),
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Address' }));
    });
    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        personalDetails: expect.objectContaining({
          address: expect.objectContaining({
            addressLine: '1 Vet Way',
            state: 'CA',
            city: 'Fresno',
            postalCode: '93650',
          }),
        }),
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));
    });
    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        professionalDetails: expect.objectContaining({
          linkedin: 'in/taylor',
          medicalLicenseNumber: 'ML-1',
          specialization: 'Surgery',
          qualification: 'DVM',
          biography: 'Bio',
          yearsOfExperience: '8',
        }),
      })
    );
  });

  it('reports errors from each profile card save', async () => {
    const { upsertUserProfile } = jest.requireMock(
      '@/app/features/organization/services/profileService'
    );
    (upsertUserProfile as jest.Mock).mockRejectedValue(new Error('backend down'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    render(<OrgSection />);
    for (const label of ['save-User profile', 'save-Address', 'save-Professional details']) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: label }));
      });
    }

    expect(logSpy).toHaveBeenCalledTimes(3);
    logSpy.mockRestore();
    (upsertUserProfile as jest.Mock).mockReset();
  });

  it('skips address and professional saves when there is no profile', async () => {
    usePrimaryOrgProfileMock.mockReturnValue(null);
    const { upsertUserProfile } = jest.requireMock(
      '@/app/features/organization/services/profileService'
    );

    render(<OrgSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'save-Address' }));
      fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));
      fireEvent.click(screen.getByRole('button', { name: 'save-User profile' }));
    });

    expect(upsertUserProfile).not.toHaveBeenCalled();
  });

  it('loads and saves practitioner availability through the team route', async () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { _id: 'org-9', name: 'Clinic' },
      membership: { id: 'mem-1', roleDisplay: 'Vet', practitionerReference: 'prac-1' },
    });
    const { getProfileForUserForPrimaryOrg } = jest.requireMock(
      '@/app/features/organization/services/teamService'
    );
    (getProfileForUserForPrimaryOrg as jest.Mock).mockResolvedValue({
      baseAvailability: [{ day: 'MONDAY', slots: [] }],
    });
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: 'Monday', intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
    const { upsertTeamAvailability } = jest.requireMock(
      '@/app/features/organization/services/availabilityService'
    );

    render(<OrgSection />);
    await waitFor(() => {
      expect(getProfileForUserForPrimaryOrg).toHaveBeenCalledWith('prac-1');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(upsertTeamAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'mem-1', practionerId: 'prac-1' }),
        [{ day: 'Monday', intervals: [] }],
        null
      );
    });
    expect(upsertAvailabilityMock).not.toHaveBeenCalled();
  });
});
