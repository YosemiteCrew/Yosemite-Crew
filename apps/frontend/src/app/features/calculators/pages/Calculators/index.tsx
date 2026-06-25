'use client';

import { useState } from 'react';
import { Card, Text } from '@/app/ui';
import { SelectLabel } from '@/app/ui/inputs';
import {
  CALCULATORS,
  CALCULATOR_CATEGORIES,
  calculatorsInCategory,
} from '@/app/features/calculators/registry';
import CalculatorForm from '@/app/features/calculators/components/CalculatorForm';

const Calculators = () => {
  const [category, setCategory] = useState(CALCULATOR_CATEGORIES[0]);
  const [activeKey, setActiveKey] = useState(CALCULATORS[0].key);

  const handleCategory = (next: string) => {
    setCategory(next);
    setActiveKey(calculatorsInCategory(next)[0].key);
  };

  const calculators = calculatorsInCategory(category);
  const active = CALCULATORS.find((calc) => calc.key === activeKey) ?? calculators[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Text as="h1" variant="heading-1" className="text-text-primary">
          Veterinary calculators
        </Text>
        <Text as="p" variant="body-3" className="text-text-secondary">
          Clinical calculators for fluids, dosing, electrolytes, nutrition, and more.
        </Text>
      </div>

      <SelectLabel
        title="Category"
        type="coloumn"
        options={CALCULATOR_CATEGORIES.map((name) => ({ label: name, value: name }))}
        activeOption={category}
        setOption={handleCategory}
      />
      <SelectLabel
        title="Calculator"
        type="coloumn"
        options={calculators.map((calc) => ({ label: calc.label, value: calc.key }))}
        activeOption={activeKey}
        setOption={setActiveKey}
      />

      <Card variant="bordered" className="p-6">
        <CalculatorForm key={active.key} config={active} />
      </Card>
    </div>
  );
};

export default Calculators;
