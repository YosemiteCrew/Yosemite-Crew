import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import { OrganizationDocument, OrgDocumentCategory } from "@/app/types/document";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { OrgDocumentCategoryOptions } from "../../types";
import { createDocument } from "@/app/services/documentService";
import DocUploader from "@/app/components/UploadImage/DocUploader";
import { useOrgStore } from "@/app/stores/orgStore";
import { Icon } from "@iconify/react/dist/iconify.js";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";

type AddDocumentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const INITIAL_FORM_DATA: OrganizationDocument = {
  _id: "",
  organisationId: "",
  title: "",
  description: "",
  fileUrl: "",
  category: "CANCELLATION_POLICY",
};

const AddDocument = ({ showModal, setShowModal }: AddDocumentProps) => {
  const primaryOrdId = useOrgStore.getState().primaryOrgId;
  const [formData, setFormData] =
    useState<OrganizationDocument>(INITIAL_FORM_DATA);
  const [formDataErrors, setFormDataErrors] = useState<{
    title?: string;
    fileUrl?: string;
  }>({});
  const [file, setFile] = useState<File | null>(null);

  const handleSave = async () => {
    const errors: { title?: string; fileUrl?: string } = {};
    if (!formData.title) errors.title = "Name is required";
    if (!formData.fileUrl) errors.fileUrl = "File is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createDocument(formData);
      setShowModal(false);
      setFormData(INITIAL_FORM_DATA);
      setFormDataErrors({});
      setFile(null);
    } catch (error) {
      console.log(error);
    }
  };

  if (!primaryOrdId) {
    return null;
  }

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add document
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between">
          <Accordion
            title="Add room"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <FormInput
                intype="text"
                inname="title"
                value={formData.title}
                inlabel="Document title"
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                error={formDataErrors.title}
                className="min-h-12!"
              />
              <LabelDropdown
                placeholder="Type"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    category: option.key as OrgDocumentCategory,
                  })
                }
                defaultOption={formData.category}
                options={OrgDocumentCategoryOptions}
              />
              <FormDesc
                intype="text"
                inname="description"
                value={formData.description || ""}
                inlabel="Description"
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[120px]!"
              />
              <div className="flex flex-col gap-1">
                <DocUploader
                  placeholder="Upload document"
                  apiUrl={`/v1/organisation-document/pms/${primaryOrdId}/documents/upload`}
                  onChange={(s) => setFormData({ ...formData, fileUrl: s })}
                  file={file}
                  setFile={setFile}
                  error={formDataErrors.fileUrl}
                />
                {formDataErrors.fileUrl && (
                  <div className="Errors">
                    <Icon icon="mdi:error" width="16" height="16" />
                    {formDataErrors.fileUrl}
                  </div>
                )}
              </div>
            </div>
          </Accordion>
          <Primary
            href="#"
            text="Save"
            classname="max-h-12! text-lg! tracking-wide!"
            onClick={handleSave}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddDocument;
