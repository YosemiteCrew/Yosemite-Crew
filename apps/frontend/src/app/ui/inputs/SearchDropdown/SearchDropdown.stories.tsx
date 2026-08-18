import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import SearchDropdown from './index';

const COMPANIONS = [
  { value: 'poppy', label: 'Poppy — Beagle' },
  { value: 'bruno', label: 'Bruno — German Shepherd' },
  { value: 'miso', label: 'Miso — Ragdoll' },
  { value: 'waffle', label: 'Waffle — Corgi' },
  { value: 'rosie', label: 'Rosie — Ragdoll' },
  { value: 'rocky', label: 'Rocky — Labrador' },
];

const StatefulSearchDropdown = (args: ComponentProps<typeof SearchDropdown>) => {
  const [query, setQuery] = useState(args.query);
  return <SearchDropdown {...args} query={query} setQuery={setQuery} />;
};

/**
 * The results panel has no role and no stable test id - it is an `id`ed div the input
 * points at with `aria-controls`, and only while `canSearch` is true. Resolving it that
 * way also proves the wiring: no `aria-controls` means no panel.
 */
const getResultsPanel = (input: HTMLElement) => {
  const listboxId = input.getAttribute('aria-controls');
  if (!listboxId) return null;
  return document.getElementById(listboxId);
};

const meta = {
  title: 'Inputs/SearchDropdown',
  component: SearchDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Type-ahead search field with a results dropdown. The field matches the design search ' +
          'pattern: 40px tall, 12px radius, 1.5px hairline border, --field-bg fill, a leading ' +
          '15px search glyph, and 12.5px text.\n\n' +
          'The results panel is the part that had never been drawn. It is gated on ' +
          '`open && query.length >= minChars && filtered.length > 0`, so it needs an ' +
          'interaction *and* enough characters - the original `WithQuery` story seeded a ' +
          'single character, one below the default `minChars` of 2, so every story in this file ' +
          'showed the closed field and nothing else.\n\n' +
          'Open, the field and the panel are one object rather than two: the field swaps to ' +
          '`border-[var(--blue)]! border-b-0! rounded-t-[12px]!` and the panel takes ' +
          '`rounded-b-[12px]` with a full border, so the shared edge disappears and the two ' +
          'read as a single rounded box. Closed, the field goes back to ' +
          '`border-[var(--hairline)]! rounded-[12px]!`. That join only exists while the panel ' +
          'is up, and a regression in either half shows as a visible seam.\n\n' +
          'The options are plain `<button>`s, not `role="option"`, and the active row is ' +
          'tracked with `aria-activedescendant` on the input rather than with focus - so the ' +
          'stories below assert the panel has real rows, not merely that it appeared.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    minChars: { control: 'number' },
    error: { control: 'text' },
  },
  args: {
    options: COMPANIONS,
    placeholder: 'Search companions',
    label: 'Search companions',
    query: '',
    setQuery: () => {},
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulSearchDropdown {...args} />,
} satisfies Meta<typeof SearchDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithQuery: Story = {
  args: { query: 'b' },
  parameters: {
    docs: { story: 'Below the 2-character threshold — results stay hidden until the query grows.' },
  },
};

export const ResultsOpen: Story = {
  name: 'Results panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Search companions' });
    await userEvent.type(input, 'ra');
    const panel = getResultsPanel(input);
    await expect(panel).toBeInTheDocument();
    // Assert the panel has its rows. Options are plain buttons, so a check for
    // role="option" would find nothing and a check for the panel alone would
    // pass on an empty one.
    await expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(3);
    await expect(within(panel as HTMLElement).getByText('Rosie — Ragdoll')).toBeInTheDocument();
    // Open, the field drops its bottom border and squares its bottom corners so
    // the panel below continues the same box.
    await expect(input.parentElement).toHaveClass('border-b-0!');
    await expect(input.parentElement).toHaveClass('rounded-t-[12px]!');
  },
  parameters: {
    docs: {
      story:
        'Two characters typed into an empty field. Three of the six companions match, and the ' +
        'first row is pre-activated through `aria-activedescendant` without taking focus off ' +
        'the input.',
    },
  },
};

export const NoMatches: Story = {
  name: 'Typed, but nothing matches',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Search companions' });
    await userEvent.type(input, 'zz');
    // Past minChars but with no matches, the panel is not rendered at all - so
    // the field keeps its full border and its 12px radius on all four corners.
    await expect(input).not.toHaveAttribute('aria-controls');
    await expect(getResultsPanel(input)).toBeNull();
    await expect(input.parentElement).toHaveClass('rounded-[12px]!');
  },
  parameters: {
    docs: {
      story:
        'There is no "no results" row: an unmatched query renders nothing below the field. ' +
        'Worth seeing, because it is indistinguishable from a field that never opened.',
    },
  },
};

export const KeyboardNavigation: Story = {
  name: 'Keyboard navigation',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Search companions' });
    await userEvent.type(input, 'ra');
    const panel = getResultsPanel(input) as HTMLElement;
    const rows = within(panel).getAllByRole('button');
    await userEvent.keyboard('{ArrowDown}');
    // Focus never leaves the input; the active row is named by id instead.
    await expect(input).toHaveAttribute('aria-activedescendant', rows[1].id);
    await expect(rows[1]).toHaveClass('bg-card-hover');
    await userEvent.keyboard('{End}');
    await expect(input).toHaveAttribute('aria-activedescendant', rows[2].id);
  },
  parameters: {
    docs: {
      story:
        'Arrow keys, Home and End move a virtual cursor: the input keeps DOM focus and points ' +
        'at the active row with `aria-activedescendant`, while the row itself only changes ' +
        'colour. Nothing about that is visible in a static render.',
    },
  },
};

export const SelectingAnOption: Story = {
  name: 'Selecting an option closes the panel',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Search companions' });
    await userEvent.type(input, 'ra');
    const panel = getResultsPanel(input) as HTMLElement;
    await userEvent.click(within(panel).getByText('Rocky — Labrador'));
    // `onSelect` is handed the raw value, not the option object.
    await expect(args.onSelect).toHaveBeenCalledWith('rocky');
    await expect(getResultsPanel(input)).toBeNull();
    await expect(input.parentElement).toHaveClass('rounded-[12px]!');
  },
  parameters: {
    docs: {
      story:
        'Picking a row closes the panel and re-joins the field’s bottom border. The query is ' +
        'left as typed - the component does not write the chosen label back into the field, ' +
        'which is only apparent after a selection.',
    },
  },
};

export const LoadingMore: Story = {
  name: 'Loading more results',
  args: { query: 'ra', hasMore: true, isLoadingMore: true, onReachEnd: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Search companions' });
    await userEvent.click(input);
    const panel = getResultsPanel(input) as HTMLElement;
    await expect(panel).toBeInTheDocument();
    // The pagination row is a live region appended after the rows, inside the
    // same 200px-max scroller - it does not replace them.
    await expect(within(panel).getByText('Loading more results…')).toBeInTheDocument();
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);
  },
  parameters: {
    docs: {
      story:
        'The infinite-scroll tail. `onReachEnd` fires within 24px of the bottom of the panel, ' +
        'and while the next page is in flight this `aria-live="polite"` row sits under the ' +
        'existing options - a state that exists only mid-fetch.',
    },
  },
};

export const WithError: Story = {
  args: { error: 'Pick a companion from the list.' },
  parameters: {
    docs: {
      story:
        'The error line is gated on `!open && !hasSelected`, so it shows on an untouched field ' +
        'and disappears the moment the field is focused rather than sitting under an open panel.',
    },
  },
};
