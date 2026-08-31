import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import CalculatorBrowser from './CalculatorBrowser';
import { CALCULATOR_CATEGORIES } from '@/app/features/calculators/registry';

/* An 18 kg patient at 7% dehydration with 120 mL/day of ongoing losses. Feline
   maintenance is 50 mL/kg/day against the canine 60, so the species that arrives
   is readable off the result: 900 mL/day here, 1080 if `initialSpecies` were
   dropped on the way through. */
const PREFILL = {
  weightKg: '18',
  dehydrationPercent: '7',
  ongoingLossesMlPerDay: '120',
};

/**
 * The category track: `[role=group]` inside a `w-max` box inside the scroller.
 * Walking up from the group rather than matching classes keeps the assertions
 * about the arrangement, and the `overflow-x` check below proves the walk landed
 * on the scroller rather than on whatever a refactor left in its place.
 */
const trackNodes = (group: HTMLElement) => {
  const scroller = group.parentElement?.parentElement as HTMLElement;
  return { scroller, root: scroller.parentElement as HTMLElement };
};

/** Open the calculator dropdown and hand back its panel, which portals to `body`. */
const openCalculatorMenu = async (trigger: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(trigger);
  return waitFor(() => {
    const panel = globalThis.document.querySelector('[data-portal-dropdown]');
    if (!panel) throw new Error('the calculator dropdown never opened');
    return panel as HTMLElement;
  });
};

const meta = {
  title: 'Calculators/CalculatorBrowser',
  component: CalculatorBrowser,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The calculators panel: a segmented category track, a dropdown of the calculators in that ' +
          'category, and the selected `CalculatorForm` in a bordered card. It renders entirely from ' +
          'the registry and holds the only two pieces of state in the feature - the category and the ' +
          'active calculator.\n\n' +
          'Two behaviours live here and nowhere else. **Switching category resets the calculator** to ' +
          "the first one in the new category, so the dropdown can never show a calculator that isn't " +
          'in the list beneath the pressed pill. And the form is **re-keyed on every switch** - ' +
          '`key={active.key}` remounts it, which is what discards the previous result, its errors and ' +
          'its typed values. Leaving a fluid-rate answer sitting above a constant-rate-infusion form ' +
          'is the failure that key exists to prevent.\n\n' +
          'The remount has a second, quieter consequence: `initialValues` is re-applied to the new ' +
          'form, so a prefilled `weightKg` follows the clinician into any calculator that also has a ' +
          'field called `weightKg`, and is dropped by any that does not.\n\n' +
          'The registry carries more categories than fit the panel, so the track scrolls sideways ' +
          'rather than wrapping to a second row or squeezing the labels.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // The real home of this component is the 440px Quick Actions side panel.
      <div className="w-[440px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalculatorBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'First category, first calculator',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Calculator category' });

    /* Exactly one pressed pill. `aria-pressed` is the only thing carrying the
       selection to assistive tech - the raised segment is a shadow and a font
       weight - so two pressed pills, or none, look completely normal. */
    const pills = within(group).getAllByRole('button');
    await expect(pills).toHaveLength(CALCULATOR_CATEGORIES.length);
    const pressed = pills.filter((pill) => pill.getAttribute('aria-pressed') === 'true');
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveTextContent(CALCULATOR_CATEGORIES[0]);

    // The dropdown and the form agree with the pressed pill on first paint.
    await expect(
      canvas.getByRole('button', { name: 'Calculator: Fluid rate' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('spinbutton', { name: 'Dehydration (%)' })).toBeInTheDocument();

    const { scroller, root } = trackNodes(group);
    await expect(globalThis.getComputedStyle(scroller).overflowX).toBe('auto');

    /* Six categories do not fit 408px. The track has to be wider than the box it
       scrolls in, and the box has to stay inside the panel (give or take the 4px
       `-mx-1` bleed into the panel padding) - a track that spilled to its natural
       width would drag the whole side panel sideways. */
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    await expect(scroller.clientWidth).toBeLessThanOrEqual(root.clientWidth + 8);

    const tops = pills.map((pill) => Math.round(pill.getBoundingClientRect().top));
    await expect(new Set(tops).size).toBe(1);
    // Scrolled, not squeezed: every label is drawn in full inside its own segment.
    for (const pill of pills) {
      await expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth);
    }
  },
};

