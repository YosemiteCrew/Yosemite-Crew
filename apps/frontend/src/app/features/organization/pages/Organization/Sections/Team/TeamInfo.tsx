import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import {
  AvailabilityState,
  convertAvailability,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Team } from '@/app/features/organization/types/team';
import React, { useEffect, useMemo, useState, startTransition } from 'react';
import PermissionsEditor from '@/app/features/organization/pages/Organization/Sections/Team/PermissionsEditor';
import { computeEffectivePermissions } from '@/app/features/organization/pages/Organization/Sections/Team/permissionsEditorUtils';
import { Permission, RoleCode } from '@/app/lib/permissions';
import {
  getProfileForUserForPrimaryOrg,
  removeMember,
  updateMember,
} from '@/app/features/organization/services/teamService';
import { RoleOptions } from '@/app/features/organization/pages/Organization/types';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import {
  UserEmploymentTypeOptions,
  UserGenderOptions,
  UserProfile,
} from '@/app/features/users/types/profile';
import { Primary } from '@/app/ui/primitives/Buttons';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import { upsertTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { useNotify } from '@/app/hooks/useNotify';
import { logger } from '@/app/lib/logger';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';
import { IoTrash } from 'react-icons/io5';

type TeamInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTeam: Team;
  canEditTeam: boolean;
};

const getFields = ({
  SpecialitiesOptions,
  activeTeam,
  canEditRole,
  canEditEmploymentType,
  canEditDepartment,
}: {
  SpecialitiesOptions: { label: string; value: string }[];
  activeTeam: Team;
  canEditRole: boolean;
  canEditEmploymentType: boolean;
  canEditDepartment: boolean;
}) =>
  [
    {
      label: 'Role',
      key: 'role',
      type: 'select',
      options: activeTeam.role === 'OWNER' ? RoleOptions : RoleOptions.slice(1),
      editable: canEditRole,
    },
    {
      label: 'Employment type',
      key: 'employmentType',
      type: 'select',
      // personalDetails is a user profile, so it takes the profile enums. The
      // invite-facing EmploymentTypes ('CONTRACTOR') and the pet GenderOptions
      // ('OTHERS') look interchangeable but the API rejects both.
      options: UserEmploymentTypeOptions,
      editable: canEditEmploymentType,
    },
    {
      label: 'Department',
      key: 'speciality',
      type: 'multiSelect',
      options: SpecialitiesOptions,
      editable: canEditDepartment,
    },
  ] satisfies FieldConfig[];

const PersonalFields = [
  { label: 'Name', key: 'name', type: 'text' },
  { label: 'Gender', key: 'gender', type: 'select', options: UserGenderOptions },
  { label: 'Date of birth', key: 'dateOfBirth', type: 'date' },
  { label: 'Country', key: 'country', type: 'country' },
  { label: 'Phone number', key: 'phoneNumber', type: 'text' },
];

const AddressFields = [
  { label: 'Address', key: 'addressLine', type: 'googleAddress', editable: true },
  { label: 'State/Province', key: 'state', type: 'text', editable: true },
  { label: 'City', key: 'city', type: 'text', editable: true },
  { label: 'Postal code', key: 'postalCode', type: 'text', editable: true },
];

const ProfessionalFields = [
  { label: 'LinkedIn', key: 'linkedin', type: 'text' },
  { label: 'Medical license number', key: 'licenseNumber', type: 'text' },
  { label: 'Years of experience', key: 'experience', type: 'text' },
  { label: 'Specialisation', key: 'specialisation', type: 'text' },
  {
    label: 'Qualification (MBBS, MD, etc.)',
    key: 'qulaification',
    type: 'text',
  },
  { label: 'Biography or short description', key: 'description', type: 'text' },
];

const normalizeId = (value?: string) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

/**
 * The member's working hours: the editable grid, the in-flight flag and the
 * save. Seeded by the profile fetch in the panel, which is why setAvailability
 * is returned rather than kept private.
 */
