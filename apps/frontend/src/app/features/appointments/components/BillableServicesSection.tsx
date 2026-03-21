import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';

type BillableServicesSectionProps = {
  serviceId?: string;
  serviceName?: string;
  serviceFields: FieldConfig[];
  serviceInfoData: Record<string, any>;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const BillableServicesSection = ({
  serviceId,
  serviceName,
  serviceFields,
  serviceInfoData,
  defaultOpen,
  open,
  onOpenChange,
}: BillableServicesSectionProps) => {
  const hasService = Boolean(serviceId);
  const hasFields = serviceFields.length > 0;
  const hasAnyValue = Object.values(serviceInfoData ?? {}).some(
    (value) => value !== '' && value != null
  );

  return (
    <Accordion
      title="Billable services"
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      showEditIcon={false}
      isEditing={true}
    >
      {hasService && hasFields && hasAnyValue ? (
        <EditableAccordion
          title={serviceName || ''}
          fields={serviceFields}
          data={serviceInfoData}
          defaultOpen={true}
          showEditIcon={false}
        />
      ) : (
        <div className="text-body-4 text-text-secondary py-1">
          Select a service to view billable details.
        </div>
      )}
    </Accordion>
  );
};

export default BillableServicesSection;
