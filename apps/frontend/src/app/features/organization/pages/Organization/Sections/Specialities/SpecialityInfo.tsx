import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Secondary } from '@/app/ui/primitives/Buttons';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  deleteSpeciality,
  updateSpeciality,
} from '@/app/features/organization/services/specialityService';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { Speciality } from '@yosemite-crew/types';
import React, { useMemo, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { useRouter } from 'next/navigation';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';
import { IoPeopleOutline, IoSettingsOutline, IoTrash } from 'react-icons/io5';

type SpecialityInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSpeciality: SpecialityWeb;
  canEditSpecialities: boolean;
};

const getBasicFields = ({ TeamOptions }: { TeamOptions: { label: string; value: string }[] }) =>
  [
    { label: 'Name', key: 'name', type: 'text', required: true },
    { label: 'Head', key: 'headName', type: 'dropdown', options: TeamOptions },
    {
      label: 'Staff',
      key: 'teamMemberIds',
      type: 'multiSelect',
      options: TeamOptions,
    },
  ] satisfies FieldConfig[];

const SpecialityInfo = ({
  showModal,
  setShowModal,
  activeSpeciality,
  canEditSpecialities,
}: SpecialityInfoProps) => {
  const teams = useTeamForPrimaryOrg();
  const { notify } = useNotify();
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })),
    [teams]
  );

  const BasicFields = useMemo(() => getBasicFields({ TeamOptions }), [TeamOptions]);

  const basicInfoData = useMemo(
    () => ({
      name: activeSpeciality?.name ?? '',
      headName: activeSpeciality?.headUserId ?? '',
      teamMemberIds: activeSpeciality?.teamMemberIds ?? [],
    }),
    [activeSpeciality]
  );
  const specialityId = activeSpeciality._id ?? '';
  const organisationId = activeSpeciality.organisationId ?? '';
  const memberCount = activeSpeciality.teamMemberIds?.length ?? 0;

  const handleDelete = async () => {
    try {
      const payload: Speciality = {
        name: activeSpeciality.name,
        _id: activeSpeciality._id,
        organisationId: activeSpeciality.organisationId,
      };
      await deleteSpeciality(payload);
      notify('success', {
        title: 'Speciality deleted',
        text: 'Speciality has been deleted successfully.',
      });
      setShowDeleteModal(false);
      setShowModal(false);
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to delete speciality',
        text: getCatalogErrorMessage(
          error,
          'Failed to delete speciality. It may have services, packages, or historical usage.'
        ),
      });
    }
  };

  const handleDeleteCancel = () => setShowDeleteModal(false);

  return (
    <>
      <Modal showModal={showModal} setShowModal={setShowModal}>
        <div className="flex flex-col h-full gap-6">
          <ModalHeader
            eyebrow="Speciality"
            title={activeSpeciality.name || 'Manage team'}
            meta={`${memberCount} member${memberCount === 1 ? '' : 's'} assigned`}
            icon={<IoPeopleOutline size={20} color="var(--ink-faint)" aria-hidden="true" />}
            onClose={() => setShowModal(false)}
            actions={
              canEditSpecialities && (
                <button
                  type="button"
                  aria-label="Delete speciality"
                  onClick={() => setShowDeleteModal(true)}
                  className="grid size-8 cursor-pointer place-items-center rounded-full border border-transparent hover:border-danger-600"
                >
                  <IoTrash size={18} color="var(--color-danger-600)" aria-hidden="true" />
                </button>
              )
            }
          />

          {/* Team fields */}
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto scrollbar-hidden">
            <EditableAccordion
              key={activeSpeciality.name + 'team-key'}
              title="Team"
              fields={BasicFields}
              data={basicInfoData}
              defaultOpen={true}
              showEditIcon={canEditSpecialities}
              onSave={async (values) => {
                const team = TeamOptions.find((t) => t.value === values.headName);
                const teamMemberIds = Array.isArray(values.teamMemberIds)
                  ? (values.teamMemberIds as string[])
                  : activeSpeciality.teamMemberIds;
                const serviceIds = (activeSpeciality.services ?? []).map((s) => s.id);
                const payload: Speciality = {
                  ...activeSpeciality,
                  name: values.name ?? activeSpeciality.name,
                  headUserId: values.headName ?? activeSpeciality.headUserId,
                  headName: team?.label ?? activeSpeciality.headName,
                  teamMemberIds,
                  services: serviceIds,
                };
                await updateSpeciality(payload);
              }}
            />
            {specialityId && organisationId && (
              <SectionContainer
                title="Services & Packages"
                titleColor="var(--color-neutral-900)"
                className="shrink-0"
              >
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 text-body-4-emphasis text-text-primary">Services</div>
                    <ServicesTab specialityId={specialityId} organisationId={organisationId} />
                  </div>
                  <div>
                    <div className="mb-2 text-body-4-emphasis text-text-primary">Packages</div>
                    <PackagesTab specialityId={specialityId} organisationId={organisationId} />
                  </div>
                </div>
              </SectionContainer>
            )}
          </div>

          <ModalFooter align="stretch">
            <Primary
              href="#"
              text="Manage Services & Packages"
              icon={<IoSettingsOutline size={18} aria-hidden="true" />}
              size="large"
              onClick={(e) => {
                e.preventDefault();
                setShowModal(false);
                const id = activeSpeciality._id ?? '';
                const openParam = id ? `?open=${id}` : '';
                router.push(`/organization/specialities${openParam}`);
              }}
            />
          </ModalFooter>
        </div>
      </Modal>

      {showModal && showDeleteModal && (
        <CenterModal
          showModal={showDeleteModal}
          setShowModal={setShowDeleteModal}
          onClose={handleDeleteCancel}
        >
          <ModalHeader title="Delete speciality" onClose={handleDeleteCancel} />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{activeSpeciality.name}</span>? This action cannot be
            undone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Secondary href="#" text="Cancel" onClick={handleDeleteCancel} />
            <Delete href="#" onClick={handleDelete} text="Delete" />
          </div>
        </CenterModal>
      )}
    </>
  );
};

export default SpecialityInfo;
