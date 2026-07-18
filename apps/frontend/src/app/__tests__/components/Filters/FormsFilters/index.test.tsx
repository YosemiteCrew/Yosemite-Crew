import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FormsFilters, { FormsFilterState } from '@/app/ui/filters/FormsFilters';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  FormsCategoryOptions,
  getFormCategoryOptionsForOrgType,
} from '@/app/features/forms/types/forms';

// --- Mocks ---

// The real category taxonomy is used on purpose: the filter must offer exactly
// the categories the form builder can create, so stubbing the list here would
// hide any drift between the two.

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector) =>
    selector({
      primaryOrgId: 'org-1',
      orgsById: { 'org-1': { type: undefined } },
    })
  ),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;

const setOrgType = (type: string | undefined) =>
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type } } })
  );

describe('FormsFilters Component', () => {
  const mockOnFiltersChange = jest.fn();

  const renderFilters = (
    filters: FormsFilterState = { status: 'All', category: 'All' },
    categoryAction?: React.ReactNode
  ) =>
    render(
      <FormsFilters
        filters={filters}
        onFiltersChange={mockOnFiltersChange}
        categoryAction={categoryAction}
      />
    );

  const getTrigger = () => screen.getByRole('button', { name: /^Category:/ });
  const openMenu = () => fireEvent.click(getTrigger());

  beforeEach(() => {
    jest.clearAllMocks();
    setOrgType(undefined);
  });

  // --- 1. Status chips ---

  it('renders the status filter chips', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Published' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archived' })).toBeInTheDocument();
  });

  it('gives the active status chip the neutral bold pill treatment', () => {
    renderFilters({ status: 'Published', category: 'All' });
    const active = screen.getByRole('button', { name: 'Published' });
    expect(active.className).toContain('rounded-full!');
    expect(active.className).toContain('bg-[var(--inset)]');
    expect(active.className).toContain('font-bold');

    const inactive = screen.getByRole('button', { name: 'Archived' });
    expect(inactive.className).toContain('text-[var(--ink-muted)]');
    expect(inactive.className).toContain('font-semibold');
  });

  it('emits a status change without touching the category', () => {
    renderFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Published' }));
    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'Published', category: 'All' });
  });

  it('does not emit a change on initial render', () => {
    renderFilters();
    expect(mockOnFiltersChange).not.toHaveBeenCalled();
  });

  // --- 2. Category pill dropdown ---

  it('renders the category control as a rounded-full pill trigger defaulting to "All categories"', () => {
    renderFilters();
    const trigger = getTrigger();
    expect(trigger.className).toContain('rounded-full!');
    expect(trigger).toHaveTextContent('All categories');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The boxed dropdown / stacked label are gone; options stay hidden until opened.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the category menu and lists the options', () => {
    renderFilters();
    openMenu();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Category' });
    expect(within(listbox).getByTestId('option-All')).toHaveTextContent('All categories');
    expect(within(listbox).getByTestId('option-Custom')).toBeInTheDocument();
  });

  it('selects a category and closes the menu', () => {
    renderFilters();
    openMenu();
    fireEvent.click(screen.getByTestId('option-Custom'));
    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'All', category: 'Custom' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reflects the selected category label on the trigger', () => {
    const { rerender } = renderFilters();
    expect(getTrigger()).toHaveTextContent('All categories');
    rerender(
      <FormsFilters
        filters={{ status: 'All', category: 'Custom' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );
    expect(getTrigger()).toHaveTextContent('Custom');
  });

  it('marks the selected option inside the open menu', () => {
    renderFilters({ status: 'All', category: 'Custom' });
    openMenu();
    const selected = screen.getByTestId('option-Custom');
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.className).toContain('font-semibold');

    const unselected = screen.getByTestId('option-All');
    expect(unselected).toHaveAttribute('aria-selected', 'false');
  });

  it('closes on an outside mousedown but stays open for interactions inside', () => {
    renderFilters();
    openMenu();
    const listbox = screen.getByRole('listbox');
    fireEvent.mouseDown(getTrigger());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(listbox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the category menu on scroll', () => {
    renderFilters();
    openMenu();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the category action node', () => {
    renderFilters({ status: 'All', category: 'All' }, <button type="button">Add category</button>);
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  // --- 3. Org-type scoping ---

  it('limits category options based on org type and preserves Custom', () => {
    setOrgType('BOARDER');
    renderFilters();
    openMenu();
    expect(screen.getByTestId('option-Boarder - Boarding Checklist')).toBeInTheDocument();
    expect(screen.getByTestId('option-Custom')).toBeInTheDocument();
    // A boarder never sees another org type's categories.
    expect(screen.queryByTestId('option-Groomer - Grooming Prep')).not.toBeInTheDocument();
  });

  it('offers every org-agnostic category for a hospital, not just a hardcoded subset', () => {
    setOrgType('HOSPITAL');
    renderFilters();
    openMenu();
    for (const category of getFormCategoryOptionsForOrgType('HOSPITAL')) {
      expect(screen.getByTestId(`option-${category}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('option-Task Template')).toBeInTheDocument();
    expect(screen.getByTestId('option-Discharge Form')).toBeInTheDocument();
    expect(screen.getByTestId('option-SOAP')).toBeInTheDocument();
    expect(screen.getByTestId('option-Inpatient Schedule')).toBeInTheDocument();
  });

  it('offers the whole taxonomy when the org type is unknown', () => {
    renderFilters();
    openMenu();
    for (const category of FormsCategoryOptions) {
      expect(screen.getByTestId(`option-${category}`)).toBeInTheDocument();
    }
  });

  it('falls back to "All categories" on the trigger when the active category is not allowed', () => {
    setOrgType('BOARDER');
    const { rerender } = render(
      <FormsFilters
        filters={{
          status: 'All',
          category: 'Boarder - Boarding Checklist' as FormsFilterState['category'],
        }}
        onFiltersChange={mockOnFiltersChange}
      />
    );
    expect(getTrigger()).toHaveTextContent('Boarder - Boarding Checklist');

    setOrgType('HOSPITAL');
    rerender(
      <FormsFilters
        filters={{
          status: 'All',
          category: 'Boarder - Boarding Checklist' as FormsFilterState['category'],
        }}
        onFiltersChange={mockOnFiltersChange}
      />
    );
    expect(getTrigger()).toHaveTextContent('All categories');
  });

  it('honours the org-type override env var', () => {
    const prev = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE;
    process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE = 'BOARDER';
    setOrgType(undefined);
    renderFilters();
    openMenu();
    expect(screen.getByTestId('option-Boarder - Boarding Checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('option-Groomer - Grooming Prep')).not.toBeInTheDocument();
    process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE = prev;
  });
});
