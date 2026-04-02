import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BookingErrorMessage from '@/app/features/appointments/components/BookingErrorMessage';

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="warn-icon" />,
}));

describe('BookingErrorMessage', () => {
  it('renders nothing when error is missing', () => {
    const { container } = render(<BookingErrorMessage />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning icon and error text when error exists', () => {
    render(<BookingErrorMessage error="Unable to book appointment" />);

    expect(screen.getByTestId('warn-icon')).toBeInTheDocument();
    expect(screen.getByText('Unable to book appointment')).toBeInTheDocument();
  });
});
