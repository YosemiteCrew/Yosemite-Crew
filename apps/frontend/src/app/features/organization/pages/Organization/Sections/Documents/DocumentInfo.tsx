import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Modal from '@/app/ui/overlays/Modal';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { OrganizationDocument } from '@/app/features/documents/types/document';
import React, { useState } from 'react';
import { OrgDocumentCategoryOptions } from '@/app/features/organization/pages/Organization/types';
import { deleteDocument, updateDocument } from '@/app/features/documents/services/documentService';
import DocUploader from '@/app/ui/widgets/UploadImage/DocUploader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useNotify } from '@/app/hooks/useNotify';

type DocumentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeDocument: OrganizationDocument;
  canEditDocument: boolean;
};

const Fields = [
  { label: 'Title', key: 'title', type: 'text', required: true },
  { label: 'Description', key: 'description', type: 'text' },
  {
    label: 'Category',
    key: 'category',
    type: 'dropdown',
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
  const [fileUrl, setFileUrl] = useState<string>('');
  const { notify } = useNotify();
  const categoryLabel = OrgDocumentCategoryOptions.find(
    (option) => option.value === activeDocument.category
  )?.label;

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
      notify('success', {
        title: 'Document updated',
        text: 'Document details have been updated successfully.',
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update document',
        text: 'Failed to update document. Please try again.',
      });
    }
  };

  const handleUpdateFile = async () => {
    try {
      const formData: OrganizationDocument = {
        ...activeDocument,
        fileUrl,
      };
      await updateDocument(formData);
      notify('success', {
        title: 'Document updated',
        text: 'Document details have been updated successfully.',
      });
      setFile(null);
      setShowModal(false);
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update document',
        text: 'Failed to update document. Please try again.',
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument(activeDocument);
      notify('success', {
        title: 'Document deleted',
        text: 'Document has been deleted successfully.',
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to delete document',
        text: 'Failed to delete document. Please try again.',
      });
    }
  };

  const handleDownload = () => {
    globalThis.open(activeDocument.fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} size="md">
      <div className="flex flex-col h-full gap-6">
        <ModalHeader
          eyebrow="Document"
          title={activeDocument.title || 'View document'}
          meta={categoryLabel}
          onClose={() => setShowModal(false)}
        />

        <div className="flex flex-col flex-1 gap-5 w-full overflow-y-auto scrollbar-hidden">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              title="Document info"
              fields={Fields}
              data={activeDocument}
              defaultOpen={true}
              onSave={handleUpdate}
              showEditIcon={canEditDocument}
              showDeleteIcon={canEditDocument}
              onDelete={handleDelete}
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
        </div>

        {(activeDocument.fileUrl || (canEditDocument && fileUrl)) && (
          <ModalFooter align="stretch">
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
          </ModalFooter>
        )}
      </div>
    </Modal>
  );
};

export default DocumentInfo;
