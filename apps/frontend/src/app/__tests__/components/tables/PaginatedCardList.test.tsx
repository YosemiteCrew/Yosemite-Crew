import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaginatedCardList from '@/app/ui/tables/PaginatedCardList';

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `item-${i + 1}` }));

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
    renderList(297);

    expect(screen.getByText('item-1')).toBeInTheDocument();
    expect(screen.getByText('item-5')).toBeInTheDocument();
    expect(screen.queryByText('item-6')).not.toBeInTheDocument();
    expect(screen.queryByText('item-297')).not.toBeInTheDocument();
    expect(screen.getByText('5 of 297')).toBeInTheDocument();
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

  it('disables Previous on the first page and Next on the last', () => {
    renderList(12);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

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

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Records appear here as soon as they are added.')).toBeInTheDocument();
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
