import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  IoBusiness,
  IoCalendarOutline,
  IoDocument,
  IoLocationSharp,
  IoPersonOutline,
} from 'react-icons/io5';

import Progress, { type StepContent } from './Progress';

/* The two shipped flows, verbatim: the 3-step team onboarding track and the
   2-step create-organisation track. "Availability & consultation" is the longest
   real label, so it is the one that decides whether the row wraps. */
const TEAM_STEPS: StepContent[] = [
  { title: 'Personal', logo: <IoPersonOutline size={17} /> },
  { title: 'Professional', logo: <IoDocument size={18} /> },
  { title: 'Availability & consultation', logo: <IoCalendarOutline size={16} /> },
];

const ORG_STEPS: StepContent[] = [
  { title: 'Organization', logo: <IoBusiness size={18} /> },
  { title: 'Address', logo: <IoLocationSharp size={18} /> },
];

const triggers = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('.yc-step-trigger'));

const labels = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.yc-step-label'));

/* The connector is `aria-hidden`, so there is no role to query it by and no text
   to match - the progress claim only exists as geometry. Reported as a RATIO
   because the track width is a design token that changes with the step count and
   the breakpoint, while the fill fraction is the thing that must not drift. */
const connectors = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.yc-step-connector')).map((track) => {
    const trackWidth = track.getBoundingClientRect().width;
    const fill = track.querySelector<HTMLElement>('.yc-step-connector-fill');
    return {
      trackWidth,
      filled: (fill?.getBoundingClientRect().width ?? 0) / trackWidth,
    };
  });

/* A completed badge swaps the step's own logo for `IoCheckmark`, which the
   component marks `aria-hidden`. The step logos carry no such attribute (react-icons
   renders a bare <svg>), so this identifies the tick specifically rather than
   "there is an icon in here". */
const isTicked = (canvasElement: HTMLElement, index: number) =>
  Boolean(
    canvasElement
      .querySelectorAll<HTMLElement>('.yc-step-badge')
      [index]?.querySelector('svg[aria-hidden="true"]')
  );

const meta = {
  title: 'Onboarding/Progress',
  component: Progress,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The onboarding stepper. Each step is one of three states derived from `activeStep` - ' +
          'complete (logo swapped for a tick), active, or upcoming - and the connector behind it ' +
          'is filled 100%, 50% or 0% to match. The 50% is the point: the track shows the current ' +
          'step as half done rather than jumping between empty and full. `canSelectStep` decides ' +
          'which steps are reachable; when it is omitted no step is disabled at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeStep: 0,
    steps: TEAM_STEPS,
    onStepSelect: fn(),
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStepActive: Story = {
  name: 'On the first step, nothing complete yet',
  play: async ({ canvasElement }) => {
    const [first, second] = connectors(canvasElement);
    // Half behind the step in progress, empty ahead of it.
    await expect(first.filled).toBeCloseTo(0.5, 2);
    await expect(second.filled).toBeCloseTo(0, 2);

    // No step is complete, so no tick has replaced a logo.
    await expect(isTicked(canvasElement, 0)).toBe(false);

    /* With no `canSelectStep` the component leaves every trigger ENABLED, and the
       stylesheet's `:disabled { opacity: .6 }` used to be a `.is-upcoming` rule that
       dimmed these live controls below AA. Measure the opacity rather than trust the
       class list - a dimmed but working button fails silently. */
    for (const trigger of triggers(canvasElement)) {
      await expect(trigger).not.toBeDisabled();
      await expect(globalThis.getComputedStyle(trigger).opacity).toBe('1');
    }
  },
};

export const MidProgress: Story = {
  name: 'One step complete, one in progress',
  args: {
    activeStep: 1,
    // What the real flows pass: everything up to and including the current step.
    canSelectStep: (stepIndex: number) => stepIndex <= 1,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second] = connectors(canvasElement);
    await expect(first.filled).toBeCloseTo(1, 2);
    await expect(second.filled).toBeCloseTo(0.5, 2);

    // The finished step shows a tick; the one in progress keeps its own logo.
    await expect(isTicked(canvasElement, 0)).toBe(true);
    await expect(isTicked(canvasElement, 1)).toBe(false);

    /* The tick is aria-hidden, so a screen reader still hears the step name and not
       a nameless graphic. This is the assertion that catches the tick being swapped
       for a labelled icon. */
    await expect(canvas.getByRole('button', { name: 'Personal' })).toBeInTheDocument();

    // Emphasis is the only thing marking which step you are on, so pin the weight.
    const [personal, professional] = labels(canvasElement);
    await expect(globalThis.getComputedStyle(professional).fontWeight).toBe('700');
    await expect(globalThis.getComputedStyle(personal).fontWeight).toBe('600');

    const [back, current, ahead] = triggers(canvasElement);
    // Reachable steps must look reachable - `is-clickable` is the only affordance.
    await expect(globalThis.getComputedStyle(back).cursor).toBe('pointer');
    await expect(globalThis.getComputedStyle(current).cursor).toBe('pointer');
    await expect(globalThis.getComputedStyle(ahead).cursor).toBe('default');

    // The step you have not earned yet is disabled, not merely ignored on click.
    await expect(ahead).toBeDisabled();
    await userEvent.click(ahead, { pointerEventsCheck: 0 });
    await expect(args.onStepSelect).not.toHaveBeenCalled();

    // Going back reports the index it moved to, so the caller does not recompute it.
    await userEvent.click(back);
    await expect(args.onStepSelect).toHaveBeenCalledWith(0);
  },
};

export const AllComplete: Story = {
  name: 'Every step complete',
  args: {
    // Past the last index. Both shipped flows clamp `activeStep` to `steps.length - 1`,
    // so this is the state a completion screen would pass, not one the wizards reach.
    activeStep: TEAM_STEPS.length,
    canSelectStep: () => true,
  },
  play: async ({ canvasElement }) => {
    for (const connector of connectors(canvasElement)) {
      await expect(connector.filled).toBeCloseTo(1, 2);
    }
    for (let index = 0; index < TEAM_STEPS.length; index += 1) {
      await expect(isTicked(canvasElement, index)).toBe(true);
    }
    /* Nothing is in progress, so no label may keep the active weight - otherwise a
       finished track still points at a step the user has left. */
    for (const label of labels(canvasElement)) {
      await expect(globalThis.getComputedStyle(label).fontWeight).toBe('600');
    }
  },
};

export const TwoStepTrack: Story = {
  name: 'Two-step create-organisation track',
  args: {
    steps: ORG_STEPS,
    canSelectStep: () => true,
  },
  play: async ({ canvasElement }) => {
    const [only] = connectors(canvasElement);
    /* `is-two-step` widens the track to the 120px the design draws for the shorter
       flow. Losing the class is invisible in a screenshot diff of the labels: the
       track just falls back to the 96px default and the row looks cramped. */
    await expect(only.trackWidth).toBe(120);
    await expect(only.filled).toBeCloseTo(0.5, 2);
    await expect(connectors(canvasElement)).toHaveLength(1);
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { activeStep: 1, canSelectStep: (stepIndex: number) => stepIndex <= 1 },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the badges drop to 32px, the connectors to 40px and the gaps to 10px, so ' +
          'the three-step track still fits beside "Availability & consultation" on a 375px screen.',
      },
    },
  },
};
