import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TableFooter from '@/app/ui/tables/TableFooter';

/* The one footer behind GenericTable (above xl) and PaginatedCardList (below).
   Those two used to render different controls over the same rows: a numbered
   pager with `aria-current` on one side of the breakpoint, two bare arrows on
   the other. Everything asserted here is a thing exactly one of them had. */

const caption = (container: HTMLElement) =>
  container.querySelector('[aria-live="polite"]')?.textContent?.replaceAll(/\s+/g, ' ').trim();

const pageLabels = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => label.startsWith('Page '));

describe('TableFooter', () => {
  it('reads "Showing N of M <noun>" and marks the current page', () => {
    const { container } = render(
      <TableFooter
        currentPage={2}
        totalPages={3}
        rangeEnd={20}
        total={25}
        itemNoun="appointments"
        onPageChange={jest.fn()}
      />
    );

    expect(caption(container)).toBe('Showing 20 of 25 appointments');
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('drops the trailing space when a caller has no noun for its records', () => {
    const { container } = render(
      <TableFooter
        currentPage={1}
        totalPages={2}
        rangeEnd={10}
        total={12}
        itemNoun=""
        onPageChange={jest.fn()}
      />
    );

    expect(caption(container)).toBe('Showing 10 of 12');
  });

  it('steps and jumps through the pages', () => {
    const onPageChange = jest.fn();
    render(
      <TableFooter
        currentPage={2}
        totalPages={4}
        rangeEnd={20}
        total={35}
        itemNoun="items"
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));

    expect(onPageChange.mock.calls).toEqual([[3], [1], [4]]);
  });

  it('disables and dims the step at each end rather than hiding it', () => {
    const { rerender } = render(
      <TableFooter
        currentPage={1}
        totalPages={3}
        rangeEnd={10}
        total={25}
        itemNoun="items"
        onPageChange={jest.fn()}
      />
    );

    // Dimmed, not just disabled: the card list shipped a full-strength disabled
    // arrow while the table beside it dimmed the identical control.
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveClass('opacity-40');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toHaveClass('opacity-40');

    rerender(
      <TableFooter
        currentPage={3}
        totalPages={3}
        rangeEnd={25}
        total={25}
        itemNoun="items"
        onPageChange={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('opacity-40');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('collapses a long run behind an ellipsis so the footer never wraps', () => {
    render(
      <TableFooter
        currentPage={9}
        totalPages={20}
        rangeEnd={90}
        total={195}
        itemNoun="items"
        onPageChange={jest.fn()}
      />
    );

    // 1 … 8 9 10 … 20 — the middle window plus both ends, nothing else.
    expect(pageLabels()).toEqual(['Page 1', 'Page 8', 'Page 9', 'Page 10', 'Page 20']);
    // The gaps are decoration, so they are hidden from assistive tech.
    const ellipses = screen.getAllByText('…');
    expect(ellipses).toHaveLength(2);
    expect(ellipses[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows every page, and no ellipsis, up to the seven-pill limit', () => {
    render(
      <TableFooter
        currentPage={4}
        totalPages={7}
        rangeEnd={40}
        total={65}
        itemNoun="items"
        onPageChange={jest.fn()}
      />
    );

    expect(pageLabels()).toHaveLength(7);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });
});
