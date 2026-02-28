import React from 'react';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { CompanionParent, StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { GenderOptionsSmall, PetSourceOptions } from '@/app/features/companions/types/companion';
import { updateCompanion } from '@/app/features/companions/services/companionService';
import { NeuteredOptions } from '@/app/features/companions/components/AddCompanion/type';

const BaseFields = [
  { label: 'Date of birth', key: 'dateOfBirth', type: 'date', required: true },
  {
    label: 'Gender',
    key: 'gender',
    type: 'select',
    options: GenderOptionsSmall,
  },
  { label: 'Current weight (lbs)', key: 'currentWeight', type: 'number' },
  { label: 'Color', key: 'colour', type: 'text' },
  {
    label: 'Neutered status',
    key: 'isneutered',
    type: 'select',
    options: NeuteredOptions,
  },
  { label: 'Age when neutered', key: 'ageWhenNeutered', type: 'number' },
  { label: 'Blood group', key: 'bloodGroup', type: 'text' },
  { label: 'Country of origin', key: 'countryOfOrigin', type: 'country' },
  {
    label: 'Companion came from',
    key: 'source',
    type: 'select',
    options: PetSourceOptions,
  },
  { label: 'Microchip number', key: 'microchipNumber', type: 'text' },
  { label: 'Passport number', key: 'passportNumber', type: 'text' },
  { label: 'Insurance status', key: 'insuranceStatus', type: 'text' },
];

const toNonNegativeNumber = (value: unknown): number | undefined => {
  const normalized = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.max(0, parsed);
};

type CompanionType = {
  companion: CompanionParent;
};

const Companion = ({ companion }: CompanionType) => {
  const hasInsuranceDetails =
    Boolean(companion.companion?.insurance?.companyName) ||
    Boolean(companion.companion?.insurance?.policyNumber);
  const isInsured = Boolean(companion.companion?.isInsured) || hasInsuranceDetails;
  const fields = isInsured
    ? [
        ...BaseFields,
        { label: 'Insurance policy', key: 'companyName', type: 'text' },
        { label: 'Insurance number', key: 'policyNumber', type: 'text' },
      ]
    : BaseFields;

  const handleSave = async (values: any) => {
    try {
      const newCompanion: StoredCompanion = {
        ...companion.companion,
        dateOfBirth: new Date(values.dateOfBirth),
        gender: values.gender,
        currentWeight: toNonNegativeNumber(values.currentWeight),
        colour: values.colour,
        isneutered: values.isneutered === 'true',
        ageWhenNeutered:
          values.isneutered === 'true'
            ? toNonNegativeNumber(values.ageWhenNeutered)?.toString()
            : '',
        bloodGroup: values.bloodGroup,
        countryOfOrigin: values.country,
        source: values.source,
        microchipNumber: values.microchipNumber,
        passportNumber: values.passportNumber,
        isInsured: Boolean(values.policyNumber) || Boolean(values.companyName),
        insurance: {
          isInsured: Boolean(values.policyNumber) || Boolean(values.companyName),
          policyNumber: values.policyNumber,
          companyName: values.companyName,
        },
      };
      await updateCompanion(newCompanion);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        title="Companion information"
        fields={fields}
        data={{
          ...companion.companion,
          ...companion.companion.insurance,
          insuranceStatus: isInsured ? 'Insured' : 'Not insured',
          isneutered: companion.companion.isneutered ? 'true' : 'false',
        }}
        defaultOpen={true}
        compactInlineActions
        onSave={handleSave}
      />
    </div>
  );
};

export default Companion;
