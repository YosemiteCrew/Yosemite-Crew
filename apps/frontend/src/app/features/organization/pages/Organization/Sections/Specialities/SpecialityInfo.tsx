import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import ServiceSearchEdit from '@/app/ui/inputs/ServiceSearch/ServiceSearchEdit';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Secondary } from '@/app/ui/primitives/Buttons';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  deleteSpeciality,
  updateService,
  updateSpeciality,
} from '@/app/features/organization/services/specialityService';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { Service, Speciality } from '@yosemite-crew/types';
import React, { useEffect, useMemo, useState } from 'react';
import { MdDeleteForever } from 'react-icons/md';
import { deleteService } from '@/app/features/organization/services/serviceService';
import Close from '@/app/ui/primitives/Icons/Close';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { useNotify } from '@/app/hooks/useNotify';

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
  const currency = useCurrencyForPrimaryOrg();
  const { notify } = useNotify();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!showModal) {
      setShowDeleteModal(false);
    }
  }, [showModal]);

  const ServiceFields = useMemo(
    () => [
      { label: 'Description', key: 'description', type: 'text' },
      {
        label: 'Duration (mins)',
        key: 'durationMinutes',
        type: 'number',
        required: true,
      },
      {
        label: `Service charge (${currency})`,
        key: 'cost',
        type: 'number',
        required: true,
      },
      { label: 'Max discount (%)', key: 'maxDiscount', type: 'number' },
      { label: 'Name', key: 'name', type: 'text' },
    ],
    [currency]
  );

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
        text: 'Failed to delete speciality. Please try again.',
      });
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
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
              <div className="text-body-1 text-text-primary">View speciality</div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          <div className="flex flex-col gap-6 flex-1 overflow-y-auto scrollbar-hidden">
            <div className={`flex items-center gap-2`}>
              <div className="flex items-center justify-between w-full">
                <div className="text-body-2 text-text-primary">{activeSpeciality.name || '-'}</div>
                {canEditSpecialities && (
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
              key={activeSpeciality.name + 'core-key'}
              title={'Core'}
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

            <Accordion
              key={activeSpeciality.name}
              title={'Services'}
              defaultOpen={true}
              showEditIcon={false}
              isEditing={false}
            >
              <div className="flex flex-col gap-3">
                <ServiceSearchEdit speciality={activeSpeciality} />
                {activeSpeciality.services?.map((service, i) => (
                  <EditableAccordion
                    key={service.name + i}
                    title={service.name}
                    fields={ServiceFields}
                    data={service}
                    defaultOpen={false}
                    showDeleteIcon={canEditSpecialities}
                    showEditIcon={canEditSpecialities}
                    onDelete={() => {
                      deleteService(service);
                    }}
                    onSave={async (values) => {
                      const payload: Service = {
                        ...service,
                        name: values.name ?? service.name,
                        description: values.description ?? service.description ?? null,
                        durationMinutes: Number(values.durationMinutes ?? service.durationMinutes),
                        cost: Number(values.cost ?? service.cost),
                        maxDiscount:
                          values.maxDiscount === '' || values.maxDiscount == null
                            ? null
                            : Number(values.maxDiscount),
                      };
                      await updateService(payload);
                    }}
                  />
                ))}
              </div>
            </Accordion>
          </div>
        </div>
      </Modal>
      {showDeleteModal && (
        <CenterModal
          showModal={showDeleteModal}
          setShowModal={setShowDeleteModal}
          onClose={handleDeleteCancel}
        >
          <ModalHeader title="Delete speciality" onClose={handleDeleteCancel} />
          <div className="text-body-4 text-text-primary">
            Are you sure you want to delete{''}
            <span className="text-body-4-emphasis"> {activeSpeciality.name}</span>
            {''}? This action cannot be undone.
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

export default SpecialityInfo;
