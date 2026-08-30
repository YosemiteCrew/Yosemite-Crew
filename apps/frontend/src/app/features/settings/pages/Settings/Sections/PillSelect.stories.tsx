import type { Meta, StoryObj } from '@storybook/react';
import { useState, type ComponentProps } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PillSelect, { type PillSelectOption } from './PillSelect';

const VIEW_OPTIONS: ReadonlyArray<PillSelectOption> = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'board', label: 'Status Board' },
  { value: 'list', label: 'Table' },
];

// Long enough to be the widest thing in the row, and realistic: this is the
// shape the timezone row feeds in.
const TIMEZONE_OPTIONS: ReadonlyArray<PillSelectOption> = [
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) Kolkata' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin' },
  { value: 'Europe/London', label: '(GMT+00:00) London' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Sao Paulo' },
  { value: 'America/New_York', label: '(GMT-05:00) New York' },
  { value: 'America/Chicago', label: '(GMT-06:00) Chicago' },
  { value: 'America/Denver', label: '(GMT-07:00) Denver' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Los Angeles' },
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Honolulu' },
];

const LONG_LABEL_OPTIONS: ReadonlyArray<PillSelectOption> = [
  {
    value: 'inpatient-recovery',
    label: 'Inpatient recovery ward, overnight observation rota',
  },
  { value: 'reception', label: 'Reception' },
];

/**
 * Resolves a design token to the `rgb(...)` string `getComputedStyle` reports, by
 * measuring a throwaway probe rather than hard-coding a hex that would drift from
 * `globals.css` and read the wrong value in the dark theme.
 *
 * Called OUTSIDE any `waitFor`: testing-library retries a `waitFor` callback from a
 * MutationObserver, so a callback that appends and removes a node re-triggers itself
 * forever and wedges the tab instead of failing.
 */
const resolveToken = (token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.display = 'none';
  probe.style.backgroundColor = `var(${token})`;
  globalThis.document.body.append(probe);
  const value = globalThis.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

const optionLabels = (select: HTMLElement) =>
  (within(select).getAllByRole('option') as HTMLOptionElement[]).map(
    (option) => option.textContent
  );

const optionValues = (select: HTMLElement) =>
  (within(select).getAllByRole('option') as HTMLOptionElement[]).map((option) => option.value);

/**
 * `value` is a prop, so the bare component never moves on its own - a story that
 * clicked through the list would assert nothing about the handler. The hook lives in
 * a named component rather than in `render`, which `react-hooks/rules-of-hooks`
 * rejects.
 */
const ControlledPillSelect = (args: ComponentProps<typeof PillSelect>) => {
  const [value, setValue] = useState(args.value);
  return (
    <PillSelect
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange(next);
      }}
    />
  );
};

const meta = {
  title: 'Settings/PillSelect',
  component: PillSelect,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The compact inline dropdown on Settings preference rows: a 36px `--field-bg` pill with ' +
          'a 1.5px hairline border, 12.5px/600 body text and a faint chevron.\n\n' +
          'It is a native `<select>` with the chrome painted on in `styles/Settings.css`, which is ' +
          'the whole design decision worth reviewing here. Keyboard traversal, type-ahead, the ' +
          'platform picker on a phone and the screen-reader combobox announcement all come for ' +
          'free, and the pill is only paint. The two pieces that make that work are easy to break ' +
          'silently and are measured below: the 31px right padding that reserves space for the ' +
          'absolutely-positioned chevron, and `pointer-events: none` on the chevron so a click on ' +
          'the arrow still opens the list rather than landing on a dead span.\n\n' +
          'The control has no label of its own - `ariaLabel` carries the row label - so an empty ' +
          '`ariaLabel` would ship an unnamed combobox with no visible symptom.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    ariaLabel: 'Default appointment view',
    value: 'board',
    options: VIEW_OPTIONS,
    onChange: fn(),
  },
} satisfies Meta<typeof PillSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three options',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Found by its accessible name, not by role alone: `ariaLabel` is the only name
       this control has, and a combobox that loses it is invisible to the failure. */
    const select = canvas.getByRole('combobox', { name: 'Default appointment view' });
    await expect(select).toHaveValue('board');
    await expect(optionLabels(select)).toEqual(['Calendar', 'Status Board', 'Table']);
    await expect(optionValues(select)).toEqual(['calendar', 'board', 'list']);

    // The design's 36px pill, on the border box. `getComputedStyle().height` reports
    // the CONTENT box, which on a 1.5px-bordered control reads 3px short.
    await expect(select.getBoundingClientRect().height).toBeCloseTo(36, 0);

    const chevron = select.nextElementSibling as HTMLElement;
    // Decoration only. Announced, it would read as a stray graphic beside a combobox
    // that already exposes its own expand behaviour.
    await expect(chevron).toHaveAttribute('aria-hidden', 'true');
    /* And it must not eat the click. The chevron is absolutely positioned ON TOP of
       the select, so without `pointer-events: none` the arrow - the part everyone
       aims at - becomes the one dead spot on the control. */
    await expect(globalThis.getComputedStyle(chevron).pointerEvents).toBe('none');

    /* The 31px right padding exists to keep the label clear of that chevron. Asserted
       as a relation rather than as the number, so it still holds if the icon or the
       12px inset changes: whatever the chevron occupies has to fit inside the pad. */
    const padRight = Number.parseFloat(globalThis.getComputedStyle(select).paddingRight);
    const overlap = select.getBoundingClientRect().right - chevron.getBoundingClientRect().left;
    await expect(overlap).toBeLessThanOrEqual(padRight);
  },
};

