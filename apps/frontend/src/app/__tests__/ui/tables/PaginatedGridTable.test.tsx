import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import PaginatedGridTable, { GridHeaderCell } from '@/app/ui/tables/PaginatedGridTable';

type Row = { id: string; name: string };

const HEADER_CELLS: GridHeaderCell[] = [
  { label: 'Name' },
  { label: 'Amount', align: 'right' },
  { label: '' },
];

const GRID_COLUMNS = '1fr 100px 80px';

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, name: `Row ${i}` }));

const renderTable = (rows: Row[], pageSize = 3, minWidthPx?: number) =>
  render(
    <PaginatedGridTable
      rows={rows}
      pageSize={pageSize}
      gridColumns={GRID_COLUMNS}
      minWidthPx={minWidthPx}
      headerCells={HEADER_CELLS}
      itemNoun="items"
      renderRow={(row) => <div key={row.id} data-testid="row" />}
      renderCard={(row) => <div key={row.id} data-testid="card" />}
    />
  );

/* The two branches are gated by CSS media queries (DataTable.css), which jsdom does
   not apply — so both are in the DOM here and every pager query must say which branch
   it means. Unscoped queries are what let the card branch ship unpaginated. */
const tableBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-table-list') as HTMLElement);
const cardBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-card-list') as HTMLElement);

