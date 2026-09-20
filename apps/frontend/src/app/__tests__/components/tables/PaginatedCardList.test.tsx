import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaginatedCardList from '@/app/ui/tables/PaginatedCardList';

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `item-${i + 1}` }));

/* The footer's caption is one div holding text nodes either side of a span, so
   `getByText` (which only reads a node's own text children) cannot see the whole
   sentence. This reads it the way a user does, including the noun the card list
   used to drop. */
const caption = (container: HTMLElement) =>
  container.querySelector('[aria-live="polite"]')?.textContent?.replaceAll(/\s+/g, ' ').trim();

const renderList = (count: number, pageSize = 5) =>
  render(
    <PaginatedCardList
      items={makeItems(count)}
      pageSize={pageSize}
      renderCard={(item) => <div key={item.id}>{item.id}</div>}
    />
  );

describe('PaginatedCardList', () => {
  it('renders only one page of cards rather than the whole list', () => {
    // The regression this guards: the card list used to render every row, so a
    // few hundred appointments became a ~64,000px slab on the dashboard.
    const { container } = renderList(297);

    expect(screen.getByText('item-1')).toBeInTheDocument();
    expect(screen.getByText('item-5')).toBeInTheDocument();
    expect(screen.queryByText('item-6')).not.toBeInTheDocument();
    expect(screen.queryByText('item-297')).not.toBeInTheDocument();
    /* The count now names the records, as the table's footer above xl always
       did. It read a bare "Showing 5 of 297" here, so one resize reworded the
       count over an unchanged list. */
    expect(caption(container)).toBe('Showing 5 of 297 records');
  });

  it('pages forward and back through the list', () => {
    renderList(12);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('item-6')).toBeInTheDocument();
    expect(screen.queryByText('item-1')).not.toBeInTheDocument();
    expect(screen.getByText('10 of 12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('item-1')).toBeInTheDocument();
    expect(screen.queryByText('item-6')).not.toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last, dimmed like the table', () => {
    renderList(12);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    /* The disabled arrow used to be full-strength ink here while the same
       disabled arrow on the table above xl was dimmed - `Back`/`Next` carry no
       disabled treatment of their own, so each caller invented one. */
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveClass('opacity-40');
    expect(screen.getByRole('button', { name: 'Next' })).not.toHaveClass('opacity-40');

    // Page 3 of 3 (12 items, 5 per page).
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('12 of 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('hides the pager when everything fits on one page', () => {
    renderList(3);

    expect(screen.getByText('item-3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('shows the empty state and no pager for an empty list', () => {
    renderList(0);

    /* No `itemNoun` is passed here, so this also pins the neutral default the
       shell falls back to when a caller does not name its records. */
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText('Records appear here as soon as there are any.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('clamps back to the last page when the list shrinks under the current page', () => {
    const { rerender } = renderList(12);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('item-11')).toBeInTheDocument();

    // Filtering down to 3 items must not strand the user on an empty page 3.
    rerender(
      <PaginatedCardList
        items={makeItems(3)}
        pageSize={5}
        renderCard={(item) => <div key={item.id}>{item.id}</div>}
      />
    );

    expect(screen.getByText('item-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('pages by number, and marks the current page, like the table above xl', () => {
    /* Below xl this was a centred Back/count/Next cluster: no page numbers and
       no `aria-current`, so a screen-reader user crossing the breakpoint lost
       both which page they were on and the ability to jump to one. */
    const { container } = renderList(12);

    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 3' })).not.toHaveAttribute('aria-current');

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(screen.getByText('item-11')).toBeInTheDocument();
    expect(screen.queryByText('item-1')).not.toBeInTheDocument();
    expect(caption(container)).toBe('Showing 12 of 12 records');
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('passes the absolute index to renderCard on later pages', () => {
    render(
      <PaginatedCardList
        items={makeItems(12)}
        pageSize={5}
        renderCard={(item, index) => <div key={item.id}>{`${index}:${item.id}`}</div>}
      />
    );

    expect(screen.getByText('0:item-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('5:item-6')).toBeInTheDocument();
  });
});
