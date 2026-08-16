import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';

expect.extend(toHaveNoViolations);

type Row = { name: string; stock: number };

const buildRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ name: `Item ${index}`, stock: index }));

describe('GenericTable', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders an optional accessible caption and scoped column headers', () => {
    render(
      <GenericTable
        caption="Inventory summary"
        data={[{ name: 'Bandage', stock: 4 }]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );

    expect(screen.getByText('Inventory summary')).toHaveClass('sr-only');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('columnheader', { name: 'Stock' })).toHaveAttribute('scope', 'col');
  });

  it('has no axe accessibility violations with data', async () => {
    const { container } = render(
      <GenericTable
        caption="Inventory summary"
        data={[
          { name: 'Bandage', stock: 4 },
          { name: 'Syringe', stock: 10 },
        ]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations with empty data', async () => {
    const { container } = render(
      <GenericTable
        caption="Empty inventory"
        data={[]}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('auto-fits the page size from measured row heights and paginates', () => {
    // Give the container/rows real measured heights so the fitted-row math runs.
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const height = this.tagName === 'TR' ? 40 : 600;
      return {
        height,
        width: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    const { container, unmount } = render(
      <GenericTable
        pagination
        pageSize={5}
        data={buildRows(25)}
        columns={[
          { key: 'name', label: 'Name', width: 120, render: (row) => <span>{row.name}</span> },
          { key: 'stock', label: 'Stock' },
        ]}
      />
    );

    // needsFill applies h-full to the outer container when data overflows.
    expect(container.firstElementChild).toHaveClass('h-full');
    // col.width forwarded to the <col> element.
    expect(container.querySelector('col')?.getAttribute('style')).toContain('120');
    // col.render used for the first column.
    expect(screen.getByText('Item 0')).toBeInTheDocument();

    // Pagination bar present and navigable.
    const back = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(back).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    unmount();
  });

  it('falls back to pageSize when row heights cannot be measured', () => {
    // jsdom returns 0 heights by default -> the <=0 guard keeps pageSize.
    render(
      <GenericTable
        pagination
        pageSize={2}
        data={buildRows(4)}
        columns={[{ key: 'name', label: 'Name' }]}
      />
    );

    // 4 rows / pageSize 2 => 2 pages.
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
  });

  it('clamps the current page down when the data shrinks below it', () => {
    const columns = [{ key: 'name', label: 'Name' }] as const;
    const { rerender } = render(
      <GenericTable pagination pageSize={2} data={buildRows(4)} columns={columns as any} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // On page 2, the range end equals the total.
    expect(screen.getByText('4 of 4')).toBeInTheDocument();

    // Shrink the data so page 2 no longer exists -> clamp back to page 1 and the
    // single-page pagination bar is no longer rendered.
    rerender(<GenericTable pagination pageSize={2} data={buildRows(2)} columns={columns as any} />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('exposes the full header label as a title so a clipped header stays readable', () => {
    // The base th clips with an ellipsis rather than wrapping (wrapping doubled the
    // whole sticky band), so this title is the only way back to the full label.
    const columns = [
      { key: 'name', label: "Today's Appointment Count" },
      { key: 'blank', label: '' },
    ] as const;
    render(<GenericTable data={buildRows(1)} columns={columns as any} />);

    const labelled = screen.getByRole('columnheader', { name: "Today's Appointment Count" });
    expect(labelled).toHaveAttribute('title', "Today's Appointment Count");

    // An unlabelled column must not advertise an empty tooltip.
    const headers = screen.getAllByRole('columnheader');
    expect(headers[1]).not.toHaveAttribute('title');
  });
});
