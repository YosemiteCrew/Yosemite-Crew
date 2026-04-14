import React, { useMemo } from 'react';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { CompanionParent, StoredParent } from '@/app/features/companions/pages/Companions/types';
import { updateParent } from '@/app/features/companions/services/companionService';

const Fields = [
  { label: 'First name', key: 'firstName', type: 'text', required: true },
  { label: 'Last name', key: 'lastName', type: 'text', required: true },
  { label: 'Email', key: 'email', type: 'email', editable: false },
  { label: 'Phone number', key: 'phoneNumber', type: 'tel', editable: false },
  { label: 'Address line', key: 'addressLine', type: 'text', editable: false },
  { label: 'City', key: 'city', type: 'text', editable: false },
  { label: 'State / Province', key: 'state', type: 'text', editable: false },
  { label: 'Postal code', key: 'postalCode', type: 'text', editable: false },
];

type ParentType = {
  companion: CompanionParent;
};

const Parent = ({ companion }: ParentType) => {
  const parentData = useMemo(
    () => ({
      ...companion.parent,
      addressLine: companion.parent.address?.addressLine ?? '',
      city: companion.parent.address?.city ?? '',
      state: companion.parent.address?.state ?? '',
      postalCode: companion.parent.address?.postalCode ?? '',
    }),
    [companion.parent]
  );

  const handleSave = async (values: any) => {
    try {
      const newParent: StoredParent = {
        ...companion.parent,
        firstName: values.firstName,
        lastName: values.lastName,
      };
      await updateParent(newParent);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        title="Parent information"
        fields={Fields}
        data={parentData}
        defaultOpen={true}
        showEditIcon={false}
        onSave={handleSave}
      />
    </div>
  );
};

export default Parent;
