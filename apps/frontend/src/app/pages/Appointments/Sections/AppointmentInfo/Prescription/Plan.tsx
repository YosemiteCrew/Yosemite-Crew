import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Primary } from "@/app/components/Buttons";
import { FormDataProps } from "..";
import { Appointment, Service } from "@yosemite-crew/types";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import Build from "@/app/pages/Forms/Sections/AddForm/Build";

type PlanProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

export type ServiceEdit = Service & {
  discount: string;
};

type TempFormData = {
  total: string;
  subTotal: string;
  tax: string;
};

const EMPTY_TempFormData = {
  total: "",
  subTotal: "",
  tax: "",
};

const Plan = ({ formData, setFormData, activeAppointment }: PlanProps) => {
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Plan");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? [])
  );
  const [planQuery, setPlanQuery] = useState("");
  const [tempFormData] = useState<TempFormData>(EMPTY_TempFormData);

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        key: form._id || form.name,
        value: form.name,
      })),
    [forms]
  );

  const handlePlanSelect = (id: string) => {
    const selected = forms.find((item) => item._id === id);
    if (!selected) return;
    const initialValues = buildInitialValues(selected.schema);
    setValues(initialValues);
    setActive(selected);
  };

  const handleSave = () => {
    console.log(values);
    console.log(active);
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="font-grotesk font-medium text-black-text text-[23px]">
            Treatment/Plan
          </div>
          <SearchDropdown
            placeholder="Search plan"
            options={FormOptions}
            onSelect={handlePlanSelect}
            query={planQuery}
            setQuery={setPlanQuery}
            minChars={0}
          />
          {active && (
            <Build
              formData={active}
              setFormData={(next) =>
                setActive((prev) => {
                  const base = prev ?? active;
                  return typeof next === "function" ? next(base) : next;
                })
              }
              onNext={() => {}}
              serviceOptions={[]}
            />
          )}
        </div>
        <div className="flex flex-col px-4! py-2.5! rounded-2xl border border-grey-light">
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>SubTotal: </div>
            <div>${tempFormData.subTotal}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>Tax: </div>
            <div>${tempFormData.tax || "0.00"}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 justify-between">
            <div>Estimatted total: </div>
            <div>${tempFormData.total || "0.00"}</div>
          </div>
        </div>
      </div>
      <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
    </div>
  );
};

export default Plan;