export const KeyboardFocus: Story = {
  name: 'Keyboard focus ring',
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Default appointment view',
    });

    /* `.focus()` sets `:focus` but NOT `:focus-visible` in Chromium, so a
       programmatically focused element reads as having no ring even when the rule is
       intact. Only a real keyboard event gets there. */
    await userEvent.tab();
    await expect(select).toHaveFocus();
    await expect(select.matches(':focus-visible')).toBe(true);

    // The pill has no visible border change on focus, so the outline is the entire
    // focus affordance - if it is dropped the control becomes untrackable by keyboard.
    const style = globalThis.getComputedStyle(select);
    await expect(style.outlineStyle).toBe('solid');
    await expect(style.outlineWidth).toBe('2px');
    await expect(style.outlineColor).toBe(resolveToken('--blue'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tabbed to, not clicked. The ring is a 2px `--blue` outline offset 1px, which is what ' +
          'the pill gets instead of a border change - the border is already the resting chrome.',
      },
    },
  },
};

export const ManyOptions: Story = {
  name: 'A long option list',
  args: {
    ariaLabel: 'Timezone',
    value: 'Europe/Berlin',
    options: TIMEZONE_OPTIONS,
  },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Timezone' });

    await expect(within(select).getAllByRole('option')).toHaveLength(11);
    await expect(select).toHaveValue('Europe/Berlin');

    /* The list length changes the pill's WIDTH but must not change anything else: a
       native select sizes to its widest option, so the row's height and its chevron
       clearance are the two things a longer list could quietly disturb. */
    await expect(select.getBoundingClientRect().height).toBeCloseTo(36, 0);
    const chevron = select.nextElementSibling as HTMLElement;
    const padRight = Number.parseFloat(globalThis.getComputedStyle(select).paddingRight);
    const overlap = select.getBoundingClientRect().right - chevron.getBoundingClientRect().left;
    await expect(overlap).toBeLessThanOrEqual(padRight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Eleven options, and the pill is as wide as the widest of them. That is the native ' +
          '`<select>` sizing rule showing through the paint, and it is why the narrow-row case ' +
          'below matters: nothing in the component caps the width, only the CSS does.',
      },
    },
  },
};

export const LongLabelInANarrowRow: Story = {
  name: 'Long label in a narrow row',
  args: {
    ariaLabel: 'Default ward',
    value: 'inpatient-recovery',
    options: LONG_LABEL_OPTIONS,
  },
  decorators: [
    (Story) => (
      <div data-pill-frame style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Default ward' });
    const frame = canvasElement.querySelector('[data-pill-frame]') as HTMLElement;

    /* The single guard against a long option shoving the pill through the side of a
       preference row: `max-width: 100%` on both the wrapper and the select. Measured
       against the frame rather than against a magic number, so the story still means
       something if the row width changes. */
    await expect(select.getBoundingClientRect().width).toBeLessThanOrEqual(
      frame.getBoundingClientRect().width
    );
    await expect(globalThis.getComputedStyle(select).textOverflow).toBe('ellipsis');

    // Clamped, not wrapped: a select cannot grow a second line, so the row height is
    // the thing that proves the label truncated instead of reflowing the card.
    await expect(select.getBoundingClientRect().height).toBeCloseTo(36, 0);

    // And the ellipsis still stops short of the chevron rather than running under it.
    const chevron = select.nextElementSibling as HTMLElement;
    const padRight = Number.parseFloat(globalThis.getComputedStyle(select).paddingRight);
    const overlap = select.getBoundingClientRect().right - chevron.getBoundingClientRect().left;
    await expect(overlap).toBeLessThanOrEqual(padRight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 240px row with an option far wider than it. The pill clamps and the label ' +
          'ellipsises; the full text stays reachable because the native picker still shows the ' +
          'whole option list.',
      },
    },
  },
};

export const Selecting: Story = {
  name: 'Choosing an option',
  render: (args) => <ControlledPillSelect {...args} />,
  play: async ({ args, canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Default appointment view',
    });

    await userEvent.selectOptions(select, 'list');

    /* The handler is given the option's VALUE, not the change event. Every caller in
       Settings feeds that straight into a PATCH body, so a component that started
       passing the event through would send `[object Object]` to the API while the
       pill kept looking correct. */
    await expect(args.onChange).toHaveBeenCalledWith('list');
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(select).toHaveValue('list');
    // The label and the submitted value differ on purpose here - worth seeing both.
    await expect((select as HTMLSelectElement).selectedOptions[0].textContent).toBe('Table');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Wrapped in local state, because the component is fully controlled - it renders whatever ' +
          '`value` says and never moves by itself.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Default appointment view',
    });

    await expect(globalThis.document.documentElement.dataset.theme).toBe('dark');

    /* Compared against the tokens resolved in THIS theme rather than against a hex.
       The pill chrome is hand-written CSS rather than Tailwind utilities, so it is
       exactly the kind of rule that gets a literal colour pasted into it and then
       stays warm-bone cream on the espresso surface. */
    const style = globalThis.getComputedStyle(select);
    await expect(style.backgroundColor).toBe(resolveToken('--field-bg'));
    await expect(style.borderTopColor).toBe(resolveToken('--hairline'));
    await expect(style.color).toBe(resolveToken('--ink-body'));

    // `color-scheme: dark` on the app shell is what keeps the native option popup
    // dark too; without it the pill is dark and the list it opens is white.
    const shell = canvasElement.querySelector('[data-yc-app]') as HTMLElement;
    await expect(globalThis.getComputedStyle(shell).colorScheme).toBe('dark');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same control on the espresso surface. The part that cannot be seen in a screenshot ' +
          'is the option popup: it is drawn by the platform, so it only follows the theme because ' +
          '`[data-yc-app]` sets `color-scheme`.',
      },
    },
  },
};