const useTeamAvailability = ({
  activeTeam,
  notify,
}: {
  activeTeam: Team;
  notify: ReturnType<typeof useNotify>['notify'];
}) => {
  const [availability, setAvailability] = useState<AvailabilityState>(() =>
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === 'Monday' ||
        day === 'Tuesday' ||
        day === 'Wednesday' ||
        day === 'Thursday' ||
        day === 'Friday';

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  const updateAvailability = async () => {
    if (isSavingAvailability) return;
    try {
      startTransition(() => setIsSavingAvailability(true));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        logger.warn('Skipped availability save: no availability selected');
        return;
      }
      await upsertTeamAvailability(activeTeam, converted, null);
      notify('success', {
        title: 'Team member updated',
        text: 'Team member has been updated successfully.',
      });
    } catch (error) {
      logger.error('Failed to save team availability', error);
      notify('error', {
        title: 'Unable to update availability',
        text: 'Failed to update availability. Please try again.',
      });
    } finally {
      setIsSavingAvailability(false);
    }
  };

  return { availability, setAvailability, isSavingAvailability, updateAvailability };
};

/**
 * The three editable profile sections. Each reads its slice of the fetched
 * profile and writes it back through one shared save, so the sections stay
 * together and out of the panel body.
 */
const useTeamProfileSections = ({
  profile,
  setProfile,
  activeTeam,
  notify,
}: {
  profile: any;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  activeTeam: Team;
  notify: ReturnType<typeof useNotify>['notify'];
}) => {
  const personalInfoData = useMemo(
    () => ({
      name: activeTeam?.name ?? '',
      gender: profile?.profile?.personalDetails?.gender ?? '',
      dateOfBirth: profile?.profile?.personalDetails?.dateOfBirth ?? '',
      phoneNumber: profile?.profile?.personalDetails?.phoneNumber ?? '',
      country: profile?.profile?.personalDetails?.address?.country ?? '',
    }),
    [profile, activeTeam]
  );

  const addressInfoData = useMemo(
    () => ({
      addressLine: profile?.profile?.personalDetails?.address?.addressLine ?? '',
      state: profile?.profile?.personalDetails?.address?.state ?? '',
      city: profile?.profile?.personalDetails?.address?.city ?? '',
      postalCode: profile?.profile?.personalDetails?.address?.postalCode ?? '',
    }),
    [profile]
  );

  const professionalInfoData = useMemo(
    () => ({
      linkedin: profile?.profile?.professionalDetails?.linkedin ?? '',
      licenseNumber: profile?.profile?.professionalDetails?.medicalLicenseNumber ?? '',
      experience: profile?.profile?.professionalDetails?.yearsOfExperience ?? '',
      specialisation: profile?.profile?.professionalDetails?.specialization ?? '',
      qulaification: profile?.profile?.professionalDetails?.qualification ?? '',
      description: profile?.profile?.professionalDetails?.biography ?? '',
    }),
    [profile]
  );

  const saveProfileSection = async ({
    buildPayload,
    messages,
  }: {
    buildPayload: (current: UserProfile) => UserProfile;
    messages: {
      successTitle: string;
      successText: string;
      errorTitle: string;
      errorText: string;
    };
  }) => {
    try {
      if (!profile?.profile) return;
      const payload = buildPayload(profile.profile);
      await upsertUserProfile(payload);
      setProfile((prev: any) => ({
        ...prev,
        profile: payload,
      }));
      notify('success', { title: messages.successTitle, text: messages.successText });
    } catch (error) {
      logger.error('Failed to save a team member profile section', error);
      notify('error', { title: messages.errorTitle, text: messages.errorText });
    }
  };

  const handleAddressSave = (values: any) =>
    saveProfileSection({
      buildPayload: (current) => ({
        ...current,
        _id: current._id,
        personalDetails: {
          ...current.personalDetails,
          address: {
            ...current.personalDetails?.address,
            addressLine: values.addressLine,
            state: values.state,
            city: values.city,
            postalCode: values.postalCode,
          },
        },
      }),
      messages: {
        successTitle: 'Address updated',
        successText: 'Address details have been updated successfully.',
        errorTitle: 'Unable to update address',
        errorText: 'Failed to update address details. Please try again.',
      },
    });

  const handlePersonalSave = (values: any) =>
    saveProfileSection({
      buildPayload: (current) => ({
        ...current,
        _id: current._id,
        personalDetails: {
          ...current.personalDetails,
          gender: values.gender,
          dateOfBirth: values.dateOfBirth,
          phoneNumber: values.phoneNumber,
          address: {
            ...current.personalDetails?.address,
            country: values.country,
          },
        },
      }),
      messages: {
        successTitle: 'Personal details updated',
        successText: 'Personal details have been updated successfully.',
        errorTitle: 'Unable to update personal details',
        errorText: 'Failed to update personal details. Please try again.',
      },
    });

  const handleProfessionalSave = (values: any) =>
    saveProfileSection({
      buildPayload: (current) => ({
        ...current,
        _id: current._id,
        professionalDetails: {
          ...current.professionalDetails,
          linkedin: values.linkedin,
          medicalLicenseNumber: values.licenseNumber,
          yearsOfExperience: values.experience,
          specialization: values.specialisation,
          qualification: values.qulaification,
          biography: values.description,
        },
      }),
      messages: {
        successTitle: 'Professional details updated',
        successText: 'Professional details have been updated successfully.',
        errorTitle: 'Unable to update professional details',
        errorText: 'Failed to update professional details. Please try again.',
      },
    });

  return {
    personalInfoData,
    addressInfoData,
    professionalInfoData,
    handleAddressSave,
    handlePersonalSave,
    handleProfessionalSave,
  };
};

