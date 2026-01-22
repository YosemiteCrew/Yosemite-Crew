import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { OrganizationDocument } from "@/app/types/document";
import React, { useState } from "react";
import { OrgDocumentCategoryOptions } from "../../types";
import { deleteRoom, updateDocument } from "@/app/services/documentService";
import DocUploader from "@/app/components/UploadImage/DocUploader";
import { Primary, Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";

type DocumentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeDocument: OrganizationDocument;
  canEditDocument: boolean;
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
  canEditDocument,
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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">View document</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex flex-col flex-1 gap-5 w-full overflow-y-hidden justify-between scrollbar-hidden">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              title="Document info"
              fields={Fields}
              data={activeDocument}
              defaultOpen={true}
              onSave={handleUpdate}
              showEditIcon={canEditDocument}
              showDeleteIcon={canEditDocument}
              onDelete={() => deleteRoom(activeDocument)}
            />
            {canEditDocument && (
              <DocUploader
                placeholder="Upload document"
                apiUrl={`/v1/organisation-document/pms/${activeDocument.organisationId}/documents/upload`}
                onChange={(s) => setFileUrl(s)}
                file={file}
                setFile={setFile}
              />
            )}
          </div>
          <div className="flex flex-col gap-3">
            {activeDocument.fileUrl && (
              <Secondary
                href={activeDocument.fileUrl}
                text="Download document"
                onClick={handleDownload}
              />
            )}
            {canEditDocument && fileUrl && (
              <Primary href="#" text="Save" onClick={handleUpdateFile} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentInfo;
