import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentCardContent, {
  AppointmentCompanionHeader,
  AppointmentDetails,
  AppointmentModePill,
  AppointmentStatusBadge,
} from '@/app/features/appointments/components/AppointmentCardContent';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

// Only forward the props a real <img> understands. Spreading the rest leaks
// Next-only props (fill, priority, ...) onto the DOM node, and React's
// non-boolean-attribute warning trips the console.error guard in jest.setup.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />,
}));

jest.mock('react-icons/io5', () => ({
  IoBedOutline: (props: any) => <span data-testid="icon-bed" {...props} />,
  IoFootstepsOutline: (props: any) => <span data-testid="icon-footsteps" {...props} />,
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useLoadTeam: jest.fn(),
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => 'Mar 01, 2026',
  formatTimeLabel: () => '10:00 AM',
}));

const baseCompanion = {
  name: 'Rex',
  species: 'dog',
  breed: 'Labrador',
  parent: { firstName: 'Jane', lastName: 'Doe' },
  photoUrl: 'https://cdn.example.com/rex.png',
};

const baseAppointment: any = {
  id: 'appt-1',
  companion: baseCompanion,
  appointmentDate: '2026-03-01',
  startTime: '2026-03-01T10:00:00Z',
  concern: 'Limping',
  appointmentType: { name: 'Consultation', speciality: { name: 'Orthopaedics' } },
  room: { id: 'room-1', name: 'Room A' },
  lead: { id: 'lead-1', name: 'Dr. House' },
  supportStaff: [{ name: 'Nurse Joy' }, { name: 'Nurse Sam' }],
  status: 'UPCOMING',
  appointmentKind: 'OUTPATIENT',
};

const fieldValue = (label: string) =>
  screen.getByText(`${label}:`).parentElement?.lastElementChild?.textContent;

describe('AppointmentCompanionHeader', () => {
  beforeEach(() => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
  });

  it('renders the companion photo, name with owner last name and the owner first name', () => {
    render(<AppointmentCompanionHeader appointment={baseAppointment} />);

    // The avatar is decorative (alt=""), so its implicit role is presentation.
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://cdn.example.com/rex.png'
    );
    expect(screen.getByText('Rex · Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('falls back to a species placeholder image when the companion has no photo', () => {
    render(
      <AppointmentCompanionHeader
        appointment={{ ...baseAppointment, companion: { ...baseCompanion, photoUrl: '' } }}
      />
    );

    expect(screen.getByRole('presentation')).not.toHaveAttribute(
      'src',
      'https://cdn.example.com/rex.png'
    );
  });

  it('reads the companion from the patient field when companion is absent', () => {
    const { companion: _companion, ...withoutCompanion } = baseAppointment;
    render(
      <AppointmentCompanionHeader
        appointment={{ ...withoutCompanion, patient: { ...baseCompanion, name: 'Milo' } }}
      />
    );

    expect(screen.getByText('Milo · Doe')).toBeInTheDocument();
  });
});

