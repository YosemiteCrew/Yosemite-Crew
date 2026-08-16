import type { Meta, StoryObj } from '@storybook/react';
import type { LabResultTest } from '@/app/features/integrations/services/types';

import LabResultValue from './index';

const CULTURE_RESULT = [
  'Specimen: Urine, cystocentesis',
  'Colony Count: >100,000 CFU/mL',
  'Isolate 1: Escherichia coli',
  'Isolate 1 MIC',
  'Amoxicillin/Clavulanate S 8',
  'Cefpodoxime S 2',
  'Enrofloxacin R >4',
  'Gentamicin S 2',
  'Trimethoprim/Sulfa I 2',
  '**INTERPRETATION KEY**',
  'S = Susceptible at the labelled dose.',
  'I = Intermediate; consider a higher dose or a different agent.',
  'R = Resistant; do not use.',
].join('\n');

const LONG_CULTURE_RESULT = [
  'Specimen: Deep ear swab, left',
  'Colony Count: Moderate growth',
  'Isolate 1: Pseudomonas aeruginosa',
  'Isolate 2: Staphylococcus pseudintermedius',
  'Isolate 1 MIC',
  'Amikacin S 4',
  'Ceftazidime S 4',
  'Ciprofloxacin I 2',
  'Enrofloxacin R >4',
  'Gentamicin S 2',
  'Marbofloxacin R >4',
  'Piperacillin/Tazobactam S 16',
  'Polymyxin B S 1',
  'Ticarcillin/Clavulanate S 16',
  'Tobramycin S 1',
  '**INTERPRETATION KEY**',
  'S = Susceptible at the labelled dose.',
  'I = Intermediate; consider a higher dose or a different agent.',
  'R = Resistant; do not use.',
  'Topical therapy may still succeed where systemic therapy reads resistant.',
].join('\n');

const meta = {
  title: 'Widgets/LabResultValue',
  component: LabResultValue,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders the value cell of one lab result row. Ordinary tests print as `result units` and ' +
          'nothing more. A culture-and-sensitivity result arrives as a wall of plain text, so this ' +
          'component parses it into the parts a vet reads: the specimen summary, the isolates, a ' +
          'susceptibility table, and the interpretation key folded into a `<details>` so it does not ' +
          'bury the numbers.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (StoryFn) => (
      <div className="max-w-[520px] text-caption-1 text-text-primary">
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof LabResultValue>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: a number and its units, inline in the row. */
export const NumericValue: Story = {
  name: 'Numeric value',
  args: {
    test: { name: 'Creatinine', result: '1.4', units: 'mg/dL', referenceRange: '0.5 - 1.8' },
  },
};

/** No units on the payload — the value stands alone, with no trailing space. */
export const TextValue: Story = {
  name: 'Text value, no units',
  args: { test: { name: 'Urine appearance', result: 'Clear, pale yellow' } },
};

/**
 * A culture result. The same string that would otherwise print as ten
 * unreadable lines becomes a summary, the isolate, a susceptibility table and a
 * collapsed interpretation key.
 */
export const CultureResult: Story = {
  name: 'Culture and sensitivity',
  args: {
    test: { name: 'Culture Results - Urine', result: CULTURE_RESULT } satisfies LabResultTest,
  },
};

/**
 * Two isolates and a long antibiotic panel. The block caps at `max-h-52` and
 * scrolls internally, and the table gets its own horizontal scroll, so a large
 * result cannot stretch the row it sits in.
 */
export const LongCultureResult: Story = {
  name: 'Culture with overflow',
  args: { test: { name: 'Culture Results - Ear', result: LONG_CULTURE_RESULT } },
};
