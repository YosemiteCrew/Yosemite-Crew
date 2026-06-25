'use client';

import { useState } from 'react';
import { Button, Text } from '@/app/ui';
import { FormInput, SelectLabel } from '@/app/ui/inputs';
import { SPECIES_OPTIONS, CLINICAL_DISCLAIMER } from '@/app/features/calculators/constants';
import {
  calculateBodySurfaceArea,
  CalculatorInputError,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/calculations';
import { parseOptionalNumber, parseRequiredNumber } from '@/app/features/calculators/utils/form';
import CalculatorResult, {
  type ResultRow,
} from '@/app/features/calculators/components/CalculatorResult';
import Disclaimer from '@/app/features/calculators/components/Disclaimer';

const BodySurfaceAreaCalculator = () => {
  const [species, setSpecies] = useState<CalculatorSpecies>('dog');
  const [weight, setWeight] = useState('');
  const [dosePerM2, setDosePerM2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ResultRow[] | null>(null);

  const handleCalculate = () => {
    try {
      const result = calculateBodySurfaceArea({
        species,
        weightKg: parseRequiredNumber(weight),
        dosePerM2: parseOptionalNumber(dosePerM2),
      });
      const nextRows: ResultRow[] = [{ label: 'Body surface area', value: `${result.bsaM2} m²` }];
      if (result.totalDoseMg !== null) {
        nextRows.push({ label: 'Total dose', value: `${result.totalDoseMg} mg` });
      }
      setErrors({});
      setRows(nextRows);
    } catch (error) {
      const inputError = error as CalculatorInputError;
      setRows(null);
      setErrors({ [inputError.field]: inputError.message });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Text as="p" variant="body-4" className="text-text-secondary">
        Body surface area from weight, with optional mg/m² dose for BSA-normalised dosing.
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
        inname="dosePerM2"
        inlabel="Dose (mg/m², optional)"
        value={dosePerM2}
        onChange={(e) => setDosePerM2(e.target.value)}
        error={errors.dosePerM2}
      />

      <Button text="Calculate" variant="primary" onClick={handleCalculate} />

      {rows && <CalculatorResult rows={rows} />}

      <Disclaimer text={CLINICAL_DISCLAIMER} />
    </div>
  );
};

export default BodySurfaceAreaCalculator;
