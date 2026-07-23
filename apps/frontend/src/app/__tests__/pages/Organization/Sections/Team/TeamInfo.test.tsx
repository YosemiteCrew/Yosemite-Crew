import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  // `fields` is rendered as real <option> elements so tests can assert on the
  // option VALUES the component actually offers. Values live in the value
  // attribute, not in text, so they cannot collide with the findByText(/FULL_TIME/)
  // queries that read the `data` JSON above.
  default: ({ title, showEditIcon, onSave, data, fields }: any) => (
    <div data-testid={`editable-${title}`}>
      <div>{title}</div>
      <div>{JSON.stringify(data)}</div>
      {(fields ?? [])
        .filter((field: any) => Array.isArray(field.options))
        .map((field: any) => (
          <select
            key={field.key}
            aria-label={field.label}
            data-testid={`field-options-${field.key}`}
          >
            {field.options.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
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
  default: ({ title, meta, eyebrow, actions, onClose }: any) => (
    <div>
      {eyebrow && <div>{eyebrow}</div>}
      <div>{title}</div>
      {meta && <div>{meta}</div>}
      {actions}
      <button type="button" aria-label="close" onClick={onClose}>
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

jest.mock('react-icons/io5', () => {
  const cache: Record<string, any> = {};
  return new Proxy(
    { __esModule: true },
    {
      get: (_t, name) => {
        if (name === '__esModule') return true;
        const key = String(name);
        if (!cache[key]) {
          const Icon = (props: any) => <span data-testid={key} onClick={props.onClick} />;
          Icon.displayName = key;
          cache[key] = Icon;
        }
        return cache[key];
      },
    }
  );
});

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

const optionValuesFor = (accordionTitle: string, fieldKey: string) =>
  Array.from(
    within(screen.getByTestId(`editable-${accordionTitle}`))
      .getByTestId(`field-options-${fieldKey}`)
      .querySelectorAll('option')
  ).map((option) => option.value);

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

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
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
    expect(screen.queryByTestId('IoTrash')).not.toBeInTheDocument();
  });

  it('deletes a member and closes both modals on success', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByTestId('IoTrash'));
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
    fireEvent.click(await screen.findByTestId('IoTrash'));
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

  it('does not allow a team editor to edit address or availability of another member', async () => {
    render(
      <TeamInfo
        showModal
        setShowModal={setShowModal}
        activeTeam={{ ...activeTeam, practionerId: 'Practitioner/prac-2' }}
        canEditTeam={true}
      />
    );

    await screen.findByText(/FULL_TIME/);

    // Address and availability are read-only — no save/edit buttons present
    expect(screen.queryByRole('button', { name: 'save-Address details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save availability' })).not.toBeInTheDocument();
    expect(screen.queryByText('availability-editable')).not.toBeInTheDocument();

    // Sanity: no profile or availability mutations called
    expect(upsertUserProfile).not.toHaveBeenCalled();
    expect(upsertTeamAvailability).not.toHaveBeenCalled();
  });

  it('does not save availability when none is selected', async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);

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
    // The empty grid is a no-op, not a failure: nothing is saved and the user
    // is not told anything went wrong.
    expect(notifyMock).not.toHaveBeenCalledWith('error', expect.anything());
  });

  it('shows an error notification when saving availability fails', async () => {
    (upsertTeamAvailability as jest.Mock).mockRejectedValue(new Error('availability failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update availability' })
      );
    });
  });

  it('does not fetch the profile or open the modal when showModal is false', () => {
    render(
      <TeamInfo showModal={false} setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam />
    );

    expect(getProfileForUserForPrimaryOrg).not.toHaveBeenCalled();
    expect(screen.queryByText('View team')).not.toBeInTheDocument();
  });

  it('sets profile to null and skips mutations when the profile fetch rejects', async () => {
    (getProfileForUserForPrimaryOrg as jest.Mock).mockRejectedValue(new Error('fetch failed'));
    editableSavePayloads['Address details'] = { addressLine: 'x' };
    editableSavePayloads['Personal details'] = { gender: 'MALE' };
    editableSavePayloads['Professional details'] = { linkedin: 'y' };

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await waitFor(() => {
      expect(getProfileForUserForPrimaryOrg).toHaveBeenCalled();
    });
    // Flush the rejected promise so setProfile(null) settles inside act().
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'save-Address details' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-Personal details' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-Professional details' }));

    expect(upsertUserProfile).not.toHaveBeenCalled();
  });

  it('closes the delete modal when the delete is cancelled', async () => {
    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    fireEvent.click(await screen.findByTestId('IoTrash'));
    expect(screen.getByText('Delete team member')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete team member')).not.toBeInTheDocument();
  });

  it('saves address details for the current member', async () => {
    editableSavePayloads['Address details'] = {
      addressLine: 'New Street 5',
      state: 'CA',
      city: 'Los Angeles',
      postalCode: '90001',
    };

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const addressBtn = screen.getByRole('button', { name: 'save-Address details' });
    await act(async () => {
      fireEvent.click(addressBtn);
    });

    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'profile-1',
        personalDetails: expect.objectContaining({
          address: expect.objectContaining({
            addressLine: 'New Street 5',
            state: 'CA',
            city: 'Los Angeles',
            postalCode: '90001',
          }),
        }),
      })
    );
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Address updated' })
    );
  });

  it('shows an error notification when saving address fails', async () => {
    editableSavePayloads['Address details'] = { addressLine: 'New Street 5' };
    (upsertUserProfile as jest.Mock).mockRejectedValue(new Error('address failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const addressBtn = screen.getByRole('button', { name: 'save-Address details' });
    await act(async () => {
      fireEvent.click(addressBtn);
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update address' })
      );
    });
  });

  it('saves personal details for the current member', async () => {
    editableSavePayloads['Personal details'] = {
      gender: 'FEMALE',
      dateOfBirth: '1985-05-05',
      phoneNumber: '999888777',
      country: 'United States',
    };

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const personalBtn = screen.getByRole('button', { name: 'save-Personal details' });
    await act(async () => {
      fireEvent.click(personalBtn);
    });

    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'profile-1',
        personalDetails: expect.objectContaining({
          gender: 'FEMALE',
          dateOfBirth: '1985-05-05',
          phoneNumber: '999888777',
          address: expect.objectContaining({ country: 'United States' }),
        }),
      })
    );
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Personal details updated' })
    );
  });

  it('shows an error notification when saving personal details fails', async () => {
    editableSavePayloads['Personal details'] = { gender: 'FEMALE' };
    (upsertUserProfile as jest.Mock).mockRejectedValue(new Error('personal failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const personalBtn = screen.getByRole('button', { name: 'save-Personal details' });
    await act(async () => {
      fireEvent.click(personalBtn);
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update personal details' })
      );
    });
  });

  it('saves professional details for the current member', async () => {
    editableSavePayloads['Professional details'] = {
      linkedin: 'https://example.com/pro',
      licenseNumber: 'LIC-99',
      experience: '10',
      specialisation: 'Cardiology',
      qulaification: 'MD',
      description: 'Experienced vet',
    };

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const professionalBtn = screen.getByRole('button', { name: 'save-Professional details' });
    await act(async () => {
      fireEvent.click(professionalBtn);
    });

    expect(upsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'profile-1',
        professionalDetails: expect.objectContaining({
          linkedin: 'https://example.com/pro',
          medicalLicenseNumber: 'LIC-99',
          yearsOfExperience: '10',
          specialization: 'Cardiology',
          qualification: 'MD',
          biography: 'Experienced vet',
        }),
      })
    );
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Professional details updated' })
    );
  });

  it('shows an error notification when saving professional details fails', async () => {
    editableSavePayloads['Professional details'] = { linkedin: 'https://example.com/pro' };
    (upsertUserProfile as jest.Mock).mockRejectedValue(new Error('professional failed'));

    render(
      <TeamInfo showModal setShowModal={setShowModal} activeTeam={activeTeam} canEditTeam={true} />
    );

    await screen.findByText(/FULL_TIME/);
    const professionalBtn = screen.getByRole('button', { name: 'save-Professional details' });
    await act(async () => {
      fireEvent.click(professionalBtn);
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update professional details' })
      );
    });
  });

  // Regression guard: TeamInfo renders a USER PROFILE (profile.personalDetails), so both
  // selects must offer the profile enums from features/users/types/profile. The pet
  // GenderOptions ('OTHERS') and the invite-facing EmploymentTypes ('CONTRACTOR') look
  // interchangeable but the profile API rejects both values.
  //
  // These assertions deliberately target the DIVERGENT values. MALE, FEMALE, FULL_TIME and
  // PART_TIME are identical across the right and wrong lists — that overlap is the only
  // reason the rest of this suite stayed green while the wrong enums were wired up.
  describe('profile enum wiring', () => {
    it('offers the profile gender OTHER and never the pet gender OTHERS', async () => {
      render(
        <TeamInfo
          showModal
          setShowModal={setShowModal}
          activeTeam={activeTeam}
          canEditTeam={true}
        />
      );

      await screen.findByText(/FULL_TIME/);

      const genderValues = optionValuesFor('Personal details', 'gender');
      expect(genderValues).toContain('OTHER');
      expect(genderValues).not.toContain('OTHERS');
      expect(genderValues).toEqual(['MALE', 'FEMALE', 'OTHER']);
    });

    it('offers the profile employment type CONTRACT and never the invite-facing CONTRACTOR', async () => {
      render(
        <TeamInfo
          showModal
          setShowModal={setShowModal}
          activeTeam={activeTeam}
          canEditTeam={true}
        />
      );

      await screen.findByText(/FULL_TIME/);

      const employmentValues = optionValuesFor('Org details', 'employmentType');
      expect(employmentValues).toContain('CONTRACT');
      expect(employmentValues).not.toContain('CONTRACTOR');
      expect(employmentValues).toEqual(['FULL_TIME', 'PART_TIME', 'CONTRACT']);
    });

    // Both enums label this option 'Contract' — byte-identical. Only the value differs,
    // so any label-based assertion here would pass against the wrong enum.
    it('backs the Contract option with the CONTRACT value, not the identically labelled CONTRACTOR', async () => {
      render(
        <TeamInfo
          showModal
          setShowModal={setShowModal}
          activeTeam={activeTeam}
          canEditTeam={true}
        />
      );

      await screen.findByText(/FULL_TIME/);

      const contractOption = within(screen.getByTestId('editable-Org details')).getByRole(
        'option',
        {
          name: 'Contract',
        }
      );
      expect((contractOption as HTMLOptionElement).value).toBe('CONTRACT');
    });
  });
});
