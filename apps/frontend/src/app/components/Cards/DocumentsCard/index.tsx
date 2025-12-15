import React from "react";
import { OrganizationDocument } from "@/app/types/document";

type DocumentsCardProps = {
  document: OrganizationDocument;
  handleViewDocument: any;
};

const DocumentsCard = ({
  document,
  handleViewDocument,
}: DocumentsCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {document.title}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Description:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {document.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Category:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {document.category}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewDocument(document)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default DocumentsCard;
