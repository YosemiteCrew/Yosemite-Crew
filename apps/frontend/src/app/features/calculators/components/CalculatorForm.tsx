'use client';

import { useState } from 'react';
import { Button, Text } from '@/app/ui';
import { FormInput, SelectLabel } from '@/app/ui/inputs';
import { SPECIES_OPTIONS, CLINICAL_DISCLAIMER } from '@/app/features/calculators/constants';
import {
  CalculatorInputError,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/shared';
import CalculatorResult, {
  type ResultRow,
} from '@/app/features/calculators/components/CalculatorResult';
import Disclaimer from '@/app/features/calculators/components/Disclaimer';
import { type CalculatorConfig } from '@/app/features/calculators/registry';

type CalculatorFormProps = {
  config: CalculatorConfig;
  initialValues?: Record<string, string>;
  initialSpecies?: CalculatorSpecies;
};

const CalculatorForm = ({ config, initialValues, initialSpecies }: CalculatorFormProps) => {
  const [species, setSpecies] = useState<CalculatorSpecies>(initialSpecies ?? 'dog');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [field.name, initialValues?.[field.name] ?? ''])
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ResultRow[] | null>(null);

  const handleChange = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleCalculate = () => {
    try {
      const result = config.compute(values, species);
      setErrors({});
      setRows(result);
    } catch (error) {
      const inputError = error as CalculatorInputError;
      setRows(null);
      setErrors({ [inputError.field]: inputError.message });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Text as="p" variant="body-4" className="text-text-secondary">
        {config.intro}
      </Text>

      {config.species && (
        <SelectLabel
          title="Species"
          options={[...SPECIES_OPTIONS]}
          activeOption={species}
          setOption={(value) => setSpecies(value as CalculatorSpecies)}
        />
      )}

      {config.fields.map((field) => (
        <FormInput
          key={field.name}
          intype={field.type ?? 'number'}
          inname={field.name}
          inlabel={field.label}
          value={values[field.name]}
          onChange={(e) => handleChange(field.name, e.target.value)}
          error={errors[field.name]}
        />
      ))}

      <Button text="Calculate" variant="primary" onClick={handleCalculate} />

      {rows && <CalculatorResult rows={rows} />}

      <Disclaimer text={CLINICAL_DISCLAIMER} />
    </div>
  );
};

export default CalculatorForm;
