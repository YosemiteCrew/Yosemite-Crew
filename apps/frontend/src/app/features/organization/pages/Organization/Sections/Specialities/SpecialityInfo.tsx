import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
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
import { MdDeleteForever } from 'react-icons/md';
import { RiSettings3Line, RiTeamLine } from 'react-icons/ri';
import Close from '@/app/ui/primitives/Icons/Close';
import { useNotify } from '@/app/hooks/useNotify';
import { useRouter } from 'next/navigation';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

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
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="opacity-0 pointer-events-none">
              <Close onClick={() => {}} />
            </div>
            <div className="flex items-center gap-2 text-body-1 text-text-primary">
              <RiTeamLine size={20} color="var(--color-neutral-700)" aria-hidden="true" />
              Manage team
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          {/* Speciality name + delete */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-body-2 font-semibold text-text-primary">
                {activeSpeciality.name || '—'}
              </span>
              <span className="text-body-4 text-text-secondary">
                {activeSpeciality.teamMemberIds?.length ?? 0} member
                {(activeSpeciality.teamMemberIds?.length ?? 0) === 1 ? '' : 's'} assigned
              </span>
            </div>
            {canEditSpecialities && (
              <button
                type="button"
                aria-label="Delete speciality"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-center size-9 rounded-full border border-transparent hover:border-danger-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
              >
                <MdDeleteForever size={22} color="var(--color-danger-600)" aria-hidden="true" />
              </button>
            )}
          </div>

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

          {/* Manage catalog CTA */}
          <Primary
            href="#"
            text="Manage Services & Packages"
            icon={<RiSettings3Line size={18} aria-hidden="true" />}
            size="large"
            onClick={(e) => {
              e.preventDefault();
              setShowModal(false);
              const id = activeSpeciality._id ?? '';
              const openParam = id ? `?open=${id}` : '';
              router.push(`/organization/specialities${openParam}`);
            }}
            className="w-full shrink-0"
          />
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
