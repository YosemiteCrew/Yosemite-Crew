import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import WorkspaceTreatmentSummary from './WorkspaceTreatmentSummary';

/**
 * Reads the money out of a summary row. The two count rows render as
 * "2 · $125", the total as "$167", so taking the part after the separator
 * works for both and lets a story assert the arithmetic rather than a
 * hardcoded string.
 */
const moneyOf = (element: HTMLElement): number =>
  Number(
    (element.textContent ?? '')
      .split('·')
      .pop()
      ?.replace(/[^0-9.]/g, '') ?? ''
  );

const meta = {
  title: 'Workspace/WorkspaceTreatmentSummary',
  component: WorkspaceTreatmentSummary,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The treatment step right-rail "Running total" panel. Two count rows and their gross, a ' +
          'running total that is simply their sum (no deposit, no tax - those land on the invoice ' +
          'step), and a carry sentence underneath. The sentence is the part with branches: it names ' +
          'only the halves that are non-zero, singularises each noun on its own count, joins the two ' +
          'with " + ", and falls back to an instruction when nothing has been added at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    treatmentCount: 2,
    treatmentCents: 12500,
    prescriptionCount: 1,
    prescriptionCents: 4200,
    currency: 'USD',
  },
} satisfies Meta<typeof WorkspaceTreatmentSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Treatment items and prescriptions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The panel is a landmark so the rail is reachable without sighted scanning.
    const panel = canvas.getByRole('region', { name: 'Treatment summary' });

    /* The running total exists to be the sum of the rows above it. Asserting the
       arithmetic rather than "$167" catches a future deposit/tax deduction being
       wired in here instead of on the invoice step. */
    const treatments = within(panel).getByText('2 · $125');
    const prescriptions = within(panel).getByText('1 · $42');
    const total = within(panel).getByText('$167');
    await expect(moneyOf(total)).toBe(moneyOf(treatments) + moneyOf(prescriptions));

    // Both halves present: the counts join, and each noun is pluralised on its own count.
    await expect(
      canvas.getByText('2 treatment items + 1 prescription will be carried to the invoice step.')
    ).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'Nothing added yet',
  args: {
    treatmentCount: 0,
    treatmentCents: 0,
    prescriptionCount: 0,
    prescriptionCents: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Add treatment items or prescriptions to build the invoice.')
    ).toBeInTheDocument();
    /* Not "0 treatment items + 0 prescriptions will be carried": with nothing to
       carry the sentence has to switch to an instruction, or the rail reads as a
       promise about an empty invoice. */
    await expect(canvas.queryByText(/will be carried/)).toBeNull();
    // The rows still render their zeroes rather than collapsing, so the clinician
    // can see the total is genuinely zero and not just missing.
    await expect(canvas.getAllByText('0 · $0')).toHaveLength(2);
  },
};

export const SingleTreatmentItem: Story = {
  name: 'One treatment item, no prescriptions',
  args: {
    treatmentCount: 1,
    treatmentCents: 8500,
    prescriptionCount: 0,
    prescriptionCents: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Singular noun, and the prescriptions half is dropped from the sentence
    // entirely rather than appearing as "+ 0 prescriptions".
    await expect(
      canvas.getByText('1 treatment item will be carried to the invoice step.')
    ).toBeInTheDocument();
  },
};

export const PrescriptionsOnly: Story = {
  name: 'Prescriptions only',
  args: {
    treatmentCount: 0,
    treatmentCents: 0,
    prescriptionCount: 3,
    prescriptionCents: 6400,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The other side of the join: the sentence must start with the prescriptions
       when there are no treatment items, not lead with an empty first part. */
    await expect(
      canvas.getByText('3 prescriptions will be carried to the invoice step.')
    ).toBeInTheDocument();
  },
};

export const NonUsdCurrency: Story = {
  name: 'A sterling clinic',
  args: {
    treatmentCount: 2,
    treatmentCents: 9800,
    prescriptionCount: 1,
    prescriptionCents: 3000,
    currency: 'GBP',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByRole('region', { name: 'Treatment summary' });
    await expect(within(panel).getByText('£128')).toBeInTheDocument();
    /* Every amount goes through formatMoney with the encounter's currency, so a
       dollar sign anywhere in the panel means a hardcoded symbol has crept back in. */
    await expect(panel.textContent).not.toContain('$');
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // The panel is w-full with no min-width, so the label/amount rows have to
    // stay inside a 375px canvas rather than pushing the workspace sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
