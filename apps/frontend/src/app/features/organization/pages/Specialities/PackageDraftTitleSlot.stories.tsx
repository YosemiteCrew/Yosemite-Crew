import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import PackageDraftTitleSlot from './PackageDraftTitleSlot';

/**
 * The component is a fragment - it owns no container at all. In the product it is
 * handed to `SectionContainer` as `titleSlot`, which wraps it in
 * `flex shrink-0 items-center gap-1.5` at the right of the card header. The
 * decorator reproduces that header row verbatim: measuring the gutters inside a
 * container the story invented would only measure the story.
 */
const HeaderRow = (Story: ComponentType) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <span
      className="flex min-w-0 items-center gap-2 text-[15px] leading-snug font-bold tracking-[-0.01em]"
      style={{ color: 'var(--ink)' }}
    >
      <span className="truncate">Senior wellness plan</span>
    </span>
    <span data-slot-row="" className="flex shrink-0 items-center gap-1.5">
      <Story />
    </span>
  </div>
);

const slotRow = (canvasElement: HTMLElement) => {
  const row = canvasElement.querySelector('[data-slot-row]');
  if (!(row instanceof HTMLElement)) {
    throw new Error('slot row missing - the decorator no longer mounts the header');
  }
  return row;
};

const chipRects = (canvasElement: HTMLElement) =>
  Array.from(slotRow(canvasElement).children).map((chip) => chip.getBoundingClientRect());

const centre = (box: DOMRect) => (box.top + box.bottom) / 2;

const meta = {
  title: 'Organization/PackageDraftTitleSlot',
  component: PackageDraftTitleSlot,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The chips beside a package draft heading. Three independent conditionals with no ' +
          'shared state, which is exactly the shape nobody reviews: the combinations only ever ' +
          'appear one at a time in the running app, and there is no single screen that shows ' +
          'what a package carrying all three looks like.\n\n' +
          'Two of them are real `Badge`s and the code is not - it is a bordered caption chip, ' +
          'because a code is an identifier rather than a status and should not read as one. ' +
          'The badges also come from different sources: `isBookable` and ' +
          '`isInpatientPreferred` are the draft’s effective values, so they flip while the ' +
          'form is open, whereas the code only exists once the package has been saved.\n\n' +
          'The stories pin the order, the 6px gutters and the shared optical centre of chips ' +
          'that are not the same height - and the empty case, which must take no width at all.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [HeaderRow],
  args: {
    isBookable: false,
    isInpatientPreferred: false,
  },
} satisfies Meta<typeof PackageDraftTitleSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CodeOnly: Story = {
  name: 'Saved package, no flags',
  args: { code: 'PKG-014' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('PKG-014')).toBeInTheDocument();
    /* The code is deliberately not a Badge. Counting the row's children is the
       cheapest guard against someone "tidying" it into a third pill. */
    await expect(slotRow(canvasElement).children).toHaveLength(1);
    await expect(canvas.queryByText('Bookable')).toBeNull();
    await expect(canvas.queryByText('In-patient')).toBeNull();
  },
};

export const Bookable: Story = {
  name: 'Bookable, unsaved',
  args: { isBookable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bookable')).toBeInTheDocument();
    /* A draft has no code until it is saved, so the chip must be absent rather
       than rendered empty - an empty bordered chip is a visible 24px artefact. */
    await expect(slotRow(canvasElement).children).toHaveLength(1);
    await expect(canvas.queryByText('In-patient')).toBeNull();
  },
};

export const InPatient: Story = {
  name: 'In-patient preferred',
  args: { isInpatientPreferred: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('In-patient')).toBeInTheDocument();
    await expect(slotRow(canvasElement).children).toHaveLength(1);
    await expect(canvas.queryByText('Bookable')).toBeNull();
  },
};

export const Everything: Story = {
  name: 'Code, bookable and in-patient',
  args: { code: 'PKG-014', isBookable: true, isInpatientPreferred: true },
  play: async ({ canvasElement }) => {
    const row = slotRow(canvasElement);
    // Identifier first, then the two states. Reordering the JSX would not error.
    await expect(Array.from(row.children).map((chip) => chip.textContent)).toEqual([
      'PKG-014',
      'Bookable',
      'In-patient',
    ]);

    const [code, bookable, inpatient] = chipRects(canvasElement);
    // gap-1.5 on the SectionContainer slot: one 6px gutter, twice, not 6 then 8.
    await expect(Math.round(bookable.left - code.right)).toBe(6);
    await expect(Math.round(inpatient.left - bookable.right)).toBe(6);

    /* The code chip is taller than the pills (py-1 at caption-1 against the pill's
       py-[3px] at 10px), so items-center is doing real work here. Aligning tops
       instead would look almost right and sit the pills a pixel high. */
    await expect(Math.abs(centre(code) - centre(bookable))).toBeLessThanOrEqual(1);
    await expect(Math.abs(centre(bookable) - centre(inpatient))).toBeLessThanOrEqual(1);
    await expect(code.height).toBeGreaterThan(bookable.height);
    // The two badges are the same component, so they must draw the same height.
    await expect(bookable.height).toBe(inpatient.height);
  },
};

export const NothingSet: Story = {
  name: 'New draft with nothing set',
  play: async ({ canvasElement }) => {
    const row = slotRow(canvasElement);
    /* SectionContainer renders the slot wrapper whenever `titleSlot` is a node,
       and this component always is - so on a fresh draft the wrapper is mounted
       and empty. It has to measure zero: any padding or min-width on it would
       reserve a chip-shaped hole next to every unsaved package title. */
    await expect(row.children).toHaveLength(0);
    await expect(row.getBoundingClientRect().width).toBe(0);
  },
};
