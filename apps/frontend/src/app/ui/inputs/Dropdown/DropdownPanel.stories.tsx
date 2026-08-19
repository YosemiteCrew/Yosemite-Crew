import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import Dropdown from './Dropdown';

const SPECIALITY_OPTIONS = [
  { label: 'General Practice', value: 'general' },
  { label: 'Cardiology', value: 'cardiology' },
  { label: 'Dermatology', value: 'dermatology' },
  { label: 'Neurology', value: 'neurology' },
  { label: 'Orthopedics', value: 'orthopedics' },
  { label: 'Ophthalmology', value: 'ophthalmology' },
];

/**
 * `DropdownPanel` is presentational and takes fourteen props, but every one of
 * them is computed by `Dropdown` - the query state, the filtered list, the
 * portal geometry, the roving active-option id. Driving it through the real
 * `Dropdown` is what keeps the filtering and the `aria-activedescendant` wiring
 * under test instead of hand-fed.
 */
const SpecialityPicker = ({ search }: { search: boolean }) => {
  const [value, setValue] = useState('');
  return (
    <Dropdown
      placeholder="Speciality"
      value={value}
      onChange={setValue}
      options={SPECIALITY_OPTIONS}
      search={search}
    />
  );
};

/**
 * Opens the picker and returns the live panel.
 *
 * The panel `createPortal`s to `document.body`, so it is outside `canvasElement`
 * entirely. The LAST match is taken rather than the first: on the docs page a
 * panel left open by an earlier story is still in the body, and `querySelector`
 * would happily hand back that one.
 */
const openPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Speciality' }));
  return waitFor(() => {
    const panels = document.querySelectorAll('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1] as HTMLElement;
  });
};

/** Option labels in render order - the list the panel is currently offering. */
const optionLabels = (panel: HTMLElement): string[] =>
  [...panel.querySelectorAll('.select-input-dropdown-item')].map((option) =>
    (option.textContent ?? '').trim()
  );

const meta = {
  title: 'Inputs/DropdownPanel',
  component: SpecialityPicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The panel half of `Dropdown`, and specifically its **inline search head** - the one part ' +
          'of the control that needs two conditions at once to exist: the panel open AND ' +
          '`search` passed. `Inputs/Dropdown` has a story for each condition separately (a closed ' +
          'control with `search`, an open one without it), so the head itself had never rendered in ' +
          'a snapshot.\n\n' +
          'It is a 36px `--field-bg` pill holding an `IoSearch` glyph and a bare `type="search"` ' +
          'input with its border stripped. The accessibility of the whole listbox is carried here: ' +
          'an `sr-only` `<label>` bound by `htmlFor`, a duplicate `aria-label`, `aria-controls` ' +
          'pointing back at the panel, and `aria-activedescendant` naming the option the arrow keys ' +
          'are currently on - because focus never leaves the input while the list moves.\n\n' +
          'The input also `stopPropagation`s its own keydown before forwarding it, which is what ' +
          'keeps Space typing a space instead of confirming the highlighted option.\n\n' +
          'Filtering is a plain case-insensitive `includes` over the label, with no scoring and no ' +
          'empty-state row: a query that matches nothing leaves a panel that is only the search ' +
          'head.',
      },
    },
  },
  tags: ['autodocs'],
  args: { search: true },
  decorators: [
    (Story) => (
      <div className="w-80 py-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpecialityPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchHead: Story = {
  name: 'Search head',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const input = within(panel).getByRole('searchbox', { name: 'Search Speciality' });

    /* The head sits ABOVE the options and does not replace them. Named in full
       rather than counted: a head that rendered over the list, or a filter that
       ran against the empty initial query, would both still leave "six nodes". */
    await expect(optionLabels(panel)).toEqual(SPECIALITY_OPTIONS.map((option) => option.label));
    await expect(panel.firstElementChild?.className).toContain('select-input-dropdown-search');
    await expect(input).toHaveAttribute('placeholder', 'Search Speciality');

    /* The listbox relationship, asserted as a real pair rather than as "the
       attribute exists": aria-controls has to name the panel this input is
       inside, and a copy-pasted id from another dropdown would still be a
       non-empty attribute. */
    await expect(input.getAttribute('aria-controls')).toBe(panel.id);
    await expect(panel.id).not.toBe('');

    // The sr-only label is bound by htmlFor, not by wrapping - both halves matter,
    // since an unbound label leaves the input named only by its aria-label.
    const label = panel.querySelector('label.sr-only') as HTMLLabelElement;
    await expect(label.textContent?.trim()).toBe('Search Speciality');
    await expect(label.htmlFor).toBe(input.id);
    await expect(input.id).not.toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting head. The glyph is `aria-hidden`, so the only thing announced here is the ' +
          'input, twice named the same way on purpose.',
      },
    },
  },
};

