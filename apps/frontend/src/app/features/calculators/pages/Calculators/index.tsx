'use client';

import { useState } from 'react';
import { Card, Text } from '@/app/ui';
import { SelectLabel } from '@/app/ui/inputs';
import { CALCULATOR_TABS, type CalculatorKey } from '@/app/features/calculators/constants';
import FluidRateCalculator from '@/app/features/calculators/components/FluidRateCalculator';
import DrugDoseCalculator from '@/app/features/calculators/components/DrugDoseCalculator';
import BodySurfaceAreaCalculator from '@/app/features/calculators/components/BodySurfaceAreaCalculator';

const Calculators = () => {
  const [activeTab, setActiveTab] = useState<CalculatorKey>('fluid-rate');

  const renderActiveCalculator = () => {
    if (activeTab === 'fluid-rate') return <FluidRateCalculator />;
    if (activeTab === 'drug-dose') return <DrugDoseCalculator />;
    return <BodySurfaceAreaCalculator />;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Text as="h1" variant="heading-1" className="text-text-primary">
          Veterinary calculators
        </Text>
        <Text as="p" variant="body-3" className="text-text-secondary">
          Quick clinical calculators for fluid therapy, drug dosing, and body surface area.
        </Text>
      </div>

      <SelectLabel
        title="Calculator"
        options={[...CALCULATOR_TABS]}
        activeOption={activeTab}
        setOption={(value) => setActiveTab(value as CalculatorKey)}
      />

      <Card variant="bordered" className="p-6">
        {renderActiveCalculator()}
      </Card>
    </div>
  );
};

export default Calculators;
