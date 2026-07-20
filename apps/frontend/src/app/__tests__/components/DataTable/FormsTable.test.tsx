import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormsTable from '@/app/ui/tables/FormsTable';
import { getFormsStatusStyle } from '@/app/ui/tables/tableUtils';
import { FormsProps } from '@/app/features/forms/types/forms';

// --- Mocks ---

// Mock GenericTable because it's a UI component we don't need to test internally here
jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => {
  return ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item: any, i: number) => (
          <tr key={i + 'forms-key'} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <td key={col.key}>{col.render ? col.render(item) : item[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

// Mock FormCard for mobile view
// Fixed: Changed div to button to satisfy a11y rules in tests
jest.mock('@/app/ui/cards/FormCard', () => {
  return ({ form, handleViewForm }: any) => (
    <button data-testid={`form-card-${form.name}`} onClick={() => handleViewForm(form)}>
      {form.name}
    </button>
  );
});

jest.mock('react-icons/io5', () => ({
  IoEllipsisHorizontal: () => <span data-testid="row-menu-icon">More</span>,
  IoClipboardOutline: () => <span data-testid="template-icon-clipboard" />,
  IoDocumentTextOutline: () => <span data-testid="template-icon-document" />,
  IoMedkitOutline: () => <span data-testid="template-icon-medkit" />,
}));

let mockTeamsById: Record<string, { practionerId?: string; name?: string }> = {};
jest.mock('@/app/stores/teamStore', () => ({
  useTeamStore: () => ({ teamsById: mockTeamsById }),
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: undefined, orgsById: {} }),
}));

// --- Test Data ---

// Fixed: Added 'schema: []' to match FormsProps type requirement
const mockForms: FormsProps[] = [
  {
    name: 'Intake Form',
    category: 'Custom' as any,
    usage: 'External',
    updatedBy: 'Alice',
    lastUpdated: '2023-10-01',
    status: 'Published',
    schema: [],
  },
  {
    name: 'Feedback Form',
    category: 'Custom' as any,
    usage: 'Internal',
    updatedBy: 'Bob',
    lastUpdated: '2023-10-05',
    status: 'Draft',
    schema: [],
  },
  {
    name: 'Archived Form',
    category: 'Custom' as any,
    usage: 'Internal',
    updatedBy: 'Charlie',
    lastUpdated: '2023-01-01',
    status: 'Archived',
    schema: [],
  },
];

describe('FormsTable Component', () => {
  const mockSetActiveForm = jest.fn();
  const mockSetViewPopup = jest.fn();

  const defaultProps = {
    filteredList: mockForms,
    setActiveForm: mockSetActiveForm,
    setViewPopup: mockSetViewPopup,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTeamsById = {};
  });

  // --- 1. Helper Function Tests ---

  describe('getStatusStyle', () => {
    it("returns the green live pill for 'Published'", () => {
      const style = getFormsStatusStyle('Published');
      expect(style).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });

    it("returns correct style for 'published' (case insensitive)", () => {
      const style = getFormsStatusStyle('published');
      expect(style).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });

    it("returns correct style for 'Draft'", () => {
      const style = getFormsStatusStyle('Draft');
      expect(style).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });

    it("returns the neutral grey pill for 'Archived'", () => {
      const style = getFormsStatusStyle('Archived');
      expect(style).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });

    it('returns the progress style for an unknown status', () => {
      const style = getFormsStatusStyle('Superseded');
      expect(style).toEqual({
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      });
    });

    it('returns neutral style for empty status', () => {
      const style = getFormsStatusStyle('');
      expect(style).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });
  });

  // --- 2. Desktop View (Table) Tests ---

  it('renders the table with correct columns in desktop view', () => {
    render(<FormsTable {...defaultProps} />);

    // Check headers
    expect(screen.getByText('Form name')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    // Design's ledger counts fields; "Usage" is not one of its columns.
    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.queryByText('Usage')).not.toBeInTheDocument();
    // The edit stamp is one merged "date · person" column, not two.
    expect(screen.queryByText('Updated by')).not.toBeInTheDocument();
    expect(screen.getByText('Last updated')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check data rendering.
    // Fixed: Use getAllByText because data renders in both desktop table and hidden mobile cards.
    expect(screen.getAllByText('Intake Form').length).toBeGreaterThan(0);
    // "Custom" appears multiple times (once per row)
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2023-10-01 · Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
  });

  it('resolves the updated-by id to a team member name and skips incomplete members', () => {
    // t1 → id + name present (map entry created); t2 → name missing; t3 → id missing.
    // Exercises both arms of the `team.practionerId && team.name` guard.
    mockTeamsById = {
      t1: { practionerId: 'u1', name: 'Dr. Weber' },
      t2: { practionerId: 'u2' },
      t3: { name: 'No Id' },
    };
    const forms = [{ ...mockForms[0], updatedBy: 'u1' }];
    render(<FormsTable {...defaultProps} filteredList={forms as any} />);

    expect(screen.getAllByText('2023-10-01 · Dr. Weber').length).toBeGreaterThan(0);
  });

  it('calls setActiveForm and setViewPopup when view action is clicked', () => {
    render(<FormsTable {...defaultProps} />);

    // Find the eye icon/button for the first row
    const viewButtons = screen.getAllByTestId('row-menu-icon');
    // Ensure we click the button wrapping the icon
    fireEvent.click(viewButtons[0].closest('button')!);

    expect(mockSetActiveForm).toHaveBeenCalledWith(mockForms[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it('shows loading state in desktop view', () => {
    render(<FormsTable {...defaultProps} loading={true} />);

    // Expect loading text (getAllByText because it might render in mobile view too)
    expect(screen.getAllByText('Loading forms…').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('generic-table')).not.toBeInTheDocument();
  });

  // --- 3. Mobile View (Cards) Tests ---

  it('renders cards in mobile view', () => {
    render(<FormsTable {...defaultProps} />);

    expect(screen.getByTestId('form-card-Intake Form')).toBeInTheDocument();
    expect(screen.getByTestId('form-card-Feedback Form')).toBeInTheDocument();
  });

  it('calls handlers when card is clicked in mobile view', () => {
    render(<FormsTable {...defaultProps} />);

    const card = screen.getByTestId('form-card-Intake Form');
    fireEvent.click(card);

    expect(mockSetActiveForm).toHaveBeenCalledWith(mockForms[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it('shows loading state in mobile view', () => {
    render(<FormsTable {...defaultProps} loading={true} />);

    expect(screen.getAllByText('Loading forms…').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('form-card-Intake Form')).not.toBeInTheDocument();
  });

  it("shows 'No data available' when list is empty in mobile view", () => {
    render(<FormsTable {...defaultProps} filteredList={[]} />);

    expect(screen.getAllByText('No data available').length).toBeGreaterThan(0);
  });

  // --- 4. Edge Cases ---

  it('renders correctly with empty status in table row', () => {
    const formWithNoStatus = [{ ...mockForms[0], status: '' }];
    render(<FormsTable {...defaultProps} filteredList={formWithNoStatus as any} />);

    const rows = screen.getAllByTestId('row-0');
    expect(rows.length).toBeGreaterThan(0);
  });

  // --- 5. Linked-services column (opt-in) ---

  describe('linked services column', () => {
    const serviceOptions = [
      { label: 'Dental scale & polish', value: 'svc-1' },
      { label: 'Mass removal', value: 'svc-2' },
    ];

    it('does not render the column by default (other callers unchanged)', () => {
      render(<FormsTable {...defaultProps} />);
      expect(screen.queryByText('Linked services')).not.toBeInTheDocument();
    });

    it('renders the column and resolves ids to service names when opted in', () => {
      const forms = [{ ...mockForms[0], services: ['svc-1', 'svc-2'] }];
      render(
        <FormsTable
          {...defaultProps}
          filteredList={forms as any}
          showLinkedServices
          serviceOptions={serviceOptions}
        />
      );

      expect(screen.getByText('Linked services')).toBeInTheDocument();
      expect(screen.getByText('Dental scale & polish')).toBeInTheDocument();
      expect(screen.getByText('Mass removal')).toBeInTheDocument();
    });

    it('falls back to the raw id when a linked service is not in the options', () => {
      const forms = [{ ...mockForms[0], services: ['svc-unknown'] }];
      render(
        <FormsTable
          {...defaultProps}
          filteredList={forms as any}
          showLinkedServices
          serviceOptions={serviceOptions}
        />
      );

      expect(screen.getByText('svc-unknown')).toBeInTheDocument();
    });

    it('renders a dash when a template has no linked services', () => {
      const forms = [{ ...mockForms[0], services: [] }];
      render(
        <FormsTable
          {...defaultProps}
          filteredList={forms as any}
          showLinkedServices
          serviceOptions={serviceOptions}
        />
      );

      expect(screen.getByText('Linked services')).toBeInTheDocument();
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('tolerates a missing serviceOptions map and undefined services', () => {
      const forms = [{ ...mockForms[0], services: undefined }];
      render(<FormsTable {...defaultProps} filteredList={forms as any} showLinkedServices />);

      expect(screen.getByText('Linked services')).toBeInTheDocument();
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });
  });
});
