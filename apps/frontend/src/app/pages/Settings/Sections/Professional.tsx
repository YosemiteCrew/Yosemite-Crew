import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useState } from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";

const ProfessionalFields = [
  {
    label: "LinkedIn",
    key: "linkedIn",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Medical license number",
    key: "license",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Years of experience",
    key: "experience",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Specialisation",
    key: "specialisation",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Qualification (MBBS, MD,etc.)",
    key: "qualification",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Biography or short description",
    key: "biography",
    required: true,
    editable: true,
    type: "text",
  },
];

const Professional = () => {
  const [org] = useState({});

  return (
    <AccordionButton
      title="Professional details"
      defaultOpen
      showButton={false}
    >
      <div className="flex flex-col gap-4">
        <ProfileCard title="Info" fields={ProfessionalFields} org={org} />
      </div>
    </AccordionButton>
  );
};

export default Professional;