/**
 * Mutations against the membership record itself - removal and permissions -
 * together with the confirm-dialog and optimistic-permission state they own.
 * Profile edits live in useTeamProfileSections; these never touch the profile.
 */
const useTeamMemberAdmin = ({
  activeTeam,
  activeTeamId,
  role,
  notify,
  refetchData,
  setShowModal,
}: {
  activeTeam: Team;
  activeTeamId: string;
  role: RoleCode;
  notify: ReturnType<typeof useNotify>['notify'];
  refetchData: () => Promise<unknown>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [permissionOverride, setPermissionOverride] = React.useState<{
    teamId: string;
    permissions: Permission[];
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const perms =
    permissionOverride?.teamId === activeTeamId
      ? permissionOverride.permissions
      : activeTeam.effectivePermissions;

  const handleDelete = async () => {
    try {
      await removeMember(activeTeam);
      await refetchData();
      notify('success', {
        title: 'Team member deleted',
        text: 'Team member has been deleted successfully.',
      });
      setShowDeleteModal(false);
      setShowModal(false);
    } catch (error) {
      logger.error('Failed to remove a team member', error);
      notify('error', {
        title: 'Unable to delete team member',
        text: 'Failed to delete team member. Please try again.',
      });
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handlePermUpdate = async ({
    extraPerissions,
    revokedPermissions,
  }: {
    extraPerissions: Permission[];
    revokedPermissions: Permission[];
  }) => {
    try {
      const member: Team = {
        ...activeTeam,
        extraPerissions,
        revokedPermissions,
      };
      await updateMember(member);
      setPermissionOverride({
        teamId: activeTeamId,
        permissions: computeEffectivePermissions({
          role,
          extraPerissions,
          revokedPermissions,
        }),
      });
      notify('success', {
        title: 'Team member updated',
        text: 'Team member has been updated successfully.',
      });
    } catch (error) {
      logger.error('Failed to update team member permissions', error);
      notify('error', {
        title: 'Unable to update permissions',
        text: 'Failed to update permissions. Please try again.',
      });
    }
  };

  return {
    showDeleteModal,
    setShowDeleteModal,
    perms,
    handleDelete,
    handleDeleteCancel,
    handlePermUpdate,
  };
};

/**
 * What the signed-in viewer may edit on this member. Ownership and self-service
 * are the only two axes: an OWNER's role is immutable, and a person's own
 * profile is theirs alone to change even when they cannot manage the team.
 */
const useTeamMemberPermissions = ({
  activeTeam,
  canEditTeam,
  membership,
}: {
  activeTeam: Team;
  canEditTeam: boolean;
  membership: ReturnType<typeof usePrimaryOrgWithMembership>['membership'];
}) => {
  const isSelfMember =
    normalizeId(activeTeam?.practionerId) === normalizeId(membership?.practitionerReference) ||
    normalizeId(activeTeam?._id) === normalizeId(membership?.id);
  const canEditMutableMember = canEditTeam && activeTeam.role !== 'OWNER';
  const canEditRole = canEditTeam && activeTeam.role !== 'OWNER';
  // Employment type can be set by team managers OR by the member themselves
  const canEditEmploymentType = isSelfMember || canEditMutableMember;
  const canEditDepartment = false;
  // Personal profile fields are self-only — team managers cannot edit another person's profile
  const canEditPersonal = isSelfMember;
  const canEditAddress = isSelfMember;
  const canEditProfessional = isSelfMember;
  const canEditAvailability = isSelfMember;
  const canEditOrgDetails = canEditRole || canEditEmploymentType || canEditDepartment;
  const canDeleteMember = canEditTeam && activeTeam.role !== 'OWNER';
  const role = activeTeam.role as RoleCode;

  return {
    isSelfMember,
    canEditRole,
    canEditEmploymentType,
    canEditDepartment,
    canEditPersonal,
    canEditAddress,
    canEditProfessional,
    canEditAvailability,
    canEditOrgDetails,
    canDeleteMember,
    role,
  };
};

/**
 * The member's stored record: the profile fetched when the panel opens, the
 * org-details view of it, and the save that writes role and employment type
 * back. Seeds the availability grid from the same response, which is why it
 * takes setAvailability.
 */
const useTeamMemberRecord = ({
  activeTeam,
  showModal,
  canEditRole,
  canEditEmploymentType,
  notify,
  refetchData,
  setAvailability,
}: {
  activeTeam: Team;
  showModal: boolean;
  canEditRole: boolean;
  canEditEmploymentType: boolean;
  notify: ReturnType<typeof useNotify>['notify'];
  refetchData: () => Promise<unknown>;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityState>>;
}) => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const userId = activeTeam.practionerId;
    if (!showModal || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfileForUserForPrimaryOrg(userId);
        if (!cancelled) {
          setProfile(data);
          if (data) {
            const { baseAvailability } = data as { baseAvailability?: unknown };
            setAvailability(
              convertFromGetApi(Array.isArray(baseAvailability) ? baseAvailability : [])
            );
          }
        }
      } catch {
        setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, activeTeam, setAvailability]);

  const orgInfoData = useMemo(
    () => ({
      role: activeTeam?.role ?? '',
      // The org/mapping API returns raw specialities without a matching `_id`
      // (see Speciality._id), so fall back to the name we already have inline
      // rather than showing an unresolved, blank comma-joined list.
      speciality: activeTeam?.speciality.map((s) => s._id || s.name) ?? '',
      employmentType: profile?.profile?.personalDetails?.employmentType ?? '',
    }),
    [profile, activeTeam]
  );

  const handleMappingUpdate = async (values: any) => {
    try {
      if (canEditRole && values.role && values.role !== activeTeam.role) {
        const member: Team = {
          ...activeTeam,
          role: values.role,
        };
        await updateMember(member);
      }

      if (canEditEmploymentType && profile?.profile) {
        const nextEmploymentType = values.employmentType || '';
        const currentEmploymentType = profile.profile.personalDetails?.employmentType || '';
        if (nextEmploymentType !== currentEmploymentType) {
          const payload: UserProfile = {
            ...profile.profile,
            _id: profile.profile?._id,
            personalDetails: {
              ...profile.profile.personalDetails,
              employmentType: nextEmploymentType,
            },
          };
          await upsertUserProfile(payload);
        }
      }

      await refetchData();
      notify('success', {
        title: 'Team member updated',
        text: 'Team member has been updated successfully.',
      });
    } catch (error) {
      logger.error('Failed to update a team member mapping', error);
      notify('error', {
        title: 'Unable to update team member',
        text: 'Failed to update team member. Please try again.',
      });
    }
  };

  return { profile, setProfile, orgInfoData, handleMappingUpdate };
};

const useTeamInfoContent = ({
  showModal,
  setShowModal,
  activeTeam,
  canEditTeam,
}: TeamInfoProps) => {
  const specialities = useSpecialitiesForPrimaryOrg();
  const { membership } = usePrimaryOrgWithMembership();
  const { notify } = useNotify();
  const { refetch: refetchData } = useSubscriptionCounterUpdate();
  const {
    canEditRole,
    canEditEmploymentType,
    canEditDepartment,
    canEditPersonal,
    canEditAddress,
    canEditProfessional,
    canEditAvailability,
    canEditOrgDetails,
    canDeleteMember,
    role,
  } = useTeamMemberPermissions({ activeTeam, canEditTeam, membership });
  const {
    showDeleteModal,
    setShowDeleteModal,
    perms,
    handleDelete,
    handleDeleteCancel,
    handlePermUpdate,
  } = useTeamMemberAdmin({
    activeTeam,
    activeTeamId: activeTeam._id ?? '',
    role: activeTeam.role as RoleCode,
    notify,
    refetchData,
    setShowModal,
  });
  const { availability, setAvailability, isSavingAvailability, updateAvailability } =
    useTeamAvailability({ activeTeam, notify });
  const { profile, setProfile, orgInfoData, handleMappingUpdate } = useTeamMemberRecord({
    activeTeam,
    showModal,
    canEditRole,
    canEditEmploymentType,
    notify,
    refetchData,
    setAvailability,
  });

  const {
    personalInfoData,
    addressInfoData,
    professionalInfoData,
    handleAddressSave,
    handlePersonalSave,
    handleProfessionalSave,
  } = useTeamProfileSections({ profile, setProfile, activeTeam, notify });

  const SpecialitiesOptions = useMemo(
    () => specialities.map((s) => ({ label: s.name, value: s._id || s.name })),
    [specialities]
  );

  const fields = useMemo(
    () =>
      getFields({
        SpecialitiesOptions,
        activeTeam,
        canEditRole,
        canEditEmploymentType,
        canEditDepartment,
      }),
    [SpecialitiesOptions, activeTeam, canEditRole, canEditEmploymentType, canEditDepartment]
  );

  const handleModalVisibility: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    setShowModal(value);
    if (value === false) {
      setShowDeleteModal(false);
    }
  };

  /**
   * The three profile sections save identically - patch one subtree of the
   * stored profile, upsert, mirror it back into local state, notify - and
   * differ only in the patch and the wording, so they share one body.
   */

  return (
    <>
      <Modal showModal={showModal} setShowModal={handleModalVisibility}>
        <div className="flex flex-col h-full gap-6">
          <ModalHeader
            eyebrow="Team member"
            title={activeTeam.name || 'View team'}
            meta={RoleOptions.find((option) => option.value === activeTeam.role)?.label}
            onClose={() => setShowModal(false)}
            actions={
              canDeleteMember && (
                <button
                  type="button"
                  aria-label="Delete team member"
                  onClick={() => setShowDeleteModal(true)}
                  className="grid size-8 cursor-pointer place-items-center rounded-full border border-transparent hover:border-danger-600"
                >
                  <IoTrash size={18} color="var(--color-danger-600)" />
                </button>
              )
            }
          />
          <div className="flex flex-col gap-8 overflow-y-auto flex-1 w-full scrollbar-hidden">
            <EditableAccordion
              title="Org details"
              fields={fields}
              data={orgInfoData}
              defaultOpen={true}
              showEditIcon={canEditOrgDetails}
              onSave={handleMappingUpdate}
            />
            <EditableAccordion
              title="Personal details"
              fields={PersonalFields}
              data={personalInfoData}
              defaultOpen={true}
              showEditIcon={canEditPersonal}
              onSave={canEditPersonal ? handlePersonalSave : undefined}
            />
            <EditableAccordion
              title="Address details"
              fields={AddressFields}
              data={addressInfoData}
              defaultOpen={false}
              showEditIcon={canEditAddress}
              onSave={canEditAddress ? handleAddressSave : undefined}
            />
            <EditableAccordion
              title="Professional details"
              fields={ProfessionalFields}
              data={professionalInfoData}
              defaultOpen={false}
              showEditIcon={canEditProfessional}
              onSave={canEditProfessional ? handleProfessionalSave : undefined}
            />
            <Accordion
              title="Availability"
              defaultOpen={false}
              showEditIcon={false}
              isEditing={false}
            >
              <div className="flex flex-col w-full gap-3">
                <Availability
                  availability={availability}
                  setAvailability={setAvailability}
                  readOnly={!canEditAvailability}
                />
                {canEditAvailability && (
                  <div className="flex justify-end">
                    <Primary
                      href="#"
                      text={isSavingAvailability ? 'Saving availability...' : 'Save availability'}
                      onClick={updateAvailability}
                      className="w-auto min-w-45"
                      isDisabled={isSavingAvailability}
                    />
                  </div>
                )}
              </div>
            </Accordion>

            {role && perms && (
              <PermissionsEditor
                role={role}
                onSave={handlePermUpdate}
                value={perms}
                readOnly={!canEditTeam}
              />
            )}
          </div>
        </div>
      </Modal>
      {showDeleteModal && (
        <CenterModal
          showModal={showDeleteModal}
          setShowModal={setShowDeleteModal}
          onClose={handleDeleteCancel}
        >
          <ModalHeader title="Delete team member" onClose={handleDeleteCancel} />
          <div className="text-body-4 text-text-primary">
            Are you sure you want to delete{' '}
            <span className="text-body-4-emphasis"> {activeTeam.name}</span>? This action cannot be
            undone.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Secondary href="#" text="Cancel" onClick={handleDeleteCancel} />
            <Delete href="#" onClick={handleDelete} text="Delete" />
          </div>
        </CenterModal>
      )}
    </>
  );
};

const TeamInfo = (props: TeamInfoProps) => useTeamInfoContent(props);

export default TeamInfo;
