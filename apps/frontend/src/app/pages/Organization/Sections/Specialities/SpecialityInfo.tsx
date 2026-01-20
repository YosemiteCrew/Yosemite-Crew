import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
import ServiceSearchEdit from "@/app/components/Inputs/ServiceSearch/ServiceSearchEdit";
import Modal from "@/app/components/Modal";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import {
  deleteSpeciality,
  updateService,
  updateSpeciality,
} from "@/app/services/specialityService";
import { SpecialityWeb } from "@/app/types/speciality";
import { Service, Speciality } from "@yosemite-crew/types";
import React, { useMemo } from "react";
import { MdDeleteForever } from "react-icons/md";
import { deleteService } from "@/app/services/serviceService";
import Close from "@/app/components/Icons/Close";

type SpecialityInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSpeciality: SpecialityWeb;
};

const ServiceFields = [
  { label: "Description", key: "description", type: "text" },
  {
    label: "Duration (mins)",
    key: "durationMinutes",
    type: "number",
    required: true,
  },
  {
    label: "Service charge (USD)",
    key: "cost",
    type: "number",
    required: true,
  },
  { label: "Max discount (%)", key: "maxDiscount", type: "number" },
];

const getBasicFields = ({
  TeamOptions,
}: {
  TeamOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Name", key: "name", type: "text", required: true },
    { label: "Head", key: "headName", type: "dropdown", options: TeamOptions },
    {
      label: "Staff",
      key: "teamMemberIds",
      type: "multiSelect",
      options: TeamOptions,
    },
  ] satisfies FieldConfig[];

const SpecialityInfo = ({
  showModal,
  setShowModal,
  activeSpeciality,
}: SpecialityInfoProps) => {
  const teams = useTeamForPrimaryOrg();

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team._id,
        value: team._id,
      })),
    [teams]
  );

  const BasicFields = useMemo(
    () => getBasicFields({ TeamOptions }),
    [TeamOptions]
  );

  const basicInfoData = useMemo(
    () => ({
      name: activeSpeciality?.name ?? "",
      headName: activeSpeciality?.headUserId ?? "",
      teamMemberIds: activeSpeciality?.teamMemberIds ?? []
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
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
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
              <div className="text-body-2 text-text-primary">
                {activeSpeciality.name || "-"}
              </div>
              <MdDeleteForever
                className="cursor-pointer"
                onClick={handleDelete}
                size={26}
                color="#EA3729"
              />
            </div>
          </div>

          <EditableAccordion
            key={activeSpeciality.name + "core-key"}
            title={"Core"}
            fields={BasicFields}
            data={basicInfoData}
            defaultOpen={true}
            onSave={async (values) => {
              const team = TeamOptions.find((t) => t.value === values.headName);
              const payload: Speciality = {
                ...activeSpeciality,
                name: values.name ?? activeSpeciality.name,
                headUserId: values.headName ?? activeSpeciality.headUserId,
                headName: team?.label ?? activeSpeciality.headName,
                services: [],
              };
              await updateSpeciality(payload);
            }}
          />

          <Accordion
            key={activeSpeciality.name}
            title={"Services"}
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
                  showDeleteIcon={true}
                  onDelete={() => {
                    deleteService(service);
                  }}
                  onSave={async (values) => {
                    const payload: Service = {
                      ...service,
                      name: values.name ?? service.name,
                      description:
                        values.description ?? service.description ?? null,
                      durationMinutes: Number(
                        values.durationMinutes ?? service.durationMinutes
                      ),
                      cost: Number(values.cost ?? service.cost),
                      maxDiscount:
                        values.maxDiscount === "" || values.maxDiscount == null
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
  );
};

export default SpecialityInfo;