export const CategoryReset: Story = {
  name: 'Switching category resets the calculator',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Calculator category' });

    await userEvent.click(within(group).getByRole('button', { name: 'Nutrition' }));

    await expect(within(group).getByRole('button', { name: 'Nutrition' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      within(group).getByRole('button', { name: CALCULATOR_CATEGORIES[0] })
    ).toHaveAttribute('aria-pressed', 'false');

    /* The dropdown jumps to the first calculator of the new category. Without the
       reset it would keep naming "Fluid rate" - a calculator that is not in the
       list the dropdown now offers, over a form the pressed pill does not
       describe. */
    await expect(
      canvas.getByRole('button', { name: 'Calculator: Energy requirement' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('spinbutton', { name: 'MER factor (optional, default 1.6)' })
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Dehydration (%)' })
    ).not.toBeInTheDocument();
  },
};

export const PrefilledAndReKeyed: Story = {
  name: 'Prefill arrives, and a switch clears the answer',
  args: { initialValues: PREFILL, initialSpecies: 'cat' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue(18);

    await userEvent.click(canvas.getByRole('button', { name: 'Calculate' }));
    const result = await canvas.findByRole('status');
    /* 900, not 1080: `initialSpecies` survived the trip through the browser into
       the form and on into `compute`. The Canine/Feline pills carry no ARIA state
       of their own, so the arithmetic is the only honest proof of which one is
       selected. */
    await expect(within(result).getByText('900 mL/day')).toBeInTheDocument();

    const panel = await openCalculatorMenu(
      canvas.getByRole('button', { name: 'Calculator: Fluid rate' })
    );
    await userEvent.click(within(panel).getByRole('button', { name: 'Constant rate infusion' }));

    await expect(canvas.getByRole('spinbutton', { name: 'Dose (µg/kg/min)' })).toBeInTheDocument();
    /* The result block is gone, because `key={active.key}` remounted the form. A
       stale fluid volume left sitting above a constant-rate-infusion form is the
       one defect in this component that could reach a patient. */
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    // CRI declares no species, so the pills go with the previous calculator.
    await expect(canvas.queryByRole('button', { name: 'Feline' })).not.toBeInTheDocument();

    /* The quiet half of the remount: `initialValues` is applied again, so the
       prefilled weight follows the clinician into any calculator with a field of
       the same name - while `dehydrationPercent`, which CRI does not have, is
       simply dropped. */
    await expect(canvas.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue(18);
  },
};

export const Phone: Story = {
  name: 'Phone: the category track scrolls',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    (Story) => (
      /* Pinned to a phone-width box as well as to the viewport global: a story
         rendered straight from `iframe.html` keeps the runner's width, and the
         measurements below would then be taken on a desktop-width panel. */
      <div className="w-[340px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Calculator category' });
    const { scroller, root } = trackNodes(group);

    // Narrower panel, same contract: one scrolling row, no wrap, no squeezed labels.
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    await expect(scroller.clientWidth).toBeLessThanOrEqual(root.clientWidth + 8);

    const pills = within(group).getAllByRole('button');
    const tops = pills.map((pill) => Math.round(pill.getBoundingClientRect().top));
    await expect(new Set(tops).size).toBe(1);

    // The form underneath keeps the panel width rather than following the track out.
    const trigger = canvas.getByRole('button', { name: 'Calculator: Fluid rate' });
    await expect(Math.round(trigger.getBoundingClientRect().width)).toBe(
      Math.round(root.getBoundingClientRect().width)
    );
  },
};
