import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import React, { useMemo, useState } from "react";
import { FormDataProps } from "..";
import { Appointment } from "@yosemite-crew/types";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import { FormsProps } from "@/app/types/forms";
import Build from "@/app/pages/Forms/Sections/AddForm/Build";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "concern", type: "text" },
  { label: "Date", key: "date", type: "date" },
  { label: "Time", key: "time", type: "date" },
  { label: "Lead", key: "lead", type: "text" },
];

type DischargeSummaryProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Discharge = ({
  activeAppointment,
  formData,
  setFormData,
}: DischargeSummaryProps) => {
  const forms = useFormsForPrimaryOrgByCategory("Discharge");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? [])
  );

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        key: form._id || form.name,
        value: form.name,
      })),
    [forms]
  );

  const handleDischargeSelect = (id: string) => {
    const selected = forms.find((item) => item._id === id);
    if (!selected) return;
    const initialValues = buildInitialValues(selected.schema);
    setValues(initialValues);
    setActive(selected);
  };

  const handleSave = () => {
    console.log(values, active)
  };

  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? "",
      service: activeAppointment.appointmentType?.name ?? "",
      date: activeAppointment.appointmentDate ?? "",
      time: activeAppointment.startTime ?? "",
      lead: activeAppointment.lead?.name ?? "",
    }),
    [activeAppointment]
  );

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Discharge summary
        </div>
        <EditableAccordion
          key={"Appointments-key"}
          title={"Appointments details"}
          fields={AppointmentFields}
          data={AppointmentInfoData}
          defaultOpen={true}
          showEditIcon={false}
        />
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={FormOptions}
            onSelect={handleDischargeSelect}
            query={query}
            setQuery={setQuery}
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
      </div>
      <div className="flex flex-col gap-3">
        <Primary
          href="#"
          text="Save and share with parents"
          classname="h-13!"
          onClick={handleSave}
        />
        <Secondary
          href="#"
          text="Save"
          className="h-13!"
          onClick={handleSave}
        />
      </div>
    </div>
  );
};

export default Discharge;
