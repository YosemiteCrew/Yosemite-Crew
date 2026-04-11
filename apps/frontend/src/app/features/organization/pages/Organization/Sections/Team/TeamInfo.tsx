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
import React, { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import PermissionsEditor, {
  computeEffectivePermissions,
} from '@/app/features/organization/pages/Organization/Sections/Team/PermissionsEditor';
import { Permission, RoleCode } from '@/app/lib/permissions';
import {
  getProfileForUserForPrimaryOrg,
  removeMember,
  updateMember,
} from '@/app/features/organization/services/teamService';
import Close from '@/app/ui/primitives/Icons/Close';
import { EmploymentTypes, RoleOptions } from '@/app/features/organization/pages/Organization/types';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { GenderOptions } from '@/app/features/companions/types/companion';
import { MdDeleteForever } from 'react-icons/md';
import { Primary } from '@/app/ui/primitives/Buttons';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import { upsertTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { useNotify } from '@/app/hooks/useNotify';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';
import { UserProfile } from '@/app/features/users/types/profile';

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
      options: EmploymentTypes,
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
  { label: 'Gender', key: 'gender', type: 'select', options: GenderOptions },
  { label: 'Date of birth', key: 'dateOfBirth', type: 'date' },
  { label: 'Country', key: 'country', type: 'country' },
  { label: 'Phone number', key: 'phoneNumber', type: 'text' },
];

const AddressFields = [
  { label: 'Address', key: 'addressLine', type: 'text' },
  { label: 'State/Province', key: 'state', type: 'text' },
  { label: 'City', key: 'city', type: 'text' },
  { label: 'Postal code', key: 'postalCode', type: 'text' },
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

const TeamInfo = ({ showModal, setShowModal, activeTeam, canEditTeam }: TeamInfoProps) => {
  const specialities = useSpecialitiesForPrimaryOrg();
  const { membership } = usePrimaryOrgWithMembership();
  const { notify } = useNotify();
  const { refetch: refetchData } = useSubscriptionCounterUpdate();
  const [perms, setPerms] = React.useState<Permission[]>([]);
  const [role, setRole] = useState<RoleCode | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>(
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

  const [profile, setProfile] = useState<any>(null);
  const lastAvailabilityLogKeyRef = React.useRef<string>('');

  const normalizeId = (value?: string) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

  const isSelfMember =
    normalizeId(activeTeam?.practionerId) === normalizeId(membership?.practitionerReference);
  const canEditRole = canEditTeam && activeTeam.role !== 'OWNER';
  const canEditEmploymentType = canEditTeam && isSelfMember;
  const canEditDepartment = false;
  const canEditAvailability = canEditTeam && isSelfMember;
  const canEditOrgDetails = canEditRole || canEditEmploymentType || canEditDepartment;

  useEffect(() => {
    if (activeTeam) {
      setPerms(activeTeam.effectivePermissions);
      setRole(activeTeam.role as RoleCode);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (profile) {
      const apiAvailability = Array.isArray(profile?.baseAvailability)
        ? profile.baseAvailability
        : [];
      const converted = convertFromGetApi(apiAvailability);
      setAvailability(converted);

      const logKey = `${activeTeam?._id || ''}:${JSON.stringify(apiAvailability)}`;
      if (lastAvailabilityLogKeyRef.current !== logKey) {
        lastAvailabilityLogKeyRef.current = logKey;
        console.log('[TeamInfo][ProfileAvailabilityDebug]', {
          memberName: activeTeam?.name,
          memberIds: {
            practionerId: activeTeam?.practionerId,
            _id: activeTeam?._id,
          },
          baseAvailability: apiAvailability,
        });
      }
    }
  }, [profile, activeTeam]);

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

  useEffect(() => {
    const userId = activeTeam.practionerId;
    if (!showModal || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfileForUserForPrimaryOrg(userId);
        if (!cancelled) setProfile(data);
      } catch {
        setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, activeTeam]);

  useEffect(() => {
    if (!showModal) {
      setShowDeleteModal(false);
    }
  }, [showModal]);

  const orgInfoData = useMemo(
    () => ({
      role: activeTeam?.role ?? '',
      speciality: activeTeam?.speciality.map((s) => s._id) ?? '',
      employmentType: profile?.profile?.personalDetails?.employmentType ?? '',
    }),
    [profile, activeTeam]
  );

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
      console.log(error);
      notify('error', {
        title: 'Unable to delete team member',
        text: 'Failed to delete team member. Please try again.',
      });
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

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
      console.log(error);
      notify('error', {
        title: 'Unable to update team member',
        text: 'Failed to update team member. Please try again.',
      });
    }
  };

  const handlePermUpdate = async ({
    extraPerissions,
    revokedPermissions,
  }: {
    extraPerissions: Permission[];
    revokedPermissions: Permission[];
  }) => {
    try {
      if (!role) {
        throw new Error('ROle undeifned');
      }
      const member: Team = {
        ...activeTeam,
        extraPerissions,
        revokedPermissions,
      };
      await updateMember(member);
      setPerms(
        computeEffectivePermissions({
          role,
          extraPerissions,
          revokedPermissions,
        })
      );
      notify('success', {
        title: 'Team member updated',
        text: 'Team member has been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update permissions',
        text: 'Failed to update permissions. Please try again.',
      });
    }
  };

  const updateAvailability = async () => {
    if (isSavingAvailability) return;
    try {
      flushSync(() => {
        setIsSavingAvailability(true);
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log('No availability selected');
        return;
      }
      await upsertTeamAvailability(activeTeam, converted, null);
      notify('success', {
        title: 'Team member updated',
        text: 'Team member has been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update availability',
        text: 'Failed to update availability. Please try again.',
      });
    } finally {
      setIsSavingAvailability(false);
    }
  };

  return (
    <>
      <Modal showModal={showModal} setShowModal={setShowModal}>
        <div className="flex flex-col h-full gap-6">
          <div className="flex justify-between items-center">
            <div className="opacity-0">
              <Close onClick={() => {}} />
            </div>
            <div className="flex justify-center items-center gap-2">
              <div className="text-body-1 text-text-primary">View team</div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>
          <div className="flex flex-col gap-8 overflow-y-auto flex-1 w-full scrollbar-hidden">
            <div className={`flex items-center gap-2`}>
              <div className="flex items-center justify-between w-full">
                <div className="text-body-2 text-text-primary">{activeTeam.name || '-'}</div>
                {canEditTeam && activeTeam.role !== 'OWNER' && (
                  <MdDeleteForever
                    className="cursor-pointer"
                    onClick={() => setShowDeleteModal(true)}
                    size={26}
                    color="#EA3729"
                  />
                )}
              </div>
            </div>
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
              showEditIcon={false}
            />
            <EditableAccordion
              title="Address details"
              fields={AddressFields}
              data={addressInfoData}
              defaultOpen={false}
              showEditIcon={false}
            />
            <EditableAccordion
              title="Professional details"
              fields={ProfessionalFields}
              data={professionalInfoData}
              defaultOpen={false}
              showEditIcon={false}
            />
            {canEditTeam && (
              <>
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
                          text={
                            isSavingAvailability ? 'Saving availability...' : 'Save availability'
                          }
                          onClick={updateAvailability}
                          className="w-auto min-w-45"
                          isDisabled={isSavingAvailability}
                        />
                      </div>
                    )}
                  </div>
                </Accordion>

                {role && perms && (
                  <PermissionsEditor role={role} onSave={handlePermUpdate} value={perms} />
                )}
              </>
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

export default TeamInfo;
