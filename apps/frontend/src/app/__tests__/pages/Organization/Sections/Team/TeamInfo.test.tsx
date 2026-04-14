import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import {
  getProfileForUserForPrimaryOrg,
  removeMember,
  updateMember,
} from '@/app/features/organization/services/teamService';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import { upsertTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { useNotify } from '@/app/hooks/useNotify';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';
import { hasAtLeastOneAvailability } from '@/app/features/appointments/components/Availability/utils';

const editableSavePayloads: Record<string, any> = {};
const availabilitySetterSpy = jest.fn();
const notifyMock = jest.fn();
const refetchMock = jest.fn();
const primaryOrgMembership = {
  membership: {
    practitionerReference: 'Practitioner/prac-1',
  },
};
const mockProfileResponse = {
  profile: {
    _id: 'profile-1',
    personalDetails: {
      employmentType: 'FULL_TIME',
      gender: 'MALE',
      dateOfBirth: '1990-01-01',
      phoneNumber: '1234567890',
      address: {
        country: 'India',
        addressLine: 'Street 1',
        state: 'MH',
        city: 'Mumbai',
        postalCode: '400001',
      },
    },
    professionalDetails: {
      linkedin: 'https://example.com/in',
      medicalLicenseNumber: 'LIC-1',
      yearsOfExperience: '5',
      specialization: 'Surgery',
      qualification: 'DVM',
      biography: 'Bio',
    },
  },
  baseAvailability: [
    {
      dayOfWeek: 'MONDAY',
      slots: [{ startTime: '09:00', endTime: '17:00', isAvailable: true }],
    },
  ],
};
const convertedAvailability = [{ dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00' }] }];

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, showEditIcon, onSave, data }: any) => (
    <div data-testid={`editable-${title}`}>
      <div>{title}</div>
      <div>{JSON.stringify(data)}</div>
      {showEditIcon ? (
        <button type="button" onClick={() => onSave(editableSavePayloads[title] ?? {})}>
          {`save-${title}`}
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('@/app/features/appointments/components/Availability/Availability', () => ({
  __esModule: true,
  default: ({ readOnly, setAvailability }: any) => (
    <div>
      <div>{readOnly ? 'availability-readonly' : 'availability-editable'}</div>
      <button
        type="button"
        onClick={() => {
          availabilitySetterSpy();
          setAvailability({
            Monday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Tuesday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Wednesday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Thursday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Friday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Saturday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
            Sunday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
          });
        }}
      >
        clear-availability
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={onClose}>
        close-delete-modal
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Team/PermissionsEditor', () => ({
  __esModule: true,
  computeEffectivePermissions: jest.fn(() => ['TEAM_VIEW']),
  default: ({ onSave }: any) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          extraPerissions: ['TEAM_EDIT'],
          revokedPermissions: ['TEAM_DELETE'],
        })
      }
    >
      save-permissions
    </button>
  ),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  getProfileForUserForPrimaryOrg: jest.fn(),
  removeMember: jest.fn(),
  updateMember: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrgWithMembership: jest.fn(),
}));

jest.mock('react-icons/md', () => ({
  MdDeleteForever: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      delete-icon
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/hooks/useStripeOnboarding', () => ({
  useSubscriptionCounterUpdate: jest.fn(),
}));

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  upsertTeamAvailability: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  upsertUserProfile: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  AvailabilityState: {},
  DEFAULT_INTERVAL: { start: '09:00', end: '17:00' },
  daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  convertAvailability: jest.fn(() => convertedAvailability),
  convertFromGetApi: jest.fn(() => ({
    Monday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
    Tuesday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
    Wednesday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
    Thursday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
    Friday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
    Saturday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
    Sunday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
  })),
  hasAtLeastOneAvailability: jest.fn(() => true),
}));

