import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import Core from './Core';

/** The shape `Core` is actually written against: a flat record with `breedDog` on it. */
const FLAT_COMPANION = {
  id: 'companion-1',
  name: 'Poppy',
  breedDog: 'Beagle',
};

/**
 * The shape `CompanionInfo` really hands its panes - `<Content companion={activeCompanion} />`,
 * where `activeCompanion` is a `CompanionParent` wrapper. Kept verbatim so the story
 * documents the mismatch rather than papering over it.
 */
const WRAPPED_COMPANION = {
  companion: { id: 'companion-1', name: 'Poppy', breed: 'Beagle' },
  parent: { id: 'parent-1', firstName: 'Lena', lastName: 'Hartmann' },
};

const expand = async (canvasElement: HTMLElement, ...titles: string[]) => {
  const canvas = within(canvasElement);
  for (const title of titles) {
    await userEvent.click(canvas.getByRole('button', { name: title }));
  }
};

const meta = {
  title: 'Companions/Sections/Core',
  component: Core,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "core information" pane of the companion record: two `EditableAccordion`s over a ' +
          'single `companion` prop.\n\n' +
          'Both accordions are handed the **same** one-field config, `BreedingFields`, so ' +
          '"Physical information" is a verbatim copy of "Breeding information" rather than the ' +
          'weight and height its title promises. The field key is `breedDog`, which appears ' +
          'nowhere else in the repo - no type declares it and nothing writes it.\n\n' +
          'The pane is also unreachable. `CompanionInfo` maps it under `core-information`, but ' +
          '`getLabels()` only ever emits `companion-information` and `parent-information`, so no ' +
          'tab can select it. And if a tab did, the prop it would receive is the ' +
          '`{ companion, parent }` wrapper, not the companion record - so `breedDog` would still ' +
          'resolve to nothing. Both halves of that are drawn below.\n\n' +
          'Rendered at 530px, the width of the drawer `CompanionInfo` opens it inside (`Modal` ' +
          'with no `size` falls back to `lg`).',
      },
    },
  },
  tags: ['autodocs'],
  args: { companion: FLAT_COMPANION },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[530px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Core>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Both sections collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const title of ['Breeding information', 'Physical information']) {
      await expect(canvas.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      // `readOnly` defaults to false here, so both sections offer their pencil. The
      // labelled icon button is the only affordance - the glyph itself is
      // aria-hidden, so losing the label leaves an unnamed button.
      await expect(canvas.getByRole('button', { name: `Edit ${title}` })).toBeVisible();
    }
    // Closed means unmounted, not hidden: neither row exists in the DOM yet.
    await expect(canvas.queryByText('Breed canine')).not.toBeInTheDocument();
  },
};

export const Expanded: Story = {
  name: 'Both sections open (the same field twice)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expand(canvasElement, 'Breeding information', 'Physical information');

    // Two sections, one shared `BreedingFields` array - so "Physical information"
    // repeats the breed rather than showing weight or height. Counting the rows is
    // the assertion; checking that "Breed canine" merely exists passes either way.
    await expect(canvas.getAllByText('Breed canine')).toHaveLength(2);
    await expect(canvas.getAllByText('Beagle')).toHaveLength(2);
  },
};

export const MissingValue: Story = {
  name: 'Companion with no breedDog',
  args: { companion: { id: 'companion-2', name: 'Miso' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expand(canvasElement, 'Breeding information', 'Physical information');
    // An unset value becomes the dash every other row in PIMS uses. Rendering the
    // label with nothing beside it reads as a broken row rather than "not set".
    await expect(canvas.getAllByText('-')).toHaveLength(2);
  },
};

export const DrawerShape: Story = {
  name: 'The prop CompanionInfo actually passes',
  args: { companion: WRAPPED_COMPANION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expand(canvasElement, 'Breeding information', 'Physical information');
    // The companion underneath has a breed, and the pane still shows dashes: it
    // reads `breedDog` off the `{ companion, parent }` wrapper, one level too high.
    // Nothing objects, because the prop is typed `any`.
    await expect(canvas.getAllByText('-')).toHaveLength(2);
    await expect(canvas.queryByText('Beagle')).not.toBeInTheDocument();
  },
};

export const Editing: Story = {
  name: 'Editing one section',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Breeding information' }));

    // The pencil force-opens its section as well as switching it to inputs, so the
    // user never has to expand first. Losing that leaves an edit mode with nothing
    // visible in it.
    await expect(canvas.getByRole('button', { name: 'Breeding information' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('textbox', { name: 'Breed canine' })).toBeVisible();

    // The two accordions hold separate state despite sharing a field config: the
    // second stays closed, read-only and still offering its own pencil.
    await expect(canvas.getByRole('button', { name: 'Physical information' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.getByRole('button', { name: 'Edit Physical information' })).toBeVisible();
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);

    // Cancel restores the read view and hands the pencil back. The edited section
    // hides its own pencil while editing, so without this the only way out would be
    // a save.
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('button', { name: 'Edit Breeding information' })).toBeVisible();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: a long breed wraps rather than overflowing',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    companion: {
      id: 'companion-3',
      name: 'Tolly',
      breedDog: 'Nova Scotia Duck Tolling Retriever cross',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expand(canvasElement, 'Breeding information');

    const value = canvas.getByText('Nova Scotia Duck Tolling Retriever cross');
    const row = value.parentElement as HTMLElement;
    // The row is a `justify-between` flex with a right-aligned value and no wrap
    // control, so a long value has to give up width inside the row instead of
    // pushing past its edge.
    await expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right + 1
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
