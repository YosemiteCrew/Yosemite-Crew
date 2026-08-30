import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PhoneStepChips from './PhoneStepChips';
import {
  WORKSPACE_STEPS,
  type StepStatus,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

const status = (overrides: Partial<Record<WorkspaceStep, StepStatus>>) =>
  WORKSPACE_STEPS.reduce(
    (acc, step) => ({ ...acc, [step]: overrides[step] ?? 'EMPTY' }),
    {} as Record<WorkspaceStep, StepStatus>
  );

const meta = {
  title: 'Workspace/PhoneStepChips',
  component: PhoneStepChips,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The snap-scrolling chip row that replaces the dot-and-line stepper on phone. Active is a ' +
          'blue outline with a leading dot, completed is a hairline pill with a green check and a ' +
          'shortened label ("Diagnostics" becomes "Diagn."), upcoming is a plain hairline pill. ' +
          'Every chip navigates, including the ones behind the current step.',
      },
    },
  },
  tags: ['autodocs'],
  args: { onStepChange: fn() },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneStepChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {
  name: 'Opening on SOAP',
  args: { activeStep: 'SOAP', stepStatus: status({}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // aria-current="step" is what a screen reader reads as "you are here"; the
    // blue outline alone would say nothing.
    // Active chips carry the full `WORKSPACE_STEP_LABELS` text ('SOAP Notes');
    // only COMPLETED ones shorten.
    const active = canvas.getByRole('button', { name: 'SOAP Notes' });
    await expect(active).toHaveAttribute('aria-current', 'step');
    await expect(canvasElement.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  },
};

export const MidVisit: Story = {
  name: 'Two steps done, on Treatment',
  args: {
    activeStep: 'TREATMENT',
    stepStatus: status({ SOAP: 'COMPLETED', DIAGNOSTICS: 'COMPLETED' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The shortened label is the whole reason more of the row fits before it
    // scrolls, so assert the abbreviation rather than the full word.
    await expect(canvas.getByRole('button', { name: 'Diagn.' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Diagnostics' })).toBeNull();
    // The active step keeps its FULL label even though it is mid-row.
    await expect(canvas.getByRole('button', { name: 'Treatment' })).toHaveAttribute(
      'aria-current',
      'step'
    );
  },
};

export const NavigatesBackwards: Story = {
  name: 'Tapping a completed chip goes back',
  args: {
    activeStep: 'INVOICE',
    stepStatus: status({
      SOAP: 'COMPLETED',
      DIAGNOSTICS: 'COMPLETED',
      TREATMENT: 'COMPLETED',
      PASSPORT: 'COMPLETED',
    }),
  },
  play: async ({ args, canvasElement }) => {
    // SOAP is completed here, so its chip carries the shortened label.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'SOAP' }));
    await expect(args.onStepChange).toHaveBeenCalledWith('SOAP');
  },
};

export const RowScrolls: Story = {
  name: 'Six chips overflow into a scroller, not a wrap',
  args: {
    activeStep: 'SUMMARY',
    stepStatus: status({
      SOAP: 'COMPLETED',
      DIAGNOSTICS: 'COMPLETED',
      TREATMENT: 'COMPLETED',
      PASSPORT: 'COMPLETED',
      INVOICE: 'COMPLETED',
    }),
  },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('.overflow-x-auto') as HTMLElement;
    await expect(row).not.toBeNull();

    /* The failure this guards against is a WRAP: if the chips wrapped to a second
       line the row would grow taller and push the SOAP editor down, so check that
       the chips all share one row and the excess is scrolled instead. */
    const tops = [...row.querySelectorAll('button')].map((b) =>
      Math.round(b.getBoundingClientRect().top)
    );
    await expect(new Set(tops).size).toBe(1);
    await expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);

    // And nothing leaks past the viewport edge while it does that.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'All six steps at once. The row is the widest fixed piece of workspace chrome on phone, ' +
          'so it is the one most likely to either wrap (stealing height from the editor) or push ' +
          'the page into a horizontal scroll. It does neither: one line, scrolled.',
      },
    },
  },
};
