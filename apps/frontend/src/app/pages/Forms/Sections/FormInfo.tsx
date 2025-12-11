import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Accordion from "@/app/components/Accordion/Accordion";
import Modal from "@/app/components/Modal";
import { Primary, Secondary } from "@/app/components/Buttons";
import {
  FormsCategoryOptions,
  FormField,
  FormsProps,
  FormsUsageOptions,
} from "@/app/types/forms";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import {
  archiveForm,
  publishForm,
  unpublishForm,
} from "@/app/services/formService";
import FormRenderer from "./AddForm/components/FormRenderer";

const buildPreviewValues = (fields: FormField[]): Record<string, any> => {
  const acc: Record<string, any> = {};
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === "group") {
        walk(field.fields ?? []);
        return;
      }
      if (field.type === "checkbox") {
        acc[field.id] = [];
        return;
      }
      if (field.type === "boolean") {
        acc[field.id] = false;
        return;
      }
      if (field.type === "date") {
        acc[field.id] = "";
        return;
      }
      if (field.type === "number") {
        acc[field.id] = "";
        return;
      }
      acc[field.id] = field.placeholder || "";
    });
  };
  walk(fields);
  return acc;
};

type FormInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeForm: FormsProps;
  onEdit: (form: FormsProps) => void;
  serviceOptions: { label: string; value: string }[];
};

const DetailsFields = [
  { label: "Form name", key: "name", type: "text" },
  { label: "Description", key: "description", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "dropdown",
    options: FormsCategoryOptions,
  },
];

const UsageFields = [
  {
    label: "Visibility type",
    key: "usage",
    type: "dropdown",
    options: FormsUsageOptions,
  },
  {
    label: "Service",
    key: "services",
    type: "multiSelect",
  },
  {
    label: "Species",
    key: "species",
    type: "multiSelect",
    options: ["Dog", "Cat", "Horse"],
  },
];

const FormInfo = ({
  showModal,
  setShowModal,
  activeForm,
  onEdit,
  serviceOptions,
}: FormInfoProps) => {
  const [publishLoading, setPublishLoading] = React.useState(false);
  const [unpublishLoading, setUnpublishLoading] = React.useState(false);
  const [archiveLoading, setArchiveLoading] = React.useState(false);
  const actionLoading = publishLoading || unpublishLoading || archiveLoading;

  const handlePublish = async () => {
    if (!activeForm._id) return;
    setPublishLoading(true);
    try {
      await publishForm(activeForm._id);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!activeForm._id) return;
    setUnpublishLoading(true);
    try {
      await unpublishForm(activeForm._id);
    } finally {
      setUnpublishLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!activeForm._id) return;
    setArchiveLoading(true);
    try {
      await archiveForm(activeForm._id);
    } finally {
      setArchiveLoading(false);
    }
  };

  const renderActions = () => {
    switch (activeForm.status) {
      case "Published":
        return (
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text={unpublishLoading ? "Unpublishing..." : "Unpublish"}
              onClick={handleUnpublish}
              className="h-12! text-[16px]!"
              isDisabled={unpublishLoading || publishLoading || archiveLoading}
            />
            <Secondary
              href="#"
              text={archiveLoading ? "Archiving..." : "Archive"}
              onClick={handleArchive}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
      case "Archived":
        return (
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text={unpublishLoading ? "Moving..." : "Move to draft"}
              onClick={handleUnpublish}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
            <Primary
              href="#"
              text={publishLoading ? "Publishing..." : "Publish"}
              onClick={handlePublish}
              classname="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 gap-3">
            <Primary
              href="#"
              text={publishLoading ? "Publishing..." : "Publish"}
              onClick={handlePublish}
              classname="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
            <Secondary
              href="#"
              text={archiveLoading ? "Archiving..." : "Archive"}
              onClick={handleArchive}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
    }
  };

  return (
    <Modal
      key={activeForm._id || activeForm.name}
      showModal={showModal}
      setShowModal={setShowModal}
    >
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View form
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto pr-1">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              key={`details-${activeForm._id || activeForm.name}`}
              title="Form details"
              fields={DetailsFields}
              data={activeForm}
              defaultOpen={true}
              showEditIcon={false}
              readOnly
            />
            <EditableAccordion
              key={`usage-${activeForm._id || activeForm.name}`}
              title="Usage & visibility"
              fields={[
                ...UsageFields.slice(0, 1),
                { ...UsageFields[1], options: serviceOptions },
                ...UsageFields.slice(2),
              ]}
              data={activeForm}
              defaultOpen={true}
              showEditIcon={false}
              readOnly
            />
            {(activeForm.schema?.length ?? 0) > 0 && (
              <Accordion
                title="Form preview"
                defaultOpen
                showEditIcon={false}
                isEditing={true}
              >
                <FormRenderer
                  fields={activeForm.schema ?? []}
                  values={buildPreviewValues(activeForm.schema ?? [])}
                  onChange={() => {}}
                  readOnly
                />
              </Accordion>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {renderActions()}
            <Secondary
              href="#"
              text="Edit form"
              onClick={() => onEdit(activeForm)}
              className="h-12! text-[16px]!"
              isDisabled={actionLoading}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FormInfo;
