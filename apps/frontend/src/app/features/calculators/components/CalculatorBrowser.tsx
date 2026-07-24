'use client';

import { useState } from 'react';
import { Card } from '@/app/ui';
import { LabelDropdown } from '@/app/ui/inputs';
import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
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

// The design's calculators panel switches category on a segmented pill track
// rather than a dropdown. The registry carries more categories than fit a
// narrow panel, so the track scrolls horizontally instead of wrapping.
const CATEGORY_OPTIONS: ReadonlyArray<SegmentedPillOption<string>> = CALCULATOR_CATEGORIES.map(
  (name) => ({ label: name, value: name })
);

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
      <div className="-mx-1 overflow-x-auto px-1 pb-px">
        <div className="w-max">
          <SegmentedPill
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={handleCategory}
            ariaLabel="Calculator category"
            size="md"
          />
        </div>
      </div>
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
