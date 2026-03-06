import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Slot from '@/app/features/appointments/components/Calendar/common/Slot';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt || ''}</span>,
}));

jest.mock('@/app/ui/tables/Appointments', () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: 'purple', color: 'white' })),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: jest.fn(() => true),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => 'image'),
}));

jest.mock('react-icons/io5', () => ({
  IoEyeOutline: () => <span>view</span>,
  IoCalendarOutline: () => <span>reschedule</span>,
  IoDocumentTextOutline: () => <span>soap</span>,
  IoCardOutline: () => <span>finance</span>,
  IoFlaskOutline: () => <span>lab</span>,
}));

jest.mock('react-icons/md', () => ({
  MdOutlineAutorenew: () => <span>change-status</span>,
}));

describe('Slot (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const originalConsoleError = console.error;

  const event: any = {
    status: 'in_progress',
    startTime: new Date('2025-01-06T09:00:00Z'),
    endTime: new Date('2025-01-06T10:00:00Z'),
    concern: 'Checkup',
    lead: { name: 'Dr. Lee' },
    appointmentType: { name: 'Exam' },
    companion: { name: 'Rex', species: 'dog' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no appointments exist', () => {
    const { container } = render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ height: '120px' });
  });

  it('renders appointments and handles view/reschedule clicks', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((message: any, ...args: any[]) => {
        const text = typeof message === 'string' ? message : message?.message || '';
        if (text.includes('concurrent rendering') || text.includes('validateDOMNesting')) {
          return;
        }
        originalConsoleError(message, ...args);
      });

    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const viewButton = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(viewButton);

    expect(handleViewAppointment).toHaveBeenCalledWith(event);

    fireEvent.mouseEnter(viewButton);

    const rescheduleButton = screen.getByTitle(/reschedule/i);
    fireEvent.click(rescheduleButton);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(event);

    consoleSpy.mockRestore();
  });
});
