import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  AvailabilityState,
  DEFAULT_INTERVAL,
  daysOfWeek,
} from '@/app/features/appointments/components/Availability/utils';
import AvailabilityStep from './AvailabilityStep';

const buildAvailability = (enabledDays: readonly string[]): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = {
      enabled: enabledDays.includes(day),
      intervals: [{ ...DEFAULT_INTERVAL }],
    };
    return acc;
  }, {} as AvailabilityState);

const WEEKDAYS = buildAvailability(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
const NOTHING_ENABLED = buildAvailability([]);

type HarnessProps = {
  initialAvailability: AvailabilityState;
  isSaving: boolean;
  prevStep: () => void;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setIsRedirecting: Dispatch<SetStateAction<boolean>>;
};

/**
 * The step is controlled by the wizard, so the story owns the availability state
 * the same way `TeamOnboarding` does. `setIsSaving` and `setIsRedirecting` stay
 * spies rather than real setters: they are the two things the component touches
 * on its way to `upsertAvailability`, so a story can prove the request was never
 * attempted by asserting neither was called.
 */
const AvailabilityStepHarness = ({
  initialAvailability,
  isSaving,
  prevStep,
  setIsSaving,
  setIsRedirecting,
}: HarnessProps) => {
  const [availability, setAvailability] = useState<AvailabilityState>(initialAvailability);

  return (
    <div className="min-h-[720px] bg-[var(--page)] p-6">
      <AvailabilityStep
        prevStep={prevStep}
        orgIdFromQuery="org-storybook-avenger-park"
        availability={availability}
        setAvailability={setAvailability}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        setIsRedirecting={setIsRedirecting}
      />
    </div>
  );
};

const meta = {
  title: 'Onboarding/AvailabilityStep',
  component: AvailabilityStepHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The last team-onboarding step. Its one error state - **"Please enable at least one day ' +
          'with a valid time slot"** - had never been drawn, because it is raised only after ' +
          'Finish is pressed with every day switched off, which is a state a reviewer has to ' +
          'build by hand: the wizard seeds Monday to Friday on.\n\n' +
          'The same message is raised from two places, the Finish handler and the `validate()` ' +
          'the stepper calls, so it is also what a practitioner sees when they try to skip ' +
          'forward past an empty week.\n\n' +
          'The consultation-slot select and the two visit-type chips are rendered **disabled on ' +
          'purpose**, at the values the backend actually applies: `POST /availability/:orgId/base` ' +
          'accepts only `{ dayOfWeek, slots }`, so anything picked there would be discarded ' +
          'silently. They are part of the design and carry a `title` explaining why they are ' +
          'inert, which makes them worth seeing rather than mistaking for a broken control.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialAvailability: WEEKDAYS,
    isSaving: false,
    prevStep: fn(),
    setIsSaving: fn(),
    setIsRedirecting: fn(),
  },
} satisfies Meta<typeof AvailabilityStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Weekdays enabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const monday = canvas.getByRole('checkbox', { name: 'Enable availability for Monday' });
    await expect(canvas.getAllByRole('checkbox')).toHaveLength(7);
    await expect(monday).toBeChecked();
    await expect(
      canvas.getByRole('checkbox', { name: 'Enable availability for Saturday' })
    ).not.toBeChecked();
    await expect(canvas.getAllByText('Day off')).toHaveLength(2);

    // Toggle | day | ranges | actions - four tracks and exactly four children,
    // so every row lands its cells in the same columns whether the day is on
    // (time ranges plus add/duplicate) or off (the "Day off" placeholder).
    const row = monday.closest('.grid') as HTMLElement;
    await expect(row.children).toHaveLength(4);
    await expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);

    // Rendered, disabled, and pinned to what the API stores.
    const slot = canvas.getByRole('combobox', { name: 'Consultation slot' });
    await expect(slot).toBeDisabled();
    await expect(slot).toHaveValue('30 min');
    const inClinic = canvas.getByRole('button', { name: 'In clinic' });
    await expect(inClinic).toBeDisabled();
    await expect(inClinic).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Home visits' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await expect(
      canvas.getByRole('button', { name: 'Finish · open dashboard' })
    ).toBeInTheDocument();
    await expect(
      canvas.queryByText('Please enable at least one day with a valid time slot')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the wizard opens with. A disabled day collapses its time ranges to the ' +
          '"Day off" placeholder rather than dimming them, so the row keeps its height and the ' +
          'week does not reflow as days are switched on.',
      },
    },
  },
};

