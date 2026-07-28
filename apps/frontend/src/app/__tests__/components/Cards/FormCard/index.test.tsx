import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FormCard from '@/app/ui/cards/FormCard';
import { FormsProps } from '@/app/features/forms/types/forms';

// --- Mocks ---

jest.mock('@/app/ui/tables/tableUtils', () => ({
  getFormsStatusTone: jest.fn(() => 'success'),
}));

// --- Test Data ---

const mockForm: FormsProps = {
  _id: 'form-1',
  name: 'Intake Form',
  category: 'Client',
  description: 'Initial client data collection',
  usage: 'Onboarding',
  updatedBy: 'Admin User',
  lastUpdated: '2023-01-15',
  status: 'Published',
} as any;

describe('FormCard Component', () => {
  const mockHandleViewForm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it('renders form details correctly', () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    // Header Name
    expect(screen.getByText('Intake Form')).toBeInTheDocument();

    // Fields
    expect(screen.getByText('Client')).toBeInTheDocument(); // Category
    expect(screen.getByText('Initial client data collection')).toBeInTheDocument(); // Description
    expect(screen.getByText('Onboarding')).toBeInTheDocument(); // Usage
    expect(screen.getByText('Admin User')).toBeInTheDocument(); // Updated By
    expect(screen.getByText('2023-01-15')).toBeInTheDocument(); // Last Updated
  });

  it('resolves the updater through getUserName when provided', () => {
    // FormsTable passes a getUserName resolver so the raw user id is not shown.
    const getUserName = jest.fn(() => 'Dr. Casey Nolan');

    render(
      <FormCard form={mockForm} handleViewForm={mockHandleViewForm} getUserName={getUserName} />
    );

    expect(getUserName).toHaveBeenCalledWith('Admin User');
    expect(screen.getByText('Dr. Casey Nolan')).toBeInTheDocument();
    expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
  });

  // --- 2. Status Logic ---

  it('renders status with correct style', () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    const statusBadge = screen.getByText('Published');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass('rounded-full!', 'text-[10px]', 'font-bold', 'uppercase');
    expect(statusBadge).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: var(--color-pill-success-bg)')
    );
  });

  it('handles missing status gracefully', () => {
    const formNoStatus = { ...mockForm, status: undefined } as any;

    render(<FormCard form={formNoStatus} handleViewForm={mockHandleViewForm} />);

    const viewBtn = screen.getByText('View');
    expect(viewBtn).toBeInTheDocument();
  });

  // --- 3. Interaction ---

  it('calls handleViewForm when View button is clicked', () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    const viewBtn = screen.getByText('View');
    fireEvent.click(viewBtn);

    expect(mockHandleViewForm).toHaveBeenCalledTimes(1);
    expect(mockHandleViewForm).toHaveBeenCalledWith(mockForm);
  });
});