describe('AppointmentDetails', () => {
  beforeEach(() => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
  });

  it('renders every detail field from the appointment', () => {
    render(<AppointmentDetails appointment={baseAppointment} />);

    expect(fieldValue('Breed / Species')).toBe('Labrador / dog');
    expect(fieldValue('Date / Time')).toBe('Mar 01, 2026 / 10:00 AM');
    expect(fieldValue('Reason')).toBe('Limping');
    expect(fieldValue('Speciality')).toBe('Orthopaedics');
    expect(fieldValue('Service')).toBe('Consultation');
    expect(fieldValue('Room')).toBe('Room A');
    expect(fieldValue('Lead')).toBe('Dr. House');
    expect(fieldValue('Staff')).toBe('Nurse Joy, Nurse Sam');
  });

  it('falls back to placeholders when optional appointment fields are missing', () => {
    render(
      <AppointmentDetails
        appointment={
          {
            id: 'appt-2',
            companion: { ...baseCompanion, breed: '', species: '' },
            concern: '',
          } as any
        }
      />
    );

    // Both halves fall back independently when breed and species are missing.
    expect(fieldValue('Breed / Species')).toBe('- / -');
    expect(fieldValue('Reason')).toBe('-');
    expect(fieldValue('Speciality')).toBe('-');
    expect(fieldValue('Service')).toBe('-');
    expect(fieldValue('Room')).toBe('-');
    expect(fieldValue('Lead')).toBe('-');
    expect(fieldValue('Staff')).toBe('-');
  });

  it('resolves the lead name from the team when the appointment has only a lead id', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'other', name: 'Dr. Wrong' },
      { practionerId: 'lead-1', name: '  Dr. Team  ' },
    ]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: 'lead-1' } }} />);

    expect(fieldValue('Lead')).toBe('Dr. Team');
  });

  it('shows a placeholder when the lead id matches nobody on the team', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'someone-else', name: 'Dr. Wrong' },
    ]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: 'lead-1' } }} />);

    expect(fieldValue('Lead')).toBe('-');
  });

  it('shows a placeholder when the matched team member has a blank name', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'lead-1', name: '   ' }]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: 'lead-1' } }} />);

    expect(fieldValue('Lead')).toBe('-');
  });

  it('prefers the appointment lead name over the team lookup', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'lead-1', name: 'Dr. Team' },
    ]);

    render(
      <AppointmentDetails
        appointment={{ ...baseAppointment, lead: { id: 'lead-1', name: '  Dr. Direct  ' } }}
      />
    );

    expect(fieldValue('Lead')).toBe('Dr. Direct');
  });

  it.each([
    ['undefined', 'undefined'],
    ['null', 'null'],
    ['whitespace only', '   '],
  ])('treats a lead id that is %s as no lead at all', (_label, leadId) => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: leadId, name: 'Dr. Should Not Match' },
    ]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: leadId } }} />);

    expect(fieldValue('Lead')).toBe('-');
  });

  it('treats a nullish lead id as no lead at all', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'lead-1', name: 'Dr. Team' },
    ]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: null } }} />);

    expect(fieldValue('Lead')).toBe('-');
  });

  it('ignores team rows whose practitioner id is itself unusable', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: null, name: 'Dr. Nullish' },
      { practionerId: 'null', name: 'Dr. LiteralNull' },
      { practionerId: 'lead-1', name: 'Dr. Team' },
    ]);

    render(<AppointmentDetails appointment={{ ...baseAppointment, lead: { id: 'lead-1' } }} />);

    expect(fieldValue('Lead')).toBe('Dr. Team');
  });
});

describe('AppointmentStatusBadge', () => {
  it('renders the normalized appointment status', () => {
    render(<AppointmentStatusBadge appointment={baseAppointment} />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('falls back to Requested when the status cannot be normalized', () => {
    render(<AppointmentStatusBadge appointment={{ ...baseAppointment, status: undefined }} />);
    expect(screen.getByText('Requested')).toBeInTheDocument();
  });
});

describe('AppointmentModePill', () => {
  it('renders the outpatient pill with default props', () => {
    render(<AppointmentModePill appointment={baseAppointment} />);

    expect(screen.getByText('Outpatient')).toBeInTheDocument();
    expect(screen.getByTestId('icon-footsteps')).toBeInTheDocument();
    expect(screen.getByText('Outpatient').parentElement).toHaveStyle({
      backgroundColor: 'var(--color-neutral-100)',
    });
  });

  it('renders the inpatient pill in the default tone', () => {
    render(
      <AppointmentModePill appointment={{ ...baseAppointment, appointmentKind: 'INPATIENT' }} />
    );

    expect(screen.getByText('Inpatient')).toBeInTheDocument();
    expect(screen.getByTestId('icon-bed')).toBeInTheDocument();
    expect(screen.getByText('Inpatient').parentElement).toHaveStyle({
      backgroundColor: 'var(--color-primary-500)',
    });
  });

  it('renders the inpatient pill in the strong tone with the supplied class and icon size', () => {
    render(
      <AppointmentModePill
        appointment={{ ...baseAppointment, appointmentKind: 'INPATIENT' }}
        className="custom-class"
        iconSize={20}
        tone="strong"
      />
    );

    const pill = screen.getByText('Inpatient').parentElement as HTMLElement;
    expect(pill).toHaveClass('custom-class');
    expect(pill).toHaveStyle({ backgroundColor: 'var(--color-primary-600)' });
    expect(screen.getByTestId('icon-bed')).toHaveAttribute('size', '20');
  });

  it('renders the outpatient pill in the strong tone', () => {
    render(<AppointmentModePill appointment={baseAppointment} tone="strong" />);

    expect(screen.getByText('Outpatient').parentElement).toHaveStyle({
      backgroundColor: 'var(--color-neutral-100)',
    });
  });
});

describe('AppointmentCardContent', () => {
  beforeEach(() => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
  });

  it('composes the header, details, mode pill and status badge', () => {
    render(<AppointmentCardContent appointment={baseAppointment} />);

    expect(screen.getByText('Rex · Doe')).toBeInTheDocument();
    expect(screen.getByText('Limping')).toBeInTheDocument();
    expect(screen.getByText('Outpatient')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });
});
