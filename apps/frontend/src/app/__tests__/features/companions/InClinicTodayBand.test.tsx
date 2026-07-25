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

  it('opens the specific appointment on card click and keyboard activation', () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1 b',
        status: 'IN_PROGRESS',
        startTime: today,
        appointmentDate: today,
        concern: 'dental cleaning',
        companion: { id: 'c1', name: 'Poppy', species: 'dog', breed: 'Beagle' },
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);

    const card = screen.getByRole('button', {
      name: 'Open appointment for Poppy, 08:30, In progress',
    });

    fireEvent.click(card);
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=a1%20b&open=details');

    pushMock.mockClear();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=a1%20b&open=details');

    pushMock.mockClear();
    fireEvent.keyDown(card, { key: ' ' });
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=a1%20b&open=details');

    // A non-activation key is ignored.
    pushMock.mockClear();
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders a non-interactive card when the appointment has no id', () => {
    useAppointmentsMock.mockReturnValue([
      {
        status: 'CHECKED_IN',
        appointmentDate: today,
        companion: { id: 'c1', name: 'Poppy', species: 'dog' },
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);

    // No appointment id → the card is not exposed as a button and cannot navigate.
    expect(screen.queryByRole('button', { name: /Open appointment for/ })).not.toBeInTheDocument();
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

  it('builds fallback cards for unlinked appointments and hides empty subtitles', () => {
    useAppointmentsMock.mockReturnValue([
      {
        // companion id present but not in the directory → byId.get() misses,
        // so name/breed/species fall back to the appointment's own companion.
        id: 'a3',
        status: 'BOOKED',
        startTime: today,
        appointmentDate: today,
        concern: '',
        companion: { id: 'zzz', name: 'Ghost', species: 'cat' },
      },
      {
        // no companion object at all → the appointment.companion?.id ternary
        // takes the falsy branch and species falls all the way back to ''.
        id: 'a4',
        status: undefined,
        startTime: today,
        appointmentDate: today,
        concern: 'checkup',
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);

    // Unlinked appointment: name + monogram come from the appointment itself.
    expect(screen.getByText('Ghost')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    // No breed and no concern → subtitle is empty and the span is not rendered.
    expect(screen.queryByText('Beagle · dental cleaning')).not.toBeInTheDocument();
    // A concern-only appointment still shows the concern as the subtitle.
    expect(screen.getByText('checkup')).toBeInTheDocument();
    // No companion → blank name → '?' monogram fallback.
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('falls back to appointmentDate, an index key and an empty concern when fields are missing', () => {
    useAppointmentsMock.mockReturnValue([
      {
        // No `id` → the card key falls back to `${name}-${index}`.
        // No `startTime` → the time label reads `appointmentDate`.
        // No `concern` → the String(...) coalesces to '' and the subtitle is breed-only.
        status: 'CHECKED_IN',
        appointmentDate: today,
        companion: { id: 'c1', name: 'Poppy', species: 'dog' },
      },
    ]);

    render(<InClinicTodayBand companions={companions} />);

    expect(screen.getByText('Poppy')).toBeInTheDocument();
    // Linked companion supplies the breed; with no concern the subtitle has no separator.
    expect(screen.getByText('Beagle')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
  });
});
