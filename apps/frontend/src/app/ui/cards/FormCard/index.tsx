import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { FormsProps, getFormCategoryDisplayLabel } from '@/app/features/forms/types/forms';
import React from 'react';
import { getFormsStatusTone } from '@/app/ui/tables/tableUtils';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { Organisation } from '@yosemite-crew/types';

type FormCardProps = {
  form: FormsProps;
  handleViewForm: any;
  getUserName?: (userId: string) => string;
  orgType?: Organisation['type'];
};

const FormCard = ({ form, handleViewForm, getUserName, orgType }: FormCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">{form.name}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">
          {getFormCategoryDisplayLabel(form.category, orgType)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Description:</div>
        <div className="text-caption-1 text-text-primary">{form.description}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Usage:</div>
        <div className="text-caption-1 text-text-primary">{form.usage}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Updated by:</div>
        <div className="text-caption-1 text-text-primary">
          {getUserName ? getUserName(form.updatedBy) : form.updatedBy}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Last updated:</div>
        <div className="text-caption-1 text-text-primary">{form.lastUpdated}</div>
      </div>
      <StatusPill tone={getFormsStatusTone(form.status)} label={form.status} />
      <div className="flex gap-3 w-full">
        <Secondary href="#" onClick={() => handleViewForm(form)} text="View" className="w-full" />
      </div>
    </div>
  );
};

export default FormCard;