export const AvailabilityError: Story = {
  name: 'Finish with every day off',
  args: { initialAvailability: NOTHING_ENABLED },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Day off')).toHaveLength(7);
    await expect(
      canvas.queryByText('Please enable at least one day with a valid time slot')
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Finish · open dashboard' }));

    const error = await canvas.findByText('Please enable at least one day with a valid time slot');
    await expect(error).toHaveClass('text-text-error');

    /* The guard returns before `setIsSaving(true)`, which is the only thing that
       happens before `upsertAvailability` - so these two spies staying untouched
       is the proof that no request was attempted, not just that a message rendered. */
    await expect(args.setIsSaving).not.toHaveBeenCalled();
    await expect(args.setIsRedirecting).not.toHaveBeenCalled();
    await expect(
      canvas.getByRole('button', { name: 'Finish · open dashboard' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The undrawn branch. The message sits between the week and the footer rule, in ' +
          '`text-caption-2` - it is the only error in this step and it is easy to miss below a ' +
          'seven-row card, especially since the row that would fix it is off-screen on a short ' +
          'viewport.',
      },
    },
  },
};

export const ErrorSurvivesADayBeingSwitchedOn: Story = {
  name: 'Error persists until the next attempt',
  args: { initialAvailability: NOTHING_ENABLED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Finish · open dashboard' }));
    expect(
      await canvas.findByText('Please enable at least one day with a valid time slot')
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'Enable availability for Tuesday' })
    );

    // The day is on and its ranges are back, but the message is still there:
    // the error is only cleared by the next validation, not by the edit that
    // resolves it.
    await waitFor(() =>
      expect(
        canvas.getByRole('checkbox', { name: 'Enable availability for Tuesday' })
      ).toBeChecked()
    );
    await expect(canvas.getAllByText('Day off')).toHaveLength(6);
    await expect(
      canvas.getByText('Please enable at least one day with a valid time slot')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Worth a decision rather than a snapshot: switching a day on fixes the problem the ' +
          'message describes, and the message stays. Clearing `availabilityError` on change - or ' +
          're-validating on toggle - would need a product call, so this pins the behaviour as it ' +
          'ships today. The story stops before the second Finish, which would reach the real ' +
          '`upsertAvailability` request.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving in flight',
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cta = canvas.getByRole('button', { name: 'Saving...' });
    // `isDisabled` on the pill does both: `BaseButton` puts the real `disabled`
    // attribute on the button branch AND adds `pointer-events-none opacity-60`,
    // so a second save is blocked in the DOM and not only by the handler's own
    // `if (isSaving) return`.
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveClass('pointer-events-none');
    await expect(
      canvas.queryByRole('button', { name: 'Finish · open dashboard' })
    ).not.toBeInTheDocument();
    // Back stays live, so a practitioner can leave while a save is in flight.
    const back = canvas.getByRole('button', { name: 'Back' });
    await expect(back).toBeEnabled();
    await expect(back).not.toHaveClass('pointer-events-none');
    // And so does the week: `isSaving` never reaches `Availability`, so the day
    // toggles keep taking edits that the in-flight request will not carry.
    await expect(
      canvas.getByRole('checkbox', { name: 'Enable availability for Monday' })
    ).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mid-save. Only the primary label changes - the week above it stays fully editable, so a ' +
          'practitioner can keep toggling days while the request they already sent is in flight ' +
          'and the payload that lands is the one from before the edits.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders at full panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = canvas.getByRole('button', { name: 'Back' });
    const inClinic = canvas.getByRole('button', { name: 'In clinic' });

    /* The footer is a single `flex-wrap` row with no breakpoint of its own, so
       the only thing that says whether it wrapped is geometry. Bounding rects,
       not `getComputedStyle()`: these are bordered pills, whose content box
       reads narrower than the drawn control and would not compare cleanly. */
    await expect(back.getBoundingClientRect().top).toBeGreaterThan(
      inClinic.getBoundingClientRect().bottom
    );

    // The week itself does not change shape - still seven rows on four tracks,
    // so the time ranges are what get squeezed at this width.
    await expect(canvas.getAllByRole('checkbox')).toHaveLength(7);
    const row = canvas
      .getByRole('checkbox', { name: 'Enable availability for Monday' })
      .closest('.grid') as HTMLElement;
    await expect(row.children).toHaveLength(4);
    await expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The step at 375px, and the one width where the footer breaks into two lines: the ' +
          'disabled visit-type chips take the first, Back and Finish the second. The day rows ' +
          'keep their fixed `40px 96px 1fr auto` template at every width, so the time-range ' +
          'column absorbs the loss and the two selects sit tight against each other here.',
      },
    },
  },
};
