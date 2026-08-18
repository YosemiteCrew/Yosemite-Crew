import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import CalculatorForm from './CalculatorForm';
import { CALCULATORS, type CalculatorConfig } from '@/app/features/calculators/registry';

/**
 * The form is driven by a real registry entry rather than a hand-written config:
 * `CalculatorForm` looks its citation up in `CALCULATOR_REFERENCES[config.key]`,
 * so an invented key would render an undefined reference.
 */
const byKey = (key: string): CalculatorConfig => {
  const config = CALCULATORS.find((entry) => entry.key === key);
  if (!config) {
    throw new Error(`No calculator registered for "${key}"`);
  }
  return config;
};

const FLUID_RATE = byKey('fluid-rate');
const BODY_SURFACE_AREA = byKey('body-surface-area');

const meta = {
  title: 'Calculators/CalculatorForm',
  component: CalculatorForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The body of every clinical calculator: an intro line, an optional species selector, one ' +
          '`FormInput` per registry field, a Calculate button, the result block, the disclaimer and ' +
          'the citation.\n\n' +
          'The result block is the part that had never been drawn. `rows` starts as `null` and is ' +
          'only set inside the `try` of `handleCalculate`, so `CalculatorResult` is not hidden - it ' +
          'is unmounted until a computation succeeds. Rendering the form proves nothing about it.\n\n' +
          '`CalculatorResult` is really two different components behind one prop. **Exactly one row** ' +
          "renders the design's serif hero - the row label becomes a 10.5px uppercase `--ink-faint` " +
          'eyebrow and the value becomes 34px Newsreader with `tabular-nums`. **Two or more** rows ' +
          'render a fixed "Result" eyebrow over a 13px/14px label-value list. Which branch you get is ' +
          'decided by the registry `compute`, sometimes per input: `body-surface-area` returns one ' +
          'row for a bare weight and two once an optional mg/m² dose is supplied, so the same ' +
          'calculator switches typography mid-session. Neither branch existed in any snapshot.\n\n' +
          'Per-field errors are equally gated. `compute` throws a `CalculatorInputError` carrying the ' +
          'offending `field`, and the catch clears `rows` and binds the message to that one input - ' +
          'so the error state and the result state are mutually exclusive by construction, and the ' +
          'input flips to a `--danger` border with a `role="alert"` line beneath it.\n\n' +
          'One correction against the audit that produced this file: the disclaimer and the reference ' +
          'line are **not** gated. They render on first paint, above and below the result slot, which ' +
          'is why a result appearing pushes the citation down rather than replacing anything.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    config: FLUID_RATE,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalculatorForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {
  name: 'Before calculating',
  parameters: {
    docs: {
      description: {
        story:
          'The resting form. Three inputs, the Canine/Feline pills, the warning-toned disclaimer and ' +
          'the citation - and no result block at all between the button and the disclaimer.',
      },
    },
  },
};

