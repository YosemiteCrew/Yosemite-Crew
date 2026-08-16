import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AvailabilityTable from '@/app/ui/tables/AvailabilityTable';
import { getAvailabilityStatusStyle, getAvailabilityStatusTone } from '@/app/ui/tables/tableUtils';
import { Team } from '@/app/features/organization/types/team';

// --- Mocks ---

// Mock GenericTable to test that columns and data are passed correctly
// and to render the cell contents (which contain the logic we want to test)
jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => {
  return ({ data, columns }: any) => (
    <div data-testid="generic-table">
      <div data-testid="table-headers">
        {columns.map((col: any) => (
          <span key={col.key}>{col.label}</span>
        ))}
      </div>
      <div data-testid="table-body">
        {data.map((item: any, i: number) => (
          <div key={i + 'avaiability-key'} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <div key={col.key} data-testid={`cell-${col.key}`}>
                {col.render ? col.render(item) : item[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// Mock Next.js Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => <img src={src} alt={alt} data-testid="profile-image" />,
}));

// Mock Icons
jest.mock('react-icons/io5', () => ({
  IoEyeOutline: () => <span data-testid="eye-icon">Eye</span>,
}));

// --- Test Data ---

const mockTeam: Team[] = [
  {
    _id: '1',
    name: 'Dr. Smith',
    role: 'Doctor',
    speciality: {
      name: 'Cardiology',
      _id: 'spec-1',
      organisationId: 'org-1',
    },
    todayAppointment: '5',
    weeklyWorkingHours: '40',
    status: 'Available',
    organisationId: 'org-1',
    email: 'test@example.com',
    phone: '123',
  } as unknown as Team,
  {
    _id: '2',
    name: '', // Test fallback
    role: 'Nurse',
    // Speciality is mandatory in Team type, providing dummy for type safety
    // Component logic likely handles empty objects or we check for it
    speciality: { name: '', _id: '', organisationId: '' },
    todayAppointment: '0',
    weeklyWorkingHours: '0',
    status: 'Consulting',
    organisationId: 'org-1',
    email: 'nurse@example.com',
    phone: '456',
  } as unknown as Team,
];

describe('AvailabilityTable Component', () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  const defaultProps = {
    filteredList: mockTeam,
    setActive: mockSetActive,
    setView: mockSetView,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests ---

  describe('getStatusStyle', () => {
    it("returns correct style for 'Available'", () => {
      const style = getAvailabilityStatusStyle('Available');
      expect(style).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });

    it("returns correct style for 'Consulting'", () => {
      const style = getAvailabilityStatusStyle('Consulting');
      expect(style).toEqual({
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      });
    });

    it("returns correct style for 'Off-duty'", () => {
      const style = getAvailabilityStatusStyle('Off-duty');
      expect(style).toEqual({
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      });
    });

    it('returns default style for unknown status', () => {
      const style = getAvailabilityStatusStyle('Unknown');
      expect(style).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });

    it('handles case insensitivity', () => {
      const style = getAvailabilityStatusStyle('available');
      expect(style).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });

    it('maps dashboard availability statuses to inventory-style pill tones', () => {
      expect(getAvailabilityStatusTone('Available')).toBe('success');
      expect(getAvailabilityStatusTone('Consulting')).toBe('progress');
      expect(getAvailabilityStatusTone('Off-duty')).toBe('warning');
      expect(getAvailabilityStatusTone('Requested')).toBe('neutral');
    });
  });

  // --- 2. Rendering Tests ---

  it('renders table with all columns and data by default', () => {
    render(<AvailabilityTable {...defaultProps} />);

    // Headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Speciality')).toBeInTheDocument();
    expect(screen.getByText("Today's Appointment")).toBeInTheDocument();
    expect(screen.getByText('Weekly working hours')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Row 1 Content

    // Profile Image
  });

  it('handles fallback values for missing data', () => {
    render(<AvailabilityTable {...defaultProps} />);

    // Row 2 Content (Index 1) fallback checks
    // The mock data for row 2 has empty name and empty speciality name
    // Logic in component should render "-" for empty name.
    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThanOrEqual(1);
  });

  it('triggers view handlers when action button is clicked', () => {
    render(<AvailabilityTable {...defaultProps} />);

    const viewButtons = screen.getAllByTestId('eye-icon');
    fireEvent.click(viewButtons[0].closest('button')!);

    expect(mockSetActive).toHaveBeenCalledWith(mockTeam[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  it("hides the 'Actions' column when hideActions is true", () => {
    render(<AvailabilityTable {...defaultProps} hideActions={true} />);

    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('eye-icon')).not.toBeInTheDocument();
  });

  it('applies correct status styles in rendered component', () => {
    render(<AvailabilityTable {...defaultProps} />);
    expect(screen.getAllByTitle('Available')[0]).toHaveStyle({
      backgroundColor: 'var(--color-pill-success-bg)',
    });
    expect(screen.getAllByTitle('Consulting')[0]).toHaveStyle({
      backgroundColor: 'var(--color-pill-progress-bg)',
    });
  });

  it('formats weekly working hours to at most two decimal places', () => {
    const teamWithPreciseHours = [
      {
        ...mockTeam[0],
        weeklyWorkingHours: '40.1267',
      },
    ] as Team[];

    render(<AvailabilityTable {...defaultProps} filteredList={teamWithPreciseHours} />);

    expect(screen.getAllByText('40.13')).toHaveLength(2);
    expect(screen.queryByText('40.1267')).not.toBeInTheDocument();
  });

  // --- 3. Speciality summarisation ---

  describe('speciality cell', () => {
    // The phone card list repeats every value, so assertions scope to the cell.
    const renderSpecialities = (speciality: unknown) => {
      render(
        <AvailabilityTable
          {...defaultProps}
          filteredList={[{ ...mockTeam[0], speciality }] as unknown as Team[]}
        />
      );
      return within(screen.getByTestId('cell-speciality'));
    };

    it('shows a lone speciality with no overflow marker', () => {
      const cell = renderSpecialities(['Cardiology']);

      expect(cell.getByText('Cardiology')).toBeInTheDocument();
      expect(cell.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });

    it('leads with the first speciality and counts the rest', () => {
      const cell = renderSpecialities(['Cardiology', 'Dermatology', 'Oncology']);

      expect(cell.getByText('Cardiology')).toBeInTheDocument();
      expect(cell.getByText('+2')).toBeInTheDocument();
      // Dropping the rest from view is only acceptable because they stay reachable.
      expect(cell.getByTitle('Cardiology, Dermatology, Oncology')).toBeInTheDocument();
    });

    it('reads names out of speciality records as well as plain strings', () => {
      const cell = renderSpecialities([{ name: 'Surgery' }, { name: 'Radiology' }]);

      expect(cell.getByText('Surgery')).toBeInTheDocument();
      expect(cell.getByText('+1')).toBeInTheDocument();
    });

    it('clamps the cell to one line so a long list cannot stretch the row', () => {
      const cell = renderSpecialities(['Cardiology', 'Dermatology']);

      const wrapper = cell.getByTitle('Cardiology, Dermatology');
      // Tailwind's `truncate` is a no-op on `.appointment-profile-title`, which is
      // declared unlayered and wins, so the clamp must be `cell-truncate`.
      const clamped = wrapper.querySelector('.cell-truncate');
      expect(clamped).toHaveTextContent('Cardiology');
      expect(wrapper).not.toHaveClass('truncate');
    });

    it('keeps the overflow count outside the clamp so it cannot be clipped away', () => {
      const cell = renderSpecialities([
        'Gastroenterology and Hepatology',
        'Dermatology',
        'Oncology',
      ]);

      const wrapper = cell.getByTitle('Gastroenterology and Hepatology, Dermatology, Oncology');
      const clamped = wrapper.querySelector('.cell-truncate') as HTMLElement;
      const count = cell.getByText('+2');

      // Clamping the name and the count together let a long first speciality push
      // the "+2" past the ellipsis, so it rendered zero pixels wide. The count has
      // to be a non-shrinking sibling of the clamped name, never inside it.
      expect(clamped).not.toContainElement(count);
      expect(count.parentElement).toBe(wrapper);
      expect(count).toHaveClass('shrink-0');
    });

    it('falls back to a dash when there are no specialities', () => {
      const cell = renderSpecialities([]);

      expect(cell.getByText('-')).toBeInTheDocument();
    });
  });

  // --- 4. Edge Cases ---

  it('does not crash if event handlers are undefined', () => {
    render(<AvailabilityTable filteredList={mockTeam} />);

    const viewButtons = screen.getAllByTestId('eye-icon');
    fireEvent.click(viewButtons[0].closest('button')!);

    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockSetView).not.toHaveBeenCalled();
  });
});
