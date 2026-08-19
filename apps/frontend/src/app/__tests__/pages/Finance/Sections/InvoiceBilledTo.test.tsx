import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceBilledTo from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledTo';
import { Appointment } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

let storedParent: unknown = null;
let appointmentCompanion: unknown = { parent: {} };

jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: (selector: any) => selector({ getParentById: () => storedParent }),
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanion: () => appointmentCompanion,
}));

const appointment = { id: 'appt-1' } as Appointment;

describe('InvoiceBilledTo', () => {
  beforeEach(() => {
    storedParent = null;
    appointmentCompanion = { parent: {} };
  });

  it('renders the stored parent name, address and contact line', () => {
    storedParent = {
      firstName: 'Lena',
      lastName: 'Hartmann',
      email: 'lena@example.com',
      phoneNumber: '+49 171 555 0192',
      address: { addressLine: 'Bergstrasse 14', city: 'Garmisch', postalCode: '82467' },
    };

    render(<InvoiceBilledTo parentId="p1" appointment={appointment} />);

    expect(screen.getByText('Lena Hartmann')).toBeInTheDocument();
    expect(screen.getByText('Bergstrasse 14, 82467 Garmisch')).toBeInTheDocument();
    expect(screen.getByText('lena@example.com · +49 171 555 0192')).toBeInTheDocument();
  });

  it('falls back to the appointment companion parent when no stored parent exists', () => {
    appointmentCompanion = { parent: { name: 'Martha Ellis', email: 'martha@example.com' } };

    render(<InvoiceBilledTo appointment={appointment} />);

    expect(screen.getByText('Martha Ellis')).toBeInTheDocument();
    expect(screen.getByText('martha@example.com')).toBeInTheDocument();
  });

  it('renders an honest empty state when no billing contact is available', () => {
    render(<InvoiceBilledTo />);
    expect(screen.getByText('No billing contact on file.')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    storedParent = { firstName: 'Lena', email: 'lena@example.com' };
    const { container } = render(<InvoiceBilledTo parentId="p1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