export const MultiRowResult: Story = {
  name: 'Result - multi-row list',
  args: {
    initialValues: { weightKg: '18', dehydrationPercent: '7', ongoingLossesMlPerDay: '120' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    // Assert the panel has its rows, not merely that something appeared: an empty
    // result card would still satisfy `findByRole('status')` on its own.
    const result = await canvas.findByRole('status');
    await expect(within(result).getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    await expect(within(result).getByText('Maintenance')).toBeInTheDocument();
    await expect(within(result).getByText('1080 mL/day')).toBeInTheDocument();
    await expect(within(result).getByText('Dehydration deficit')).toBeInTheDocument();
    await expect(within(result).getByText('1260 mL')).toBeInTheDocument();
    await expect(within(result).getByText('Total volume')).toBeInTheDocument();
    await expect(within(result).getByText('2460 mL/day')).toBeInTheDocument();
    await expect(within(result).getByText('Infusion rate')).toBeInTheDocument();
    await expect(within(result).getByText('102.5 mL/hr')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five rows in an `--inset` card with a `--divider` hairline and a 14px radius. Every value is ' +
          '`tabular-nums`, so the numerals stay in a column down the right edge however wide they get - ' +
          'the reason this list can be read as a table without being one.',
      },
    },
  },
};

export const SingleValueResult: Story = {
  name: 'Result - serif hero (one row)',
  args: {
    config: BODY_SURFACE_AREA,
    initialValues: { weightKg: '18' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    const result = await canvas.findByRole('status');
    // The row label is promoted to the eyebrow instead of the literal "Result".
    await expect(
      within(result).getByRole('heading', { name: 'Body surface area' })
    ).toBeInTheDocument();
    await expect(within(result).queryByRole('heading', { name: 'Result' })).not.toBeInTheDocument();
    await expect(within(result).getByText(/m²$/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other branch of the same component, reached by a `compute` that happens to return one ' +
          'row. 34px Newsreader at `leading-[1.1]` and `-0.02em`, over the label as an uppercase ' +
          'eyebrow. Leave the optional mg/m² dose blank and you get this; fill it in and the identical ' +
          'card becomes the 13px list above.',
      },
    },
  },
};

export const SingleBecomesList: Story = {
  name: 'Result - optional input adds a second row',
  args: {
    config: BODY_SURFACE_AREA,
    initialValues: { weightKg: '18', dosePerM2: '250' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    const result = await canvas.findByRole('status');
    // Same calculator, same weight - the optional dose alone flips the typography.
    await expect(within(result).getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    await expect(within(result).getByText('Body surface area')).toBeInTheDocument();
    await expect(within(result).getByText('Total dose')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Directly comparable with the story above: identical calculator and identical weight, one ' +
          'extra optional input. `optionalRow` appends "Total dose" only when the engine returns a ' +
          'number, and the second row is what demotes the serif hero to a list row.',
      },
    },
  },
};

export const RequiredFieldError: Story = {
  name: 'Error - required field',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    const alerts = await canvas.findAllByRole('alert');
    // The error is bound to one field, not raised as a form-level banner.
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent('Weight is required.');
    await expect(canvas.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    // Error and result are mutually exclusive: the catch clears `rows`.
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Calculate on an empty form. `parseRequiredNumber("")` is `NaN`, the engine throws on the ' +
          'first assertion it reaches, and only that input is marked - the two fields below it stay ' +
          'clean, which is the whole point of `CalculatorInputError` carrying a `field`.',
      },
    },
  },
};

export const RangeError: Story = {
  name: 'Error - value out of range',
  args: {
    initialValues: { weightKg: '18', dehydrationPercent: '40', ongoingLossesMlPerDay: '' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent('Dehydration must be between 0 and 15.');
    await expect(canvas.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A plausible value that the engine still rejects (dehydration is capped at 15%). Worth ' +
          'drawing separately from the blank-field case: the error lands on the **second** input, so ' +
          'the alert line has a populated field above it and the 1.5px `--danger` border has to read ' +
          'against a filled control rather than an empty one.',
      },
    },
  },
};

export const FelineSpecies: Story = {
  name: 'Species changes the result',
  args: {
    initialSpecies: 'cat',
    initialValues: { weightKg: '18', dehydrationPercent: '7', ongoingLossesMlPerDay: '120' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Feline' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));

    const result = await canvas.findByRole('status');
    // Feline maintenance is 50 mL/kg/day against the canine 60, so the same
    // 18 kg patient reads 900 rather than 1080.
    await expect(within(result).getByText('900 mL/day')).toBeInTheDocument();
    await expect(within(result).getByText('2280 mL/day')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The species pills are not decoration: the selected value is passed straight into `compute`. ' +
          'The active pill carries `--blue-text` on `--blue-light` with a matching border, and the ' +
          'result below it is a different number from the canine story with identical inputs.',
      },
    },
  },
};
