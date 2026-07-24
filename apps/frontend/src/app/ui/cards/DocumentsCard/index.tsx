import React from 'react';
import { OrganizationDocument } from '@/app/features/documents/types/document';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { toTitle } from '@/app/lib/validators';

type DocumentsCardProps = {
  document: OrganizationDocument;
  handleViewDocument: any;
};

const DocumentsCard = ({ document, handleViewDocument }: DocumentsCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">{document.title}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Description:</div>
        <div className="text-caption-1 text-text-primary">{document.description}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{toTitle(document.category)}</div>
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewDocument(document)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default DocumentsCard;
