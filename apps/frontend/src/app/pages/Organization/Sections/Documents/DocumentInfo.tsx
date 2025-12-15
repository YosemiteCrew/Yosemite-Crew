import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { OrganizationDocument } from "@/app/types/document";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { OrgDocumentCategoryOptions } from "../../types";
import { updateDocument } from "@/app/services/documentService";
import DocUploader from "@/app/components/UploadImage/DocUploader";
import { Primary, Secondary } from "@/app/components/Buttons";

type DocumentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeDocument: OrganizationDocument;
};

const Fields = [
  { label: "Title", key: "title", type: "text", required: true },
  { label: "Description", key: "description", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "dropdown",
    options: OrgDocumentCategoryOptions,
  },
];

const DocumentInfo = ({
  showModal,
  setShowModal,
  activeDocument,
}: DocumentInfoProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");

  const handleUpdate = async (values: any) => {
    try {
      const formData: OrganizationDocument = {
        _id: activeDocument._id,
        organisationId: activeDocument.organisationId,
        fileUrl: activeDocument.fileUrl,
        title: values.title,
        description: values.description,
        category: values.category,
      };
      await updateDocument(formData);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdateFile = async () => {
    try {
      const formData: OrganizationDocument = {
        ...activeDocument,
        fileUrl,
      };
      await updateDocument(formData);
      setFile(null);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = () => {
    window.open(activeDocument.fileUrl, "_blank");
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View document
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col flex-1 gap-5 w-full overflow-y-hidden justify-between">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              title="Document info"
              fields={Fields}
              data={activeDocument}
              defaultOpen={true}
              onSave={handleUpdate}
            />
            <DocUploader
              placeholder="Upload document"
              apiUrl={`/v1/organisation-document/pms/${activeDocument.organisationId}/documents/upload`}
              onChange={(s) => setFileUrl(s)}
              file={file}
              setFile={setFile}
            />
          </div>
          <div className="flex flex-col gap-3">
            {activeDocument.fileUrl && (
              <Secondary
                href={activeDocument.fileUrl}
                text="Download document"
                className="max-h-12! text-lg! tracking-wide!"
                onClick={handleDownload}
              />
            )}
            {fileUrl && (
              <Primary
                href="#"
                text="Save"
                classname="max-h-12! text-lg! tracking-wide!"
                onClick={handleUpdateFile}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentInfo;
