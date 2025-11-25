import React from 'react';
import DocumentCard from '@/shared/components/common/DocumentCard/DocumentCard';
import type {Document} from '@/features/documents/types';

interface DocumentListItemProps {
  document: Document;
  onPressView: (documentId: string) => void;
  onPressEdit?: (documentId: string) => void;
}

export const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document,
  onPressView,
  onPressEdit,
}) => {
  const canEdit = document.isUserAdded && !document.uploadedByPmsUserId;
  const handleView = () => onPressView(document.id);
  const handleEdit =
    canEdit && onPressEdit ? () => onPressEdit(document.id) : undefined;

  return (
    <DocumentCard
      title={document.title}
      businessName={document.businessName}
      visitType={document.visitType}
      issueDate={document.issueDate}
      showEditAction={Boolean(handleEdit)}
      onPressView={handleView}
      onPressEdit={handleEdit}
      onPress={handleView}
    />
  );
};

export default DocumentListItem;
