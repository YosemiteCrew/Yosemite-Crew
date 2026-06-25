'use client';

import { useState } from 'react';
import { Button, Text } from '@/app/ui';
import { FormInput } from '@/app/ui/inputs';
import { CLINICAL_DISCLAIMER } from '@/app/features/calculators/constants';
import {
  calculateDrugDose,
  CalculatorInputError,
} from '@/app/features/calculators/utils/calculations';
import { parseOptionalNumber, parseRequiredNumber } from '@/app/features/calculators/utils/form';
import CalculatorResult, {
  type ResultRow,
} from '@/app/features/calculators/components/CalculatorResult';
import Disclaimer from '@/app/features/calculators/components/Disclaimer';

const DrugDoseCalculator = () => {
  const [weight, setWeight] = useState('');
  const [dose, setDose] = useState('');
  const [concentration, setConcentration] = useState('');
  const [frequency, setFrequency] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ResultRow[] | null>(null);

  const handleCalculate = () => {
    try {
      const result = calculateDrugDose({
        weightKg: parseRequiredNumber(weight),
        doseMgPerKg: parseRequiredNumber(dose),
        concentrationMgPerMl: parseOptionalNumber(concentration),
        frequencyPerDay: parseOptionalNumber(frequency),
      });
      const nextRows: ResultRow[] = [
        { label: 'Dose per administration', value: `${result.doseMgPerAdministration} mg` },
        { label: 'Frequency', value: `${result.frequencyPerDay} ×/day` },
        { label: 'Daily dose', value: `${result.dailyDoseMg} mg/day` },
      ];
      if (result.volumeMlPerAdministration !== null) {
        nextRows.push({
          label: 'Volume per administration',
          value: `${result.volumeMlPerAdministration} mL`,
        });
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
        Dose by body weight, with optional concentration to get the volume to draw up.
      </Text>

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
        inname="doseMgPerKg"
        inlabel="Dose (mg/kg)"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        error={errors.doseMgPerKg}
      />
      <FormInput
        intype="number"
        inname="concentrationMgPerMl"
        inlabel="Concentration (mg/mL, optional)"
        value={concentration}
        onChange={(e) => setConcentration(e.target.value)}
        error={errors.concentrationMgPerMl}
      />
      <FormInput
        intype="number"
        inname="frequencyPerDay"
        inlabel="Frequency (per day, optional)"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        error={errors.frequencyPerDay}
      />

      <Button text="Calculate" variant="primary" onClick={handleCalculate} />

      {rows && <CalculatorResult rows={rows} />}

      <Disclaimer text={CLINICAL_DISCLAIMER} />
    </div>
  );
};

export default DrugDoseCalculator;
