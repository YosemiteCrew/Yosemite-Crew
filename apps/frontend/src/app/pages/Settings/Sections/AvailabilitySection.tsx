import AccordionButton from "@/app/components/Accordion/AccordionButton";
import Availability from "@/app/components/Availability/Availability";
import React from "react";

const AvailabilitySection = () => {
  return (
    <AccordionButton title="Availability" defaultOpen showButton={false}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <Availability />
      </div>
    </AccordionButton>
  );
};

export default AvailabilitySection;
