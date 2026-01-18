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
import {
  archiveForm,
  publishForm,
  unpublishForm,
} from "@/app/services/formService";
import FormRenderer from "./AddForm/components/FormRenderer";
import Close from "@/app/components/Icons/Close";
import { useErrorTost } from "@/app/components/Toast/Toast";
import { Icon } from "@iconify/react";

const buildPreviewValues = (fields: FormField[]): Record<string, any> => {
  const acc: Record<string, any> = {};
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === "group") {
        walk(field.fields ?? []);
        return;
      }
      // Check for defaultValue first (for readonly fields from inventory)
      const defaultValue = (field as any).defaultValue;

      if (field.type === "checkbox") {
        acc[field.id] = defaultValue ?? [];
        return;
      }
      if (field.type === "boolean") {
        acc[field.id] = defaultValue ?? false;
        return;
      }
      if (field.type === "date") {
        acc[field.id] = defaultValue ?? "";
        return;
      }
      if (field.type === "number") {
        acc[field.id] = defaultValue ?? field.placeholder ?? "";
        return;
      }
      acc[field.id] = defaultValue ?? field.placeholder ?? "";
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
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [publishLoading, setPublishLoading] = React.useState(false);
  const [unpublishLoading, setUnpublishLoading] = React.useState(false);
  const [archiveLoading, setArchiveLoading] = React.useState(false);
  const actionLoading = publishLoading || unpublishLoading || archiveLoading;

  const showActionError = (message: string) =>
    showErrorTost({
      message,
      errortext: "Error",
      iconElement: (
        <Icon
          icon="solar:danger-triangle-bold"
          width="20"
          height="20"
          color="#EA3729"
        />
      ),
      className: "errofoundbg",
    });

  const handlePublish = async () => {
    if (!activeForm._id) return;
    setPublishLoading(true);
    try {
      await publishForm(activeForm._id);
      setShowModal(false);
    } catch (err: any) {
      console.error("Failed to publish form", err);
      showActionError(
        err?.response?.data?.message || err?.message || "Unable to publish form"
      );
    } finally {
      setPublishLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!activeForm._id) return;
    setUnpublishLoading(true);
    try {
      await unpublishForm(activeForm._id);
      setShowModal(false);
    } catch (err: any) {
      console.error("Failed to unpublish form", err);
      showActionError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to unpublish form"
      );
    } finally {
      setUnpublishLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!activeForm._id) return;
    setArchiveLoading(true);
    try {
      await archiveForm(activeForm._id);
      setShowModal(false);
    } catch (err: any) {
      console.error("Failed to archive form", err);
      showActionError(
        err?.response?.data?.message || err?.message || "Unable to archive form"
      );
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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Edit form</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto pr-1 scrollbar-hidden">
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
          <div className="flex flex-col gap-3 px-3 pb-3">
            {renderActions()}
            <Secondary
              href="#"
              text="Edit form"
              onClick={() => {
                setShowModal(false);
                onEdit(activeForm);
              }}
              className="h-12! text-[16px]!"
              isDisabled={actionLoading}
            />
          </div>
        </div>
        {ErrorTostPopup}
      </div>
    </Modal>
  );
};

export default FormInfo;
