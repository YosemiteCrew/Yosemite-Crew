import React from "react";
import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion, { FieldConfig } from "@/app/components/Accordion/EditableAccordion";

type BillableServicesSectionProps = {
  serviceId?: string;
  serviceName?: string;
  serviceFields: FieldConfig[];
  serviceInfoData: Record<string, any>;
};

const BillableServicesSection = ({
  serviceId,
  serviceName,
  serviceFields,
  serviceInfoData,
}: BillableServicesSectionProps) => (
  <Accordion
    title="Billable services"
    showEditIcon={false}
    isEditing={true}
  >
    {serviceId && (
      <EditableAccordion
        title={serviceName || ""}
        fields={serviceFields}
        data={serviceInfoData}
        defaultOpen={true}
        showEditIcon={false}
      />
    )}
  </Accordion>
);

export default BillableServicesSection;
