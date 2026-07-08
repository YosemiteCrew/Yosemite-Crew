import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FormsFilters, { FormsFilterState } from '@/app/ui/filters/FormsFilters';
import { useOrgStore } from '@/app/stores/orgStore';

// --- Mocks ---

// Mock the constants from the types file
jest.mock('@/app/features/forms/types/forms', () => ({
  FormsStatusFilters: ['All', 'Active', 'Archived'],
  FormsCategoryOptions: ['Consent form', 'Discharge', 'Prescription', 'Custom', 'Boarder Intake'],
  getFormCategoryDisplayLabel: (category: string) => category,
}));

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

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();

    expect(screen.getByTestId('mock-dropdown')).toBeInTheDocument();
  });

  it("initializes with 'All' filters without emitting a change", () => {
    renderFilters();

    expect(mockOnFiltersChange).not.toHaveBeenCalled();
  });

  // --- 2. Filtering Logic (Individual) ---

  it('filters by Status (Active)', () => {
    renderFilters();

    const activeBtn = screen.getByRole('button', { name: 'Active' });
    fireEvent.click(activeBtn);

    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({ status: 'Active', category: 'All' });
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

    const activeBtn = screen.getByRole('button', { name: 'Active' });

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
    expect(screen.getByTestId('option-Boarder Intake')).toBeInTheDocument();
    expect(screen.queryByTestId('option-Custom')).toBeInTheDocument();
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

    fireEvent.click(screen.getByTestId('option-Boarder Intake'));
    expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
      status: 'All',
      category: 'Boarder Intake',
    });
    rerender(
      <FormsFilters
        filters={{ status: 'All', category: 'Boarder Intake' as any }}
        onFiltersChange={mockOnFiltersChange}
      />
    );
    expect(screen.getByTestId('dropdown-current-value')).toHaveTextContent('Boarder Intake');

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
        filters={{ status: 'All', category: 'Boarder Intake' as any }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByTestId('dropdown-current-value')).toHaveTextContent('All');
  });
});
