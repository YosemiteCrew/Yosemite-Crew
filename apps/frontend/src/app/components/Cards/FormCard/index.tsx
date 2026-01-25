import { FormsProps } from "@/app/types/forms";
import React from "react";
import { getStatusStyle } from "../../DataTable/FormsTable";
import { Secondary } from "../../Buttons";

type FormCardProps = {
  form: FormsProps;
  handleViewForm: any;
  getUserName?: (userId: string) => string;
};

const FormCard = ({ form, handleViewForm, getUserName }: FormCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {form.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{form.category}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Description:</div>
        <div className="text-caption-1 text-text-primary">
          {form.description}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Usage:</div>
        <div className="text-caption-1 text-text-primary">{form.usage}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Updated by:</div>
        <div className="text-caption-1 text-text-primary">{getUserName ? getUserName(form.updatedBy) : form.updatedBy}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Last updated:</div>
        <div className="text-caption-1 text-text-primary">
          {form.lastUpdated}
        </div>
      </div>
      <div
        style={getStatusStyle(form.status || "")}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {form.status}
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewForm(form)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default FormCard;
