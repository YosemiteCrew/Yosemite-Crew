import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import Waitlist, {
  type WaitlistEntryView,
} from '@/app/features/appointments/components/Waitlist/Waitlist';
import type { WaitlistStatus } from '@/app/features/appointments/services/waitlistService';

const entry = (
  id: string,
  status: WaitlistStatus,
  overrides: Partial<WaitlistEntryView> = {}
): WaitlistEntryView => ({
  id,
  organisationId: 'org-1',
  patientId: `patient-${id}`,
  requestedBy: null,
  preferredLeadId: null,
  appointmentType: 'Dental',
  earliestDate: null,
  latestDate: null,
  notes: null,
  status,
  offeredAt: null,
  bookedAt: null,
  expiresAt: null,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  companionName: `Companion ${id}`,
  ownerName: `Owner ${id}`,
  ...overrides,
});

const handlers = () => ({
  onOffer: jest.fn(),
  onBook: jest.fn(),
  onCancel: jest.fn(),
  onAdd: jest.fn(async () => true),
});

describe('Waitlist', () => {
  it('renders each entry with a status pill and the companion + owner', () => {
    render(
      <Waitlist
        entries={[entry('1', 'WAITING'), entry('2', 'OFFERED'), entry('3', 'BOOKED')]}
        {...handlers()}
      />
    );

    // StatusPill uppercases via CSS, so the DOM text keeps title case.
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Offered')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText('Companion 1')).toBeInTheDocument();
    expect(screen.getByText('Owner 1')).toBeInTheDocument();
  });

  it('shows the actions each status permits and hides the rest', () => {
    render(<Waitlist entries={[entry('1', 'WAITING'), entry('2', 'OFFERED')]} {...handlers()} />);

    // WAITING -> Offer, Book, Cancel. OFFERED -> Book, Cancel (no Offer).
    expect(screen.getAllByRole('button', { name: 'Offer' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Book' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
  });

  it('renders no row actions for a terminal (booked) entry', () => {
    render(<Waitlist entries={[entry('1', 'BOOKED')]} {...handlers()} />);

    expect(screen.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('invokes the offer handler with the entry id', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<Waitlist entries={[entry('42', 'WAITING')]} {...props} />);

    await user.click(screen.getByRole('button', { name: 'Offer' }));

    expect(props.onOffer).toHaveBeenCalledWith('42');
  });

  it('opens the add form and submits a payload', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <Waitlist
        entries={[entry('1', 'WAITING')]}
        companions={[{ id: 'patient-1', name: 'Bruno', ownerName: 'Sarah' }]}
        {...props}
      />
    );

    // The form is closed until the affordance is clicked.
    expect(screen.queryByText('Requested service')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add to waitlist/ }));
    expect(screen.getByText('Companion')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'patient-1');
    await user.type(screen.getByPlaceholderText('e.g. Dental, Vaccination'), 'Dental');
    // The submit button is the one inside the open form (type=submit).
    await user.click(screen.getByRole('button', { name: 'Add to waitlist' }));

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-1', appointmentType: 'Dental' })
    );
  });

  it('shows the empty state when there are no entries', () => {
    render(<Waitlist entries={[]} {...handlers()} />);

    expect(screen.getByText('No one is on the waitlist')).toBeInTheDocument();
  });

  it('shows a loading skeleton instead of rows or the empty state', () => {
    render(<Waitlist entries={[]} loading {...handlers()} />);

    expect(screen.queryByText('No one is on the waitlist')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument();
  });

  it('renders read-only when no action or add handlers are supplied', () => {
    render(<Waitlist entries={[entry('1', 'WAITING')]} />);

    expect(screen.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add to waitlist/ })).not.toBeInTheDocument();
  });

  it('numbers WAITING entries by their FIFO queue position', () => {
    render(
      <Waitlist
        entries={[entry('1', 'WAITING'), entry('2', 'OFFERED'), entry('3', 'WAITING')]}
        {...handlers()}
      />
    );

    // Two WAITING entries -> positions 1 and 2; the OFFERED row is not numbered.
    expect(screen.getByLabelText('Queue position 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Queue position 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Queue position 3')).not.toBeInTheDocument();
  });

  it('shows the error banner when an error is passed', () => {
    render(<Waitlist entries={[entry('1', 'WAITING')]} error="Boom" {...handlers()} />);

    expect(within(screen.getByRole('alert')).getByText('Boom')).toBeInTheDocument();
  });
});
