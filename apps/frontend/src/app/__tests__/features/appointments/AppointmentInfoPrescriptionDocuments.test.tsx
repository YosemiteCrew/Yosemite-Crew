import { render, screen } from '@testing-library/react';
import { Appointment } from '@yosemite-crew/types';
import Documents from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents';

jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: ({ companionId }: { companionId: string }) => (
    <div data-testid="companion-documents">{companionId}</div>
  ),
}));

const makeAppointment = (overrides: Record<string, unknown>): Appointment =>
  ({ id: 'appt-1', ...overrides }) as unknown as Appointment;

describe('AppointmentInfo Prescription Documents', () => {
  it('passes the appointment companion id to the documents section', () => {
    render(<Documents activeAppointment={makeAppointment({ companion: { id: 'companion-1' } })} />);
    expect(screen.getByTestId('companion-documents')).toHaveTextContent('companion-1');
  });

  it('falls back to the patient when the appointment has no companion', () => {
    render(<Documents activeAppointment={makeAppointment({ patient: { id: 'patient-9' } })} />);
    expect(screen.getByTestId('companion-documents')).toHaveTextContent('patient-9');
  });
});
