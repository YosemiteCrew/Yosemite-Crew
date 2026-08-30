import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneWorkspaceShell from './PhoneWorkspaceShell';
import {
  WORKSPACE_STEPS,
  type StepStatus,
  type Vitals,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

const APPOINTMENT: Appointment = {
  id: 'appt-workspace-1',
  organisationId: 'org-storybook',
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'prac-amara', name: 'Dr. Amara Weber' },
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const VITALS: Vitals[] = [
  {
    id: 'obs-1',
    code: '8716-3',
    tempF: 100.9,
    heartRateBpm: 88,
    respRateBpm: 22,
    recordedByName: 'Nurse Ravi Patel',
    recordedAt: '2026-03-12T09:34:00.000Z',
  },
  {
    id: 'obs-2',
    code: '8716-3',
    tempF: 101.6,
    heartRateBpm: 96,
    respRateBpm: 26,
    recordedByName: 'Dr. Amara Weber',
    recordedAt: '2026-03-12T09:48:00.000Z',
  },
];

const status = (overrides: Partial<Record<WorkspaceStep, StepStatus>>) =>
  WORKSPACE_STEPS.reduce(
    (acc, step) => ({ ...acc, [step]: overrides[step] ?? 'EMPTY' }),
    {} as Record<WorkspaceStep, StepStatus>
  );

/** Stands in for the real step component, which the shell renders unchanged. */
const StepBody = ({ label }: { label: string }) => (
  <div className="rounded-[14px] border border-(--hairline) bg-(--inset) p-4">
    <p className="text-[13px] font-bold text-(--ink)">{label}</p>
    <p className="mt-1 text-[12px] text-(--ink-muted)">
      The step body is reused verbatim from the desktop layout. The shell only frames it.
    </p>
  </div>
);

/**
 * The shell sizes itself against the phone shell's fixed 54px header and 72px tab
 * bar via `100dvh`, so it needs a real viewport-height box - not an auto-height
 * canvas - to lay out the way it does in the app.
 */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)] px-4 py-5" style={{ height: 700 }}>
    <Story />
  </div>
);

const meta = {
  title: 'Workspace/PhoneWorkspaceShell',
  component: PhoneWorkspaceShell,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The bespoke phone workspace layout: a compact patient bar and step-chip scroller pinned ' +
          'at the top, a sticky action bar at the bottom, and the reused step body scrolling ' +
          'between them. It owns presentation only - every handler, the timer binding and the step ' +
          'components arrive from the workspace container unchanged, which is what keeps the phone ' +
          'flow identical to the desktop one instead of a second implementation of it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    companionName: 'Poppy Hartmann',
    speciesType: 'Dog',
    breed: 'Beagle',
    ageLabel: '4y 2m',
    weightKg: 12.4,
    activeStep: 'SOAP',
    stepStatus: status({}),
    vitals: VITALS,
    onBack: fn(),
    onStepChange: fn(),
    onAdvance: fn(),
    onRecords: fn(),
    onChat: fn(),
    onMore: fn(),
    children: <StepBody label="SOAP" />,
  },
  decorators: [Phone],
} satisfies Meta<typeof PhoneWorkspaceShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnSoap: Story = {
  name: 'SOAP: vitals tiles ride above the body',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The tiles show the LATEST observation, not the first one recorded.
    await expect(canvas.getByText('101.6 °F')).toBeInTheDocument();
    await expect(canvas.getByText('96 · 26')).toBeInTheDocument();
    await expect(canvas.queryByText('100.9 °F')).toBeNull();

    /* The three bands must not overlap: patient bar, then chips, then the scroller,
       then the action bar. A collapsed flex child here silently hides the chips
       behind the bar rather than erroring.

       Two buttons answer to 'Diagnostics' on this step - the upcoming step chip
       and the action bar's advance CTA - and that is the pair being compared, so
       the query takes them in DOM order rather than disambiguating them away. */
    const chip = canvas.getByRole('button', { name: 'SOAP Notes' }).getBoundingClientRect();
    const named = canvas.getAllByRole('button', { name: 'Diagnostics' });
    await expect(named).toHaveLength(2);
    const cta = named[named.length - 1].getBoundingClientRect();
    await expect(chip.bottom).toBeLessThanOrEqual(cta.top);
  },
};

export const OtherStepsDropTheTiles: Story = {
  name: 'Diagnostics: no vitals tiles',
  args: {
    activeStep: 'DIAGNOSTICS',
    stepStatus: status({ SOAP: 'COMPLETED' }),
    children: <StepBody label="Diagnostics" />,
  },
  play: async ({ canvasElement }) => {
    // The tiles belong to SOAP only; on any other step the body starts at the top.
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Weight')).toBeNull();
    // 'Diagnostics' is both the active chip and the step body's own title, so the
    // assertion names which one it means.
    await expect(canvas.getByRole('button', { name: 'Diagnostics' })).toHaveAttribute(
      'aria-current',
      'step'
    );
  },
};

/** Owns the step the way the workspace container does, so a chip really navigates. */
const ControlledShell = (args: React.ComponentProps<typeof PhoneWorkspaceShell>) => {
  const [step, setStep] = useState<WorkspaceStep>(args.activeStep);
  return (
    <PhoneWorkspaceShell
      {...args}
      activeStep={step}
      onStepChange={(next) => {
        setStep(next);
        args.onStepChange(next);
      }}
    >
      <StepBody label={step} />
    </PhoneWorkspaceShell>
  );
};

export const Navigating: Story = {
  name: 'Moving between steps',
  render: (args) => <ControlledShell {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Treatment' }));
    await expect(args.onStepChange).toHaveBeenCalledWith('TREATMENT');
    await expect(canvas.getByRole('button', { name: 'Treatment' })).toHaveAttribute(
      'aria-current',
      'step'
    );
  },
};

export const LastStep: Story = {
  name: 'Summary: the terminal action',
  args: {
    activeStep: 'SUMMARY',
    stepStatus: status({
      SOAP: 'COMPLETED',
      DIAGNOSTICS: 'COMPLETED',
      TREATMENT: 'COMPLETED',
      PASSPORT: 'COMPLETED',
      INVOICE: 'COMPLETED',
    }),
    primaryCta: { label: 'Complete visit', onClick: fn() },
    children: <StepBody label="Summary" />,
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Complete visit' }));
    await expect(args.primaryCta?.onClick).toHaveBeenCalledTimes(1);
  },
};

export const NoVitalsYet: Story = {
  name: 'Before any observation is recorded',
  args: { vitals: [], weightKg: undefined },
  play: async ({ canvasElement }) => {
    // Three dashes rather than three zeroes - an unrecorded vital must never read
    // as a measured one.
    await expect(within(canvasElement).getAllByText('—')).toHaveLength(3);
  },
};

export const FitsThePhone: Story = {
  name: 'The body scrolls; the bars do not move',
  args: {
    children: (
      <>
        {Array.from({ length: 8 }, (_, index) => (
          <StepBody key={index} label={`Section ${index + 1}`} />
        ))}
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    /* The point of the shell is that a long step body scrolls INSIDE it while the
       patient bar and action bar stay put. If the internal scroller collapsed, the
       page itself would grow and both bars would scroll off with it. */
    const scroller = canvasElement.querySelector('.overflow-y-auto') as HTMLElement;
    await expect(scroller).not.toBeNull();
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    // And it never scrolls sideways at phone width.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
