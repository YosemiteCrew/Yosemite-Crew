import { FormsProps } from "@/app/types/forms";
import React from "react";
import { getStatusStyle } from "../../DataTable/FormsTable";

type FormCardProps = {
  form: FormsProps;
  handleViewForm: any;
};

const FormCard = ({ form, handleViewForm }: FormCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {form.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Category:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {form.category}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Description:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {form.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Usage:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {form.usage}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Updated by:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {form.updatedBy}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Last updated:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {form.lastUpdated}
        </div>
      </div>
      <div
        style={getStatusStyle(form.status || "")}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {form.status}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewForm(form)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default FormCard;
