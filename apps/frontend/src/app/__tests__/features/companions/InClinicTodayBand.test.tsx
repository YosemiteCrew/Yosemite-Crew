import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InClinicTodayBand from '@/app/features/companions/pages/Companions/InClinicTodayBand';

const useAppointmentsMock = jest.fn();
const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="band-photo">{alt || 'photo'}</span>,
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock('@/app/lib/forms', () => ({
  formatTimeLabel: () => '08:30',
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => 'safe-image',
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

jest.mock('react-icons/io5', () => ({
  IoArrowForward: () => <span>arrow</span>,
  IoPawOutline: () => <span>paw</span>,
}));

const today = new Date();

const companions: any = [
  {
    companion: { id: 'c1', name: 'Poppy', type: 'dog', breed: 'Beagle', photoUrl: 'p.png' },
    parent: { firstName: 'Lena' },
  },
  {
    companion: { id: 'c2', name: 'Bruno', type: 'dog', breed: 'German Shepherd' },
    parent: { firstName: 'Amelia' },
  },
];

describe('InClinicTodayBand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when there are no in-clinic appointments today', () => {
    useAppointmentsMock.mockReturnValue([]);
    const { container } = render(<InClinicTodayBand companions={companions} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a photo card and a monogram card bound to real appointments', () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'IN_PROGRESS',
        startTime: today,
        appointmentDate: today,
        concern: 'dental cleaning',
        companion: { id: 'c1', name: 'Poppy', species: 'dog', breed: 'Beagle' },
      },
      {
        id: 'a2',
        status: 'CHECKED_IN',
        startTime: today,
        appointmentDate: today,
        concern: 'vaccination',
        companion: { id: 'c2', name: 'Bruno', species: 'dog', breed: 'German Shepherd' },
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);

    expect(screen.getByText('In the clinic today')).toBeInTheDocument();
    expect(screen.getByText('Poppy')).toBeInTheDocument();
    expect(screen.getByText('Beagle · dental cleaning')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
    // c1 has a photo (Image), c2 falls back to a monogram initial.
    expect(screen.getByTestId('band-photo')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('routes to the schedule from the header link', () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'UPCOMING',
        startTime: today,
        appointmentDate: today,
        concern: '',
        companion: { id: 'c1', name: 'Poppy', species: 'dog' },
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);
    fireEvent.click(screen.getByRole('button', { name: /Open today's schedule/ }));
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });
});