export const Filtering: Story = {
  name: 'Filtering the list',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const input = within(panel).getByRole('searchbox', { name: 'Search Speciality' });

    await userEvent.type(input, 'ology');

    // Which options survive, in order - not merely that the count went down.
    await waitFor(() =>
      expect(optionLabels(panel)).toEqual([
        'Cardiology',
        'Dermatology',
        'Neurology',
        'Ophthalmology',
      ])
    );
    // The match is on the LABEL and is a substring, not a prefix: "General
    // Practice" and "Orthopedics" are the two that go.
    await expect(optionLabels(panel)).not.toContain('Orthopedics');
    await expect(input).toHaveValue('ology');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing narrows the list in place; the panel keeps its position and height rule, so it ' +
          'shrinks upward from the bottom edge rather than re-anchoring.',
      },
    },
  },
};

export const NoMatches: Story = {
  name: 'A query that matches nothing',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const input = within(panel).getByRole('searchbox', { name: 'Search Speciality' });

    await userEvent.type(input, 'zzz');

    await waitFor(() => expect(optionLabels(panel)).toHaveLength(0));
    /* No "no results" row anywhere - the panel becomes the search head and a 4px
       margin, which is the detail worth seeing rather than reading. `LabelDropdown`,
       the other dropdown in this app, DOES render a "No matches found" row here. */
    await expect(within(panel).queryByText(/no match/i)).not.toBeInTheDocument();
    // Dropped, not emptied: `activeOptionId` is undefined with no options, and
    // React omits the attribute rather than writing an empty string.
    await expect(input).not.toHaveAttribute('aria-activedescendant');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dead end. With no options left there is no active option either, so ' +
          '`aria-activedescendant` is dropped and a screen reader is told nothing about why the ' +
          'list went quiet.',
      },
    },
  },
};

export const KeyboardActiveOption: Story = {
  name: 'Arrow keys move aria-activedescendant',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const input = within(panel).getByRole('searchbox', { name: 'Search Speciality' });
    const options = [...panel.querySelectorAll('.select-input-dropdown-item')] as HTMLElement[];

    /* Opening seeds the active index at the selected option, or at 0 when nothing
       is selected - so the panel is already pointing at "General Practice". Read
       in a waitFor because that seeding happens in a render-time adjust, one
       render after the panel first appears. */
    await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id));
    await expect(options[0].className).toContain('select-input-dropdown-item-active');

    await userEvent.type(input, '{ArrowDown}{ArrowDown}');

    // Ids are read off the rendered options rather than written out: they are
    // built from a `useId` prefix, which is not stable to hardcode.
    await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id));
    await expect(options[2].className).toContain('select-input-dropdown-item-active');
    await expect(options[0].className).not.toContain('select-input-dropdown-item-active');
    // Focus stayed in the input the whole time - the list moved, the caret did not.
    await expect(input).toHaveFocus();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the search head exists to carry. Nothing is focused in the list, so the only ' +
          'signal that a row is armed is the `--nav-active-bg` wash plus this one attribute; a ' +
          'regression in either leaves the keyboard path silently broken while the mouse path ' +
          'still works.',
      },
    },
  },
};

export const WithoutSearch: Story = {
  name: 'Same panel, no search prop',
  args: { search: false },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);

    // The whole head is gone, not just the input: no pill, no glyph, no label.
    await expect(panel.querySelector('.select-input-dropdown-search')).toBeNull();
    await expect(within(panel).queryByRole('searchbox')).not.toBeInTheDocument();
    await expect(panel.querySelector('label')).toBeNull();

    // And the list is unfiltered, since `filteredList` short-circuits to the full
    // list whenever `search` is false - same six labels, same order, no head.
    await expect(optionLabels(panel)).toEqual(SPECIALITY_OPTIONS.map((option) => option.label));
    await expect(panel.firstElementChild?.className).toContain('select-input-dropdown-item');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default panel, here as the control frame. Most call sites take this one - the search ' +
          'head is opt-in per dropdown, and a six-option list like this is exactly where it is not ' +
          'worth 36px.',
      },
    },
  },
};