describe('TeamInfo', () => {
  const setShowModal = jest.fn();
  const activeTeam = {
    _id: 'team-1',
    practionerId: 'Practitioner/prac-1',
    name: 'Dr Vet',
    role: 'ADMIN',
    speciality: [{ _id: 'spec-1', name: 'Surgery' }],
    effectivePermissions: ['TEAM_VIEW'],
    extraPerissions: [],
    revokedPermissions: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    availabilitySetterSpy.mockClear();
    Object.keys(editableSavePayloads).forEach((key) => delete editableSavePayloads[key]);
    setShowModal.mockClear();

    (getProfileForUserForPrimaryOrg as jest.Mock).mockResolvedValue(mockProfileResponse);
    (removeMember as jest.Mock).mockResolvedValue(undefined);
    (updateMember as jest.Mock).mockResolvedValue(undefined);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'spec-1', name: 'Surgery' },
      { _id: 'spec-2', name: 'Dental' },
    ]);
    (usePrimaryOrgWithMembership as jest.Mock).mockReturnValue(primaryOrgMembership);
    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch: refetchMock });
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (upsertTeamAvailability as jest.Mock).mockResolvedValue(undefined);
    (upsertUserProfile as jest.Mock).mockResolvedValue(undefined);
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
  });

  it('loads the member profile and closes the modal', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await waitFor(() => {
      expect(getProfileForUserForPrimaryOrg).toHaveBeenCalledWith('Practitioner/prac-1');
    });

    expect(screen.getByText('Dr Vet')).toBeInTheDocument();
    expect(screen.getByText('availability-editable')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'close' })[1]);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('hides delete controls for owners', async () => {
    render(
      <TeamInfo
        showModal
        setShowModal={setShowModal}
        activeTeam={{ ...activeTeam, role: 'OWNER' }}
        canEditTeam={true}
      />
    );

    await screen.findByText(/FULL_TIME/);
    expect(screen.queryByRole('button', { name: 'delete-icon' })).not.toBeInTheDocument();
  });

  it('deletes a member and closes both modals on success', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'delete-icon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(removeMember).toHaveBeenCalledWith(activeTeam);
    });
    expect(refetchMock).toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Team member deleted' })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('shows an error notification when delete fails', async () => {
    (removeMember as jest.Mock).mockRejectedValue(new Error('delete failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'delete-icon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to delete team member' })
      );
    });
  });

  it('saves org details and employment type for the current member', async () => {
    editableSavePayloads['Org details'] = {
      role: 'OWNER',
      employmentType: 'PART_TIME',
    };

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    await screen.findByRole('button', { name: 'save-Org details' });
    fireEvent.click(screen.getByRole('button', { name: 'save-Org details' }));

    await waitFor(() => {
      expect(updateMember).toHaveBeenCalledWith(expect.objectContaining({ role: 'OWNER' }));
    });
    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'profile-1',
        personalDetails: expect.objectContaining({ employmentType: 'PART_TIME' }),
      })
    );
    expect(refetchMock).toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Team member updated' })
    );
  });

  it('shows an error notification when member update fails', async () => {
    editableSavePayloads['Org details'] = {
      role: 'OWNER',
      employmentType: 'PART_TIME',
    };
    (updateMember as jest.Mock).mockRejectedValue(new Error('update failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'save-Org details' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update team member' })
      );
    });
  });

  it('saves permissions and reports success', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'save-permissions' }));

    await waitFor(() => {
      expect(updateMember).toHaveBeenCalledWith(
        expect.objectContaining({
          extraPerissions: ['TEAM_EDIT'],
          revokedPermissions: ['TEAM_DELETE'],
        })
      );
    });
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Team member updated' })
    );
  });

  it('shows an error notification when permissions update fails', async () => {
    (updateMember as jest.Mock).mockRejectedValue(new Error('permissions failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'save-permissions' }));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update permissions' })
      );
    });
  });

  it('saves availability for the current member', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByRole('button', { name: 'Save availability' }));

    await waitFor(() => {
      expect(upsertTeamAvailability).toHaveBeenCalledWith(activeTeam, convertedAvailability, null);
    });
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Team member updated' })
    );
  });

  it('does not save availability when none is selected', async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(screen.getByRole('button', { name: 'clear-availability' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(upsertTeamAvailability).not.toHaveBeenCalled();
    });
    expect(consoleSpy).toHaveBeenCalledWith('No availability selected');
    consoleSpy.mockRestore();
  });
});
