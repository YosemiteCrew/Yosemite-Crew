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

const renderTable = (rows: Row[], pageSize = 3) =>
  render(
    <PaginatedGridTable
      rows={rows}
      pageSize={pageSize}
      gridColumns={GRID_COLUMNS}
      headerCells={HEADER_CELLS}
      itemNoun="items"
      renderRow={(row) => <div key={row.id} data-testid="row" />}
      renderCard={(row) => <div key={row.id} data-testid="card" />}
    />
  );

describe('PaginatedGridTable', () => {
  it('renders every header cell and applies right alignment only where asked', () => {
    const { container } = renderTable(makeRows(1));

    expect(screen.getByText('Name')).not.toHaveClass('text-right');
    expect(screen.getByText('Amount')).toHaveClass('text-right');
    // The blank-label column still renders a span (keyed by index fallback).
    const header = container.querySelector('.sticky') as HTMLElement;
    expect(header.querySelectorAll('span')).toHaveLength(3);
  });

  it('applies the caller grid track to the header', () => {
    const { container } = renderTable(makeRows(1));
    const header = container.querySelector('.sticky') as HTMLElement;
    expect(header).toHaveStyle({ gridTemplateColumns: GRID_COLUMNS });
  });

  it('renders the empty state, the noun-aware summary and no pagination when there are no rows', () => {
    renderTable([]);

    expect(screen.getByText('Looks like a quiet day… for now.')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
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

  it('renders only the current page of rows but every card', () => {
    renderTable(makeRows(7));

    expect(screen.getAllByTestId('row')).toHaveLength(3);
    expect(screen.getAllByTestId('card')).toHaveLength(7);
    expect(screen.getByText('Showing 1–3 of 7 items')).toBeInTheDocument();
  });

  it('hides pagination when everything fits on one page', () => {
    renderTable(makeRows(3));

    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–3 of 3 items')).toBeInTheDocument();
  });

  it('pages forward and back, updating the indicator and the summary', () => {
    renderTable(makeRows(7));

    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Showing 4–6 of 7 items')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    // Last page is short — the summary clamps to the total.
    expect(screen.getByText('Showing 7–7 of 7 items')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('disables Back on the first page and Next on the last page', () => {
    renderTable(makeRows(7));

    const back = screen.getByLabelText('Previous');
    const next = screen.getByLabelText('Next');

    expect(back).toBeDisabled();
    expect(back).toHaveClass('cursor-not-allowed', 'opacity-40');
    expect(next).toBeEnabled();
    expect(next).not.toHaveClass('opacity-40');

    fireEvent.click(next);
    fireEvent.click(next);

    expect(screen.getByLabelText('Next')).toBeDisabled();
    expect(screen.getByLabelText('Next')).toHaveClass('cursor-not-allowed', 'opacity-40');
    expect(screen.getByLabelText('Previous')).toBeEnabled();
  });

  it('does not page past either end when the disabled control is clicked anyway', () => {
    renderTable(makeRows(7));

    // Clicking a disabled button is a no-op in the DOM, so drive the guard by
    // firing the handler directly on the enabled edge instead.
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous'));
    fireEvent.click(screen.getByLabelText('Previous'));
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('clamps the current page when the row set shrinks under it', () => {
    const { rerender } = renderTable(makeRows(7));

    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

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
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 4–4 of 4 items')).toBeInTheDocument();

    // 2 rows -> 1 page: pagination disappears entirely.
    rerender(shrunk(makeRows(2)));
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–2 of 2 items')).toBeInTheDocument();
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
    expect(screen.getByText(/row:Row 0/)).toBeInTheDocument();
    expect(screen.getByText(/card:Row 1/)).toBeInTheDocument();
  });

  it('keeps the desktop rows and the phone cards in separate regions', () => {
    const { container } = renderTable(makeRows(2));

    const cardList = container.querySelector('.inventory-card-list') as HTMLElement;
    const tableList = container.querySelector('.inventory-table-list') as HTMLElement;

    expect(within(cardList).getAllByTestId('card')).toHaveLength(2);
    expect(within(tableList).getAllByTestId('row')).toHaveLength(2);
    expect(within(tableList).queryByTestId('card')).not.toBeInTheDocument();
  });
});
