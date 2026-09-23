import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import TableFooter from './TableFooter';

/** Page pills in render order — the shape of the run, which is what collapses. */
const pageRun = (canvas: ReturnType<typeof within>): string[] =>
  canvas
    .getAllByRole('button')
    .map((button: HTMLElement) => button.getAttribute('aria-label') ?? '')
    .filter((label: string) => label.startsWith('Page '));

const meta = {
  title: 'Tables/TableFooter',
  component: TableFooter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one table footer: the count on the left, the numbered pager on the right.\n\n' +
          'It used to be four. `GenericTable` had this one; `PaginatedCardList` - the sub-xl ' +
          'rendering of the *same* rows - had a centred `Back`/count/`Next` cluster with no page ' +
          'numbers, no `aria-current` and a disabled arrow left at full ink. One browser resize ' +
          'across 1280px therefore swapped the control and reworded the count ("Showing 20 of 25" ' +
          'against "Showing 20 of 25 appointments") over a list that had not changed.\n\n' +
          '`rangeEnd` is the index of the last record on the page, not the number of records on ' +
          'it: the last page of 25 reads `25 of 25` however few rows it holds.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    currentPage: 2,
    totalPages: 3,
    rangeEnd: 20,
    total: 25,
    itemNoun: 'appointments',
    onPageChange: fn(),
  },
} satisfies Meta<typeof TableFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidRange: Story = {
  name: 'Mid-range: both steps live',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(pageRun(canvas)).toEqual(['Page 1', 'Page 2', 'Page 3']);
    await expect(canvas.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled();
  },
};

export const FirstPage: Story = {
  name: 'First page: Previous dimmed, not hidden',
  args: { currentPage: 1, rangeEnd: 10 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previous = canvas.getByRole('button', { name: 'Previous' });
    /* Disabled AND dimmed. The card list below xl shipped the same disabled
       arrow at full strength, because `Back`/`Next` carry no disabled treatment
       and every caller had to invent one. */
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveClass('opacity-40');
    await expect(canvas.getByRole('button', { name: 'Next' })).not.toHaveClass('opacity-40');
  },
};

export const CollapsedRun: Story = {
  name: 'Twenty pages: the run collapses',
  args: { currentPage: 9, totalPages: 20, rangeEnd: 90, total: 195, itemNoun: 'patients' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 1 … 8 9 10 … 20. Neither consumer's stories reach seven pages, so this is
    // the only frame in which the ellipsis branch is ever drawn.
    await expect(pageRun(canvas)).toEqual(['Page 1', 'Page 8', 'Page 9', 'Page 10', 'Page 20']);
    await expect(canvas.getAllByText('…')).toHaveLength(2);
    // Decoration only: a screen reader reads the pages, not the gaps.
    await expect(canvasElement.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  },
};

export const Jump: Story = {
  name: 'Jumping to a page',
  args: { currentPage: 1, rangeEnd: 10 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Page 3' }));
    // The footer is controlled - it reports the page and re-renders on the
    // caller's state, so nothing here changes without the caller.
    await expect(args.onPageChange).toHaveBeenCalledWith(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Jumping straight to a page is the capability the sub-xl cluster did not have at all: ' +
          'two arrows can only walk, so reaching page nine of a filtered list took eight clicks.',
      },
    },
  },
};
