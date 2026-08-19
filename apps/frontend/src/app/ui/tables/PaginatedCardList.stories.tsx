import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import PaginatedCardList from './PaginatedCardList';

type Row = { id: string; name: string; meta: string };

const ROWS: Row[] = [
  { id: 'r1', name: 'Midday analgesia round', meta: 'Due 12:00 - Ravi Patel' },
  { id: 'r2', name: 'Kennel 3 deep clean', meta: 'Due 13:30 - Tom Reyes' },
  { id: 'r3', name: 'Discharge call, Bailey', meta: 'Due 14:00 - Elena Marsh' },
  { id: 'r4', name: 'Restock consult room 2', meta: 'Due 15:15 - Priya Raman' },
  { id: 'r5', name: 'Post-op check, Nala', meta: 'Due 15:45 - Elena Marsh' },
  { id: 'r6', name: 'Lab courier handover', meta: 'Due 16:00 - Tom Reyes' },
  { id: 'r7', name: 'Vaccine fridge log', meta: 'Due 16:30 - Ravi Patel' },
  { id: 'r8', name: 'Insurance claim, Ollie', meta: 'Due 17:00 - Priya Raman' },
  { id: 'r9', name: 'Overnight handover notes', meta: 'Due 18:00 - Elena Marsh' },
];

/**
 * The list is generic over its item type and takes a `renderCard` callback, so a
 * story cannot pass it through `args` alone without also passing a function.
 * This harness fixes the card and leaves `items` and `pageSize` as the controls,
 * which are the two props the paging branches actually turn on.
 */
const CardList = ({ items, pageSize }: { items: Row[]; pageSize: number }) => (
  <PaginatedCardList
    items={items}
    pageSize={pageSize}
    renderCard={(item: Row) => (
      <article
        key={item.id}
        aria-label={item.name}
        className="w-[168px] rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-3.5 shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]"
      >
        <p className="text-[13.5px] font-semibold text-[var(--ink)]">{item.name}</p>
        <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">{item.meta}</p>
      </article>
    )}
  />
);

/** The pager caption, whitespace-normalised. Absent when the pager is not drawn. */
const caption = (canvasElement: HTMLElement): string | undefined =>
  canvasElement.querySelector('[aria-live="polite"]')?.textContent?.replaceAll(/\s+/g, ' ').trim();

/** Card names in render order, which is what "which page am I on" means here. */
const cardNames = (canvas: ReturnType<typeof within>): string[] =>
  canvas
    .queryAllByRole('article')
    .map((card: HTMLElement) => card.getAttribute('aria-label') ?? '');

const meta = {
  title: 'Tables/PaginatedCardList',
  component: CardList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The pager behind the sub-xl card band of the Appointments and Tasks tables. It exists ' +
          'because those bands used to render every row at once: on the dashboard, where nothing ' +
          'bounds their height, a few hundred appointments became a ~64,000px slab.\n\n' +
          'Two of its three branches had never been drawn. The **empty state** and the **pager row** ' +
          'are both conditional - the pager only when `totalPages > 1` - and its only consumers wrap ' +
          'it in `xl:hidden`, so at any Storybook width where a story of those tables is readable ' +
          'this component is `display: none`. Rendering it directly is the only way to see it.\n\n' +
          'Read the caption carefully: `Showing 8 of 9` is the index of the last card on the page, ' +
          'not a count of the cards on it. On the final page it reads `9 of 9` with one card ' +
          'visible.\n\n' +
          'Paging is internal state with no URL or caller involvement, and the page is clamped ' +
          'during render rather than corrected in an effect, so a list that shrinks under the ' +
          'current page never flashes an empty slice.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    pageSize: { control: { type: 'number', min: 1 } },
  },
  args: { items: ROWS, pageSize: 4 },
  decorators: [
    (Story) => (
      <div className="h-[340px] w-[560px] max-w-full bg-[var(--screen)] p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CardList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePage: Story = {
  name: 'One page - no pager at all',
  args: { items: ROWS.slice(0, 3), pageSize: 4 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(cardNames(canvas)).toHaveLength(3);

    /* `showPagination` is `totalPages > 1`, so a list that fits loses the whole
       footer - not a disabled pair of arrows. Both controls and the caption are
       asserted absent, because a footer rendered with everything disabled would
       look almost identical in a snapshot and still take 52px of height. */
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    await expect(caption(canvasElement)).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common case on a quiet day. Worth having as the baseline for the two stories below: ' +
          'everything they assert is a thing this frame does not contain.',
      },
    },
  },
};

export const FirstPage: Story = {
  name: 'Pager, first page',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Four of nine: the page slice, and the exact names, so a slice that started
    // at the wrong index would not pass on a count alone.
    await expect(cardNames(canvas)).toEqual([
      'Midday analgesia round',
      'Kennel 3 deep clean',
      'Discharge call, Bailey',
      'Restock consult room 2',
    ]);
    await expect(caption(canvasElement)).toBe('Showing 4 of 9');

    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nine items at a page size of four. Previous is disabled rather than hidden, so the ' +
          'footer keeps the same three-slot shape on every page.',
      },
    },
  },
};

export const SecondPage: Story = {
  name: 'Pager, after a click',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(caption(canvasElement)).toBe('Showing 8 of 9'));
    await expect(cardNames(canvas)).toEqual([
      'Post-op check, Nala',
      'Lab courier handover',
      'Vaccine fridge log',
      'Insurance claim, Ollie',
    ]);
    // Both ends live in the middle of the range - the state no static frame holds.
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Page two exists only after a click, so nothing before this story had ever rendered it. ' +
          'The caption is `aria-live="polite"`, which is the only announcement a screen reader gets ' +
          'that the cards under it changed - the cards themselves are not in a live region.',
      },
    },
  },
};

export const LastPage: Story = {
  name: 'Pager, last page (one card)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    await userEvent.click(next);

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled());
    // 9 of 9 with a single card on screen: the caption counts the last INDEX,
    // not the cards, and this is the frame where the difference is visible.
    await expect(caption(canvasElement)).toBe('Showing 9 of 9');
    await expect(cardNames(canvas)).toEqual(['Overnight handover notes']);
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The remainder page. The list keeps `content-start`, so one card sits at the top left ' +
          'rather than stretching to fill the band.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No data available',
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No data available')).toBeInTheDocument();
    await expect(cardNames(canvas)).toHaveLength(0);

    /* Empty is not "page zero": `totalPages` is 0, the clamp holds the page at 1
       and the pager is gone entirely, so there is no control offering to page
       through nothing. */
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await expect(caption(canvasElement)).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty branch is a plain centred sentence with no icon and no call to action - ' +
          'noticeably plainer than `GenericTable`’s "Looks like a quiet day… for now." card, ' +
          'which is what the same table shows one breakpoint up. Two empty states for one dataset ' +
          'is the thing to look at here.',
      },
    },
  },
};
