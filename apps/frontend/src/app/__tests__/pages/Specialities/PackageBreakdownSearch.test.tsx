import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PackageBreakdownSearch from '@/app/features/organization/pages/Specialities/PackageBreakdownSearch';
import type { CatalogEntry } from '@/app/features/organization/pages/Specialities/packageFormDraftHelpers';

const entry = (id: string, name: string, unitPrice = 10): CatalogEntry => ({
  id,
  name,
  type: 'CONSULTATION',
  unitPrice,
  defaultDiscount: 0,
  maxDiscount: 20,
  isBookable: true,
  isInpatientPreferred: false,
});

const CATALOG: CatalogEntry[] = [
  entry('cat-1', 'Dermatology consult', 85),
  entry('cat-2', 'Dental scale and polish', 240),
  entry('cat-3', 'Full blood panel', 62),
];

describe('PackageBreakdownSearch', () => {
  const onQueryChange = jest.fn();
  const onSelectItem = jest.fn();

  const baseProps = {
    searchQuery: 'de',
    onQueryChange,
    filteredSearch: CATALOG,
    searchLoading: false,
    orgCurrency: 'USD',
    onSelectItem,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Real usage never mounts the panel already open - it opens via a
   * `filteredSearch` prop transition from empty to populated as the parent
   * recomputes results while the user types (see PackageBreakdownSearch.stories
   * "Typing opens the results panel"). That transition is what seeds the
   * highlighted index at 0, so keyboard-nav tests replay it instead of
   * mounting pre-populated.
   */
  const openPanel = () => {
    const utils = render(
      <PackageBreakdownSearch {...baseProps} searchQuery="" filteredSearch={[]} />
    );
    utils.rerender(<PackageBreakdownSearch {...baseProps} />);
    return utils;
  };

  it('renders the panel and options with the canonical floating-panel tokens', () => {
    render(<PackageBreakdownSearch {...baseProps} />);

    const panel = screen.getByRole('listbox', { name: 'Catalog search results' });
    expect(panel.className).toContain('rounded-[13px]');
    expect(panel.className).toContain('border-[var(--hairline)]');
    expect(panel.className).toContain('shadow-[0_24px_60px_var(--sh28)]');
    expect(panel.className).not.toContain('rounded-2xl');
    expect(panel.className).not.toContain('border-card-border');
    expect(panel.className).not.toContain('shadow-lg');

    // The field container was hand-rolled with the same stale tokens.
    const input = screen.getByRole('combobox', { name: 'Search catalog items' });
    const container = input.parentElement as HTMLElement;
    expect(container.className).toContain('rounded-[12px]');
    expect(container.className).toContain('border-[var(--hairline)]');
    expect(container.className).not.toContain('rounded-2xl');
    expect(container.className).not.toContain('input-border-default');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('moves the highlighted option on ArrowDown', () => {
    openPanel();
    const input = screen.getByRole('combobox', { name: 'Search catalog items' });
    const options = screen.getAllByRole('option');

    // Opening seeds the highlight on the first option.
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
  });

  it('selects the highlighted option on Enter', () => {
    openPanel();
    const input = screen.getByRole('combobox', { name: 'Search catalog items' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(CATALOG[1]);
  });

  it('closes the panel on Escape without selecting', () => {
    render(<PackageBreakdownSearch {...baseProps} />);
    const input = screen.getByRole('combobox', { name: 'Search catalog items' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelectItem).not.toHaveBeenCalled();
  });

  it('still supports click-to-select without changing the query/filter contract', () => {
    render(<PackageBreakdownSearch {...baseProps} />);

    fireEvent.click(screen.getByRole('option', { name: /Full blood panel/ }));

    expect(onSelectItem).toHaveBeenCalledWith(CATALOG[2]);
  });
});