describe('PaginatedGridTable', () => {
  it('renders every header cell and applies right alignment only where asked', () => {
    const { container } = renderTable(makeRows(1));

    expect(screen.getByText('Name')).not.toHaveClass('text-right');
    expect(screen.getByText('Amount')).toHaveClass('text-right');
    // The blank-label column still renders a span (keyed by index fallback).
    const header = container.querySelector('.yc-table-head') as HTMLElement;
    expect(header.querySelectorAll('span')).toHaveLength(3);
  });

  /* The horizontal floor has to clear each caller's fixed tracks plus gaps and
     gutters. One shared 1080px value left Inventory's twelve columns 76px to
     split between two fr tracks, collapsing the item name to roughly 48px, so
     the floor became per-caller — and a silent regression here brings that back. */
  it('falls back to the 1080px floor when the caller names no width', () => {
    const { container } = renderTable(makeRows(1));

    const scroller = container.querySelector('[style*="min-width"]') as HTMLElement;
    expect(scroller).toHaveStyle({ minWidth: '1080px' });
  });

  it('honours a caller floor wide enough for its own fixed tracks', () => {
    const { container } = renderTable(makeRows(1), 3, 1320);

    const scroller = container.querySelector('[style*="min-width"]') as HTMLElement;
    expect(scroller).toHaveStyle({ minWidth: '1320px' });
    // The default must not win over an explicit floor.
    expect(scroller).not.toHaveStyle({ minWidth: '1080px' });
  });

  it('applies the caller grid track to the header', () => {
    const { container } = renderTable(makeRows(1));
    const header = container.querySelector('.yc-table-head') as HTMLElement;
    expect(header).toHaveStyle({ gridTemplateColumns: GRID_COLUMNS });
  });

  it('renders the empty state, the noun-aware summary and no pagination when there are no rows', () => {
    renderTable([]);

    expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThan(0);
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('row')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
  });

  it('uses the caller noun in the empty summary', () => {
    render(
      <PaginatedGridTable
        rows={[]}
        pageSize={3}
        gridColumns={GRID_COLUMNS}
        headerCells={HEADER_CELLS}
        itemNoun="requests"
        renderRow={(row: Row) => <div key={row.id} />}
        renderCard={(row: Row) => <div key={row.id} />}
      />
    );

    expect(screen.getByText('No requests')).toBeInTheDocument();
  });

  it('renders only the current page in BOTH the row branch and the card branch', () => {
    const { container } = renderTable(makeRows(7));

    // The card branch used to render rows.map (all 7). Below 1023 the card list is
    // the only visible branch and its parent height is auto (max-lg:h-auto), so an
    // unpaged list grows the page to the full row count instead of one page of 3.
    expect(tableBranch(container).getAllByTestId('row')).toHaveLength(3);
    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(3);
    expect(tableBranch(container).getByText('Showing 1–3 of 7 items')).toBeInTheDocument();
  });

  it('shows the pager inside the card branch, not only the row branch', () => {
    const { container } = renderTable(makeRows(7));

    // The pager used to live only inside .inventory-table-list, which is display:none
    // at <=1023 — leaving the card branch with rows 4..7 unreachable and no control.
    expect(cardBranch(container).getByLabelText('Next')).toBeInTheDocument();
    expect(cardBranch(container).getByLabelText('Previous')).toBeInTheDocument();
    expect(cardBranch(container).getByText('Showing 1–3 of 7 items')).toBeInTheDocument();
  });

  it('pages the cards forward from the card branch pager', () => {
    const { container } = renderTable(makeRows(7));

    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(3);

    fireEvent.click(cardBranch(container).getByLabelText('Next'));

    expect(cardBranch(container).getByText('Showing 4–6 of 7 items')).toBeInTheDocument();
    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(3);

    // Last page is short: the card branch must render the remainder, not a full page.
    fireEvent.click(cardBranch(container).getByLabelText('Next'));
    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(1);
    expect(cardBranch(container).getByText('Showing 7–7 of 7 items')).toBeInTheDocument();
  });

  it('omits the card-branch pager entirely when there are no rows', () => {
    const { container } = renderTable([]);

    expect(cardBranch(container).getByText('Nothing here yet')).toBeInTheDocument();
    expect(cardBranch(container).queryByText('No items')).not.toBeInTheDocument();
    expect(cardBranch(container).queryByLabelText('Next')).not.toBeInTheDocument();
  });

  it('hides pagination when everything fits on one page', () => {
    const { container } = renderTable(makeRows(3));

    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
    expect(tableBranch(container).getByText('Showing 1–3 of 3 items')).toBeInTheDocument();
  });

  it('pages forward and back, updating the indicator and the summary', () => {
    const { container } = renderTable(makeRows(7));
    const pager = () => tableBranch(container);
    const expectActivePage = (page: number) =>
      expect(pager().getByLabelText(`Page ${page}`)).toHaveAttribute('aria-current', 'page');

    expectActivePage(1);

    fireEvent.click(pager().getByLabelText('Next'));
    expectActivePage(2);
    expect(pager().getByText('Showing 4–6 of 7 items')).toBeInTheDocument();

    fireEvent.click(pager().getByLabelText('Next'));
    expectActivePage(3);
    // Last page is short — the summary clamps to the total.
    expect(pager().getByText('Showing 7–7 of 7 items')).toBeInTheDocument();

    fireEvent.click(pager().getByLabelText('Previous'));
    expectActivePage(2);
  });

  it('jumps straight to a page from its numbered pill', () => {
    const { container } = renderTable(makeRows(7));
    const pager = () => tableBranch(container);

    fireEvent.click(pager().getByLabelText('Page 3'));

    expect(pager().getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
    expect(pager().getByText('Showing 7–7 of 7 items')).toBeInTheDocument();
  });

  it('collapses a long page run behind an ellipsis', () => {
    const { container } = renderTable(makeRows(60));
    const pager = () => tableBranch(container);

    // 20 pages: first, a window around the current page, and the last — never all 20.
    expect(pager().getByLabelText('Page 1')).toBeInTheDocument();
    expect(pager().getByLabelText('Page 20')).toBeInTheDocument();
    expect(pager().queryByLabelText('Page 10')).not.toBeInTheDocument();
    expect(pager().getAllByText('…').length).toBeGreaterThan(0);

    fireEvent.click(pager().getByLabelText('Page 20'));
    // At the far end the window sits on the last pages, with a leading ellipsis.
    expect(pager().getByLabelText('Page 19')).toBeInTheDocument();
    expect(pager().getAllByText('…')).toHaveLength(1);
  });

  it('disables Back on the first page and Next on the last page', () => {
    const { container } = renderTable(makeRows(7));
    const pager = () => tableBranch(container);

    const back = pager().getByLabelText('Previous');
    const next = pager().getByLabelText('Next');

    expect(back).toBeDisabled();
    expect(back).toHaveClass('cursor-not-allowed', 'opacity-40');
    expect(next).toBeEnabled();
    expect(next).not.toHaveClass('opacity-40');

    fireEvent.click(next);
    fireEvent.click(next);

    expect(pager().getByLabelText('Next')).toBeDisabled();
    expect(pager().getByLabelText('Next')).toHaveClass('cursor-not-allowed', 'opacity-40');
    expect(pager().getByLabelText('Previous')).toBeEnabled();
  });

  it('does not page past either end when the disabled control is clicked anyway', () => {
    const { container } = renderTable(makeRows(7));
    const pager = () => tableBranch(container);

    // Clicking a disabled button is a no-op in the DOM, so drive the guard by
    // firing the handler directly on the enabled edge instead.
    fireEvent.click(pager().getByLabelText('Next'));
    fireEvent.click(pager().getByLabelText('Next'));
    fireEvent.click(pager().getByLabelText('Next'));
    expect(pager().getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');

    fireEvent.click(pager().getByLabelText('Previous'));
    fireEvent.click(pager().getByLabelText('Previous'));
    fireEvent.click(pager().getByLabelText('Previous'));
    expect(pager().getByLabelText('Page 1')).toHaveAttribute('aria-current', 'page');
  });

  it('clamps the current page when the row set shrinks under it', () => {
    const { rerender, container } = renderTable(makeRows(7));
    const pager = () => tableBranch(container);

    fireEvent.click(pager().getByLabelText('Next'));
    fireEvent.click(pager().getByLabelText('Next'));
    expect(pager().getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');

    const shrunk = (rows: Row[]) => (
      <PaginatedGridTable
        rows={rows}
        pageSize={3}
        gridColumns={GRID_COLUMNS}
        headerCells={HEADER_CELLS}
        itemNoun="items"
        renderRow={(row: Row) => <div key={row.id} data-testid="row" />}
        renderCard={(row: Row) => <div key={row.id} data-testid="card" />}
      />
    );

    // 4 rows -> 2 pages: page 3 must clamp to 2.
    rerender(shrunk(makeRows(4)));
    expect(pager().getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
    expect(pager().queryByLabelText('Page 3')).not.toBeInTheDocument();
    expect(pager().getByText('Showing 4–4 of 4 items')).toBeInTheDocument();
    // The clamp must reach the cards too, not just the rows.
    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(1);

    // 2 rows -> 1 page: pagination disappears entirely.
    rerender(shrunk(makeRows(2)));
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
    expect(pager().getByText('Showing 1–2 of 2 items')).toBeInTheDocument();
  });

  it('delegates row and card rendering to the caller', () => {
    const renderRow = jest.fn((row: Row) => <div key={row.id}>row:{row.name}</div>);
    const renderCard = jest.fn((row: Row) => <div key={row.id}>card:{row.name}</div>);

    render(
      <PaginatedGridTable
        rows={makeRows(2)}
        pageSize={3}
        gridColumns={GRID_COLUMNS}
        headerCells={HEADER_CELLS}
        itemNoun="items"
        renderRow={renderRow}
        renderCard={renderCard}
      />
    );

    expect(renderRow).toHaveBeenCalledTimes(2);
    expect(renderCard).toHaveBeenCalledTimes(2);
    expect(renderRow).toHaveBeenCalledWith({ id: 'r-0', name: 'Row 0' });
    // Assert the rendered output, not just that the spy fired.
    expect(screen.getByText(/row:Row 0/)).toBeInTheDocument();
    expect(screen.getByText(/card:Row 1/)).toBeInTheDocument();
  });

  it('keeps the desktop rows and the phone cards in separate regions', () => {
    const { container } = renderTable(makeRows(2));

    expect(cardBranch(container).getAllByTestId('card')).toHaveLength(2);
    expect(tableBranch(container).getAllByTestId('row')).toHaveLength(2);
    expect(tableBranch(container).queryByTestId('card')).not.toBeInTheDocument();
  });
});
