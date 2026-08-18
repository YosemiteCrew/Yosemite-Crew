import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { LabResultTest } from '@/app/features/integrations/services/types';

import LabResultValue from './index';

/** Opens the disclosure and hands back the `<details>` and the notes it holds. */
const openInterpretationNotes = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const summary = canvas.getByText('Interpretation notes');
  const details = summary.closest('details') as HTMLDetailsElement;
  const notes = details.querySelector('div') as HTMLElement;
  // Collapsed on first paint: the key is in the DOM the whole time, which is
  // why "it is in the document" proves nothing here.
  await expect(notes).not.toBeVisible();
  await userEvent.click(summary);
  await expect(details.open).toBe(true);
  return { canvas, details, notes };
};

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
          'bury the numbers.\n\n' +
          'That `<details>` is the one surface here nothing had ever drawn. `CultureResult` and ' +
          '`LongCultureResult` both render it **shut**, so every snapshot of this component showed ' +
          'a one-line "Interpretation notes" summary and none showed what is under it - which is ' +
          'the legend explaining what the S, I and R in the table above actually mean. It is the ' +
          'only unstyled native control in the widget: no chevron, no token colours of its own ' +
          'beyond `text-caption-1 text-text-secondary`, just the browser marker, and the panel is a ' +
          '`whitespace-pre-wrap` block whose line breaks come from the source text rather than from ' +
          'markup.\n\n' +
          'Opening it is also the only way to see the interaction between the disclosure and the ' +
          '`max-h-52 overflow-y-auto` cap on the whole block: the notes expand *inside* a fixed ' +
          'height, so on a long panel the newly revealed lines are pushed below the fold and have ' +
          'to be scrolled to rather than growing the row. The stories below open it and assert the ' +
          'legend text is visible, not merely present - a closed `<details>` keeps its children in ' +
          'the DOM, so the weaker check passes on a disclosure that never opened.',
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

/**
 * The interpretation key, open. This is the only story that draws it: the two
 * above render the same disclosure shut, so the legend that explains the S/I/R
 * column had never appeared in a snapshot.
 */
export const InterpretationNotesOpen: Story = {
  name: 'Interpretation notes open',
  args: {
    test: { name: 'Culture Results - Urine', result: CULTURE_RESULT } satisfies LabResultTest,
  },
  play: async ({ canvasElement }) => {
    const { canvas, notes } = await openInterpretationNotes(canvasElement);
    // Assert the panel has its LEGEND, line by line. Visibility is the load
    // bearing part: the text is in the DOM while the disclosure is shut.
    await expect(notes).toBeVisible();
    await expect(notes).toHaveTextContent('INTERPRETATION KEY');
    await expect(notes).toHaveTextContent('S = Susceptible at the labelled dose.');
    await expect(notes).toHaveTextContent('I = Intermediate; consider a higher dose');
    await expect(notes).toHaveTextContent('R = Resistant; do not use.');
    // The legend is only meaningful against the table it explains, so pin that
    // the two are on screen together: header row plus five antibiotics.
    await expect(canvas.getAllByRole('row')).toHaveLength(6);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The key sits directly under the table, in the same 12px secondary ink, with its line ' +
          'breaks coming from `whitespace-pre-wrap` on the raw text rather than from list markup.',
      },
    },
  },
};

/**
 * The same disclosure at the bottom of a result that already fills the block.
 * Opening it does not make the row taller - it scrolls.
 */
export const LongCultureNotesOpen: Story = {
  name: 'Interpretation notes open (overflowing)',
  args: { test: { name: 'Culture Results - Ear', result: LONG_CULTURE_RESULT } },
  play: async ({ canvasElement }) => {
    const { details, notes } = await openInterpretationNotes(canvasElement);
    await expect(notes).toBeVisible();
    await expect(notes).toHaveTextContent(
      'Topical therapy may still succeed where systemic therapy reads resistant.'
    );
    // The disclosure lives inside the capped, scrolling block - so what it
    // reveals lands below the fold instead of growing the row it sits in.
    await expect(details.parentElement).toHaveClass('max-h-52');
    await expect(details.parentElement).toHaveClass('overflow-y-auto');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two isolates, ten antibiotics and a fourth legend line. With the notes open the content ' +
          'is well past the 208px cap, so this is the frame that shows the disclosure competing with ' +
          'the scroller rather than expanding the row.',
      },
    },
  },
};
