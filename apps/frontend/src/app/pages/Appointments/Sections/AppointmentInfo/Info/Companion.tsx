import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { useCompanionStore } from "@/app/stores/companionStore";
import { useParentStore } from "@/app/stores/parentStore";
import { Appointment } from "@yosemite-crew/types";
import React, { useMemo } from "react";

type CompanionProps = {
  activeAppointment: Appointment;
};

const CompanionFields = [
  { label: "Date of birth", key: "dateOfBirth", type: "date" },
  { label: "Gender", key: "gender", type: "text" },
  { label: "Weight", key: "currentWeight", type: "number" },
  { label: "Blood group", key: "bloodGroup", type: "text" },
  { label: "Neutered status", key: "isneutered", type: "text" },
  { label: "Allergies", key: "allergy", type: "text" },
  { label: "Insurance carrier", key: "policcompanyNameyNumber", type: "text" },
  { label: "Insurance number", key: "policyNumber", type: "text" },
];

const ParentFields = [
  { label: "First name", key: "firstName", type: "text" },
  { label: "Last name", key: "lastName", type: "text" },
  { label: "Email", key: "email", type: "text" },
  { label: "Number", key: "phone", type: "text" },
];

const Companion = ({ activeAppointment }: CompanionProps) => {
  const companionId = activeAppointment.companion.id;
  const parentId = activeAppointment.companion.parent.id;
  const companion = useCompanionStore((state) =>
    state.getCompanionById(companionId)
  );
  const parent = useParentStore((state) =>
    state.getParentById(parentId)
  );

  const CompanionInfoData = useMemo(
    () => ({
      dateOfBirth: companion?.dateOfBirth ?? "",
      gender: companion?.gender ?? "",
      currentWeight: companion?.currentWeight ?? "",
      bloodGroup: companion?.bloodGroup ?? "",
      allergy: companion?.allergy ?? "",
      isneutered: companion?.isneutered ? "Yes" : "No",
      companyName: companion?.insurance?.companyName ?? "",
      policyNumber: companion?.insurance?.policyNumber ?? ""
    }),
    [companion]
  );

  const ParentInfoData = useMemo(
    () => ({
      firstName: parent?.firstName ?? "",
      lastName: parent?.lastName ?? "",
      email: parent?.email ?? "",
      phone: parent?.phoneNumber ?? "",
    }),
    [parent]
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        key={"companion-key"}
        title={"Companion details"}
        fields={CompanionFields}
        data={CompanionInfoData}
        defaultOpen={true}
        showEditIcon={false}
      />
      <EditableAccordion
        key={"parent-key"}
        title={"Parent details"}
        fields={ParentFields}
        data={ParentInfoData}
        defaultOpen={true}
        showEditIcon={false}
      />
    </div>
  );
};

export default Companion;
