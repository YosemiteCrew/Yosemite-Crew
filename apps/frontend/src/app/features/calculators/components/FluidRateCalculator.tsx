'use client';

import { useState } from 'react';
import { Button, Text } from '@/app/ui';
import { FormInput, SelectLabel } from '@/app/ui/inputs';
import { SPECIES_OPTIONS, CLINICAL_DISCLAIMER } from '@/app/features/calculators/constants';
import {
  calculateFluidRate,
  CalculatorInputError,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/calculations';
import { parseOptionalNumber, parseRequiredNumber } from '@/app/features/calculators/utils/form';
import CalculatorResult, {
  type ResultRow,
} from '@/app/features/calculators/components/CalculatorResult';
import Disclaimer from '@/app/features/calculators/components/Disclaimer';

const FluidRateCalculator = () => {
  const [species, setSpecies] = useState<CalculatorSpecies>('dog');
  const [weight, setWeight] = useState('');
  const [dehydration, setDehydration] = useState('');
  const [losses, setLosses] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ResultRow[] | null>(null);

  const handleCalculate = () => {
    try {
      const result = calculateFluidRate({
        species,
        weightKg: parseRequiredNumber(weight),
        dehydrationPercent: parseRequiredNumber(dehydration),
        ongoingLossesMlPerDay: parseOptionalNumber(losses),
      });
      setErrors({});
      setRows([
        { label: 'Maintenance', value: `${result.maintenanceMlPerDay} mL/day` },
        { label: 'Dehydration deficit', value: `${result.deficitMl} mL` },
        { label: 'Ongoing losses', value: `${result.ongoingLossesMlPerDay} mL/day` },
        { label: 'Total volume', value: `${result.totalMlPerDay} mL/day` },
        { label: 'Infusion rate', value: `${result.ratePerHourMl} mL/hr` },
      ]);
    } catch (error) {
      const inputError = error as CalculatorInputError;
      setRows(null);
      setErrors({ [inputError.field]: inputError.message });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Text as="p" variant="body-4" className="text-text-secondary">
        Maintenance fluids plus dehydration deficit and ongoing losses, given over 24 hours.
      </Text>

      <SelectLabel
        title="Species"
        options={[...SPECIES_OPTIONS]}
        activeOption={species}
        setOption={(value) => setSpecies(value as CalculatorSpecies)}
      />

      <FormInput
        intype="number"
        inname="weightKg"
        inlabel="Weight (kg)"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        error={errors.weightKg}
      />
      <FormInput
        intype="number"
        inname="dehydrationPercent"
        inlabel="Dehydration (%)"
        value={dehydration}
        onChange={(e) => setDehydration(e.target.value)}
        error={errors.dehydrationPercent}
      />
      <FormInput
        intype="number"
        inname="ongoingLossesMlPerDay"
        inlabel="Ongoing losses (mL/day, optional)"
        value={losses}
        onChange={(e) => setLosses(e.target.value)}
        error={errors.ongoingLossesMlPerDay}
      />

      <Button text="Calculate" variant="primary" onClick={handleCalculate} />

      {rows && <CalculatorResult rows={rows} />}

      <Disclaimer text={CLINICAL_DISCLAIMER} />
    </div>
  );
};

export default FluidRateCalculator;
