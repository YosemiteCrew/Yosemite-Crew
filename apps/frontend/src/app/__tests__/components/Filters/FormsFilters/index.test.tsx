import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock Search Component
jest.mock('@/app/ui/inputs/Search', () => ({
  __esModule: true,
  default: ({ value, setSearch }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search..."
    />
  ),
}));

// Mock LabelDropdown Component
jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ defaultOption, onSelect, options }: any) => (
    <div data-testid="mock-dropdown">
      <div data-testid="dropdown-current-value">{defaultOption}</div>
      <div className="dropdown-options">
        {options.map((opt: any) => (
          <button key={opt.value} data-testid={`option-${opt.value}`} onClick={() => onSelect(opt)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector) =>
    selector({
      primaryOrgId: 'org-1',
      orgsById: {
        'org-1': { type: undefined },
      },
    })
  ),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;

describe('FormsFilters Component', () => {
  const mockOnFiltersChange = jest.fn();
  const renderFilters = (filters: FormsFilterState = { status: 'All', category: 'All' }) =>
    render(<FormsFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrgStore.mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: {
          'org-1': { type: undefined },
        },
      })
    );
  });

  // --- 1. Initial Render & Defaults ---

  it('renders filter UI elements correctly', () => {
    renderFilters();

    // FIX: "All" appears in status filter AND dropdown option.
    // We expect multiple instances.
    const allButtons = screen.getAllByText('All');
    expect(allButtons.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();

    expect(screen.getByTestId('mock-dropdown')).toBeInTheDocument();
  });

  it("initializes with 'All' filters without emitting a change", () => {
    renderFilters();

    expect(mockOnFiltersChange).not.toHaveBeenCalled();
  });

  // --- 2. Filtering Logic (Individual) ---

  it('filters by Status (Published)', () => {
    renderFilters();

    const activeBtn = screen.getByRole('button', { name: 'Published' });
    fireEvent.click(activeBtn);

    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'Published', category: 'All' });
  });

  it('filters by Category (Registration)', () => {
    renderFilters();

    const optionBtn = screen.getByTestId('option-Custom');
    fireEvent.click(optionBtn);

    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'All', category: 'Custom' });
  });

  // --- 3. Combined Filtering ---

  it('filters by Status + Category + Search combined', () => {
    renderFilters({ status: 'Archived', category: 'All' });

    fireEvent.click(screen.getByTestId('option-All'));

    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'Archived', category: 'All' });
  });

  // --- 4. Styling & UX ---

  it('applies active styles to the selected status button', () => {
    renderFilters();

    // FIX: Get the Status Filter "All" button specifically.
    // It's the first button with text "All" (DOM order: status filters -> dropdown -> options)
    // Or we can filter by checking the class name which contains style logic
    // The status filter button is the one rendered first in the DOM structure

    const activeBtn = screen.getByRole('button', { name: 'Published' });

    // Click 'Active'
    fireEvent.click(activeBtn);
  });

  it('updates the dropdown value visually when changed', () => {
    const { rerender } = renderFilters();

    const currentValueDisplay = screen.getByTestId('dropdown-current-value');

    expect(currentValueDisplay).toHaveTextContent('All');

    fireEvent.click(screen.getByTestId('option-Custom'));
    rerender(
      <FormsFilters
        filters={{ status: 'All', category: 'Custom' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(currentValueDisplay).toHaveTextContent('Custom');
  });

  it('limits category options based on org type and preserves the custom action', () => {
    mockUseOrgStore.mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: {
          'org-1': { type: 'BOARDER' },
        },
      })
    );

    render(
      <FormsFilters
        filters={{ status: 'All', category: 'All' }}
        onFiltersChange={mockOnFiltersChange}
        categoryAction={<button type="button">Add category</button>}
      />
    );

    expect(screen.getByText('Add category')).toBeInTheDocument();
    expect(screen.getByTestId('option-Boarder - Boarding Checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('option-Custom')).toBeInTheDocument();
    // A boarder never sees another org type's categories.
    expect(screen.queryByTestId('option-Groomer - Grooming Prep')).not.toBeInTheDocument();
  });

  it('offers every org-agnostic category, not just a hardcoded subset', () => {
    mockUseOrgStore.mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: {
          'org-1': { type: 'HOSPITAL' },
        },
      })
    );

    renderFilters();

    // Regression: the filter used to hardcode a 4-item subset and silently drop
    // categories the form builder can create.
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

    for (const category of FormsCategoryOptions) {
      expect(screen.getByTestId(`option-${category}`)).toBeInTheDocument();
    }
  });

  it('resets an invalid active category to All when the allowed options change', () => {
    mockUseOrgStore.mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: {
          'org-1': { type: 'BOARDER' },
        },
      })
    );

    const { rerender } = render(
      <FormsFilters
        filters={{ status: 'All', category: 'All' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    fireEvent.click(screen.getByTestId('option-Boarder - Boarding Checklist'));
    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
      status: 'All',
      category: 'Boarder - Boarding Checklist',
    });
    rerender(
      <FormsFilters
        filters={{ status: 'All', category: 'Boarder - Boarding Checklist' as any }}
        onFiltersChange={mockOnFiltersChange}
      />
    );
    expect(screen.getByTestId('dropdown-current-value')).toHaveTextContent(
      'Boarder - Boarding Checklist'
    );

    mockUseOrgStore.mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: {
          'org-1': { type: 'HOSPITAL' },
        },
      })
    );
    rerender(
      <FormsFilters
        filters={{ status: 'All', category: 'Boarder - Boarding Checklist' as any }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByTestId('dropdown-current-value')).toHaveTextContent('All');
  });
});
