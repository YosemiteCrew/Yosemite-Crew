'use client';

import { useState } from 'react';
import { Card } from '@/app/ui';
import { LabelDropdown } from '@/app/ui/inputs';
import {
  CALCULATORS,
  CALCULATOR_CATEGORIES,
  calculatorsInCategory,
} from '@/app/features/calculators/registry';
import { type CalculatorSpecies } from '@/app/features/calculators/utils/shared';
import CalculatorForm from '@/app/features/calculators/components/CalculatorForm';

type CalculatorBrowserProps = {
  initialValues?: Record<string, string>;
  initialSpecies?: CalculatorSpecies;
};

const CalculatorBrowser = ({ initialValues, initialSpecies }: CalculatorBrowserProps) => {
  const [category, setCategory] = useState(CALCULATOR_CATEGORIES[0]);
  const [activeKey, setActiveKey] = useState(CALCULATORS[0].key);

  const handleCategory = (next: string) => {
    setCategory(next);
    setActiveKey(calculatorsInCategory(next)[0].key);
  };

  const calculators = calculatorsInCategory(category);
  const active = CALCULATORS.find((calc) => calc.key === activeKey) ?? calculators[0];

  return (
    <div className="flex flex-col gap-4">
      <LabelDropdown
        placeholder="Category"
        options={CALCULATOR_CATEGORIES.map((name) => ({ label: name, value: name }))}
        defaultOption={category}
        onSelect={(option) => handleCategory(option.value)}
      />
      <LabelDropdown
        placeholder="Calculator"
        options={calculators.map((calc) => ({ label: calc.label, value: calc.key }))}
        defaultOption={activeKey}
        onSelect={(option) => setActiveKey(option.value)}
      />
      <Card variant="bordered" className="p-5">
        <CalculatorForm
          key={active.key}
          config={active}
          initialValues={initialValues}
          initialSpecies={initialSpecies}
        />
      </Card>
    </div>
  );
};

export default CalculatorBrowser;
