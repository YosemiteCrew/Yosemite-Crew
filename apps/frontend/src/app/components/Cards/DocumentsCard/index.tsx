import React from "react";
import { OrganizationDocument } from "@/app/types/document";
import { Secondary } from "../../Buttons";

type DocumentsCardProps = {
  document: OrganizationDocument;
  handleViewDocument: any;
};

const DocumentsCard = ({
  document,
  handleViewDocument,
}: DocumentsCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {document.title}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Description:</div>
        <div className="text-caption-1 text-text-primary">
          {document.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">
          {document.category}
        </div>
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
