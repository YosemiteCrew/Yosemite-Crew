import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { StepStatus, WorkspaceStep } from '@/app/features/appointments/types/workspace';
import WorkspaceStepper from './WorkspaceStepper';

const idle = (
  overrides: Partial<Record<WorkspaceStep, StepStatus>> = {}
): Record<WorkspaceStep, StepStatus> => ({
  SOAP: 'EMPTY',
  DIAGNOSTICS: 'EMPTY',
  TREATMENT: 'EMPTY',
  PASSPORT: 'EMPTY',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
  ...overrides,
});

/**
 * The connectors are the direct `span` children of each `li`; the step markers are
 * one level deeper, inside the button. Selecting on the Tailwind classes instead
 * would return an empty list after a rename and every assertion below would pass
 * on nothing.
 */
const connectors = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll('li > span')) as HTMLElement[];

/** Solid = a flat `--divider` fill; still-ahead = the dashed gradient. */
const isSolid = (connector: HTMLElement): boolean =>
  globalThis.getComputedStyle(connector).backgroundImage === 'none';

/** A completed, non-active step is the only marker that carries the check glyph. */
const hasCheck = (step: HTMLElement): boolean => step.querySelector('svg') !== null;

const meta = {
  title: 'Workspace/WorkspaceStepper',
  component: WorkspaceStepper,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The six-step visit rail (SOAP Notes, Diagnostics, Treatment, Passport, Invoice, Summary). ' +
          'Three marker treatments: a filled CTA disc with a check for a finished step, a ringed blue ' +
          'dot for the step being worked on, and a muted dot for everything else. The rule between two ' +
          'markers only goes solid when the steps on BOTH sides are finished, so the dashed run is ' +
          'exactly the work still ahead. Every step is clickable, including the ones nobody has ' +
          'opened yet.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeStep: 'SOAP',
    stepStatus: idle(),
    onStepChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="px-4 py-6" style={{ background: 'var(--screen)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkspaceStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Start of the visit',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const steps = canvas.getAllByRole('button');
    await expect(steps).toHaveLength(6);

    /* `aria-current="step"` is the only machine-readable marker of where the
       clinician is - the blue ring is invisible to a screen reader - and it must be
       on exactly one step. */
    const current = steps.filter((step) => step.getAttribute('aria-current') === 'step');
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveAccessibleName('SOAP Notes');

    // Nothing is finished, so no rule is solid and no marker carries a check.
    await expect(connectors(canvasElement)).toHaveLength(5);
    await expect(connectors(canvasElement).some(isSolid)).toBe(false);
    await expect(steps.some(hasCheck)).toBe(false);

    // A step nobody has opened is still reachable - the stepper gates nothing.
    await userEvent.click(canvas.getByRole('button', { name: 'Invoice' }));
    await expect(args.onStepChange).toHaveBeenCalledWith('INVOICE');
  },
};

export const MidVisit: Story = {
  name: 'Treatment underway, notes and diagnostics done',
  args: {
    activeStep: 'TREATMENT',
    stepStatus: idle({
      SOAP: 'COMPLETED',
      DIAGNOSTICS: 'COMPLETED',
      TREATMENT: 'IN_PROGRESS',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(hasCheck(canvas.getByRole('button', { name: 'SOAP Notes' }))).toBe(true);
    await expect(hasCheck(canvas.getByRole('button', { name: 'Diagnostics' }))).toBe(true);
    await expect(hasCheck(canvas.getByRole('button', { name: 'Treatment' }))).toBe(false);

    const [soapToDiagnostics, diagnosticsToTreatment] = connectors(canvasElement);
    // Both ends finished, so the rule is solid.
    await expect(isSolid(soapToDiagnostics)).toBe(true);
    /* The rule INTO the step being worked on stays dashed. Reading the left step
       alone would light this one up and claim the visit is further along than it
       is. */
    await expect(isSolid(diagnosticsToTreatment)).toBe(false);
  },
};

export const ActiveStepAlreadyComplete: Story = {
  name: 'Re-opening a finished step',
  args: {
    activeStep: 'DIAGNOSTICS',
    stepStatus: idle({ SOAP: 'COMPLETED', DIAGNOSTICS: 'COMPLETED' }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A clinician can go back into a step they already finished. Active beats completed on the ' +
          'marker: it keeps the blue ring so "where I am" stays findable, instead of dissolving into ' +
          'the row of filled discs behind it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reopened = canvas.getByRole('button', { name: 'Diagnostics' });
    await expect(reopened).toHaveAttribute('aria-current', 'step');
    // Completed AND active: the ring wins, so no check glyph here.
    await expect(hasCheck(reopened)).toBe(false);
    await expect(hasCheck(canvas.getByRole('button', { name: 'SOAP Notes' }))).toBe(true);

    /* The connector still reads both statuses, not the markers: SOAP and
       DIAGNOSTICS are both COMPLETED, so this rule is solid even though the step
       on its right is the active one. */
    await expect(isSolid(connectors(canvasElement)[0])).toBe(true);
  },
};

export const AllComplete: Story = {
  name: 'Every step finished',
  args: {
    activeStep: 'SUMMARY',
    stepStatus: {
      SOAP: 'COMPLETED',
      DIAGNOSTICS: 'COMPLETED',
      TREATMENT: 'COMPLETED',
      PASSPORT: 'COMPLETED',
      INVOICE: 'COMPLETED',
      SUMMARY: 'COMPLETED',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(connectors(canvasElement).every(isSolid)).toBe(true);
    // Five checks, not six: the active Summary step keeps its ring.
    await expect(canvas.getAllByRole('button').filter(hasCheck)).toHaveLength(5);
  },
};

export const LockedSteps: Story = {
  name: 'Locked steps',
  args: {
    activeStep: 'SOAP',
    stepStatus: idle({
      SOAP: 'IN_PROGRESS',
      INVOICE: 'LOCKED',
      SUMMARY: 'LOCKED',
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'LOCKED draws exactly like EMPTY and the button is neither disabled nor `aria-disabled`, so ' +
          'a locked step is indistinguishable from an untouched one and still navigates. The lock is ' +
          'enforced inside the step itself, not on the rail.',
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const locked = canvas.getByRole('button', { name: 'Summary' });
    await expect(locked).not.toBeDisabled();
    await expect(locked).not.toHaveAttribute('aria-disabled');
    await expect(hasCheck(locked)).toBe(false);

    await userEvent.click(locked);
    await expect(args.onStepChange).toHaveBeenCalledWith('SUMMARY');
  },
};
