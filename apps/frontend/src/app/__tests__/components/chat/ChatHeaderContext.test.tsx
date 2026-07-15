import { render, screen, fireEvent } from '@testing-library/react';
import type { Appointment } from '@yosemite-crew/types';
import { ChatHeaderContext } from '@/app/features/chat/components/ChatHeaderContext';

const appointment = {
  startTime: new Date('2026-06-25T15:00:00Z'),
  patient: { name: 'Bella' },
  status: 'UPCOMING',
} as unknown as Appointment;

describe('ChatHeaderContext', () => {
  it('returns null when there are no flags and no appointment', () => {
    const { container } = render(<ChatHeaderContext onAction={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an allergy flag', () => {
    render(<ChatHeaderContext allergy="Penicillin" onAction={jest.fn()} />);
    expect(screen.getByText('Allergy: Penicillin')).toBeInTheDocument();
  });

  it('renders critical/high alerts and filters out lower-severity ones', () => {
    render(
      <ChatHeaderContext
        alerts={[
          { severity: 'critical', title: 'Bleed' },
          { severity: 'low', title: 'Mild itch' },
        ]}
        onAction={jest.fn()}
      />
    );
    expect(screen.getByText(/Bleed/)).toBeInTheDocument();
    expect(screen.queryByText(/Mild itch/)).not.toBeInTheDocument();
  });

  it('renders a high-severity alert', () => {
    render(
      <ChatHeaderContext
        alerts={[{ severity: 'high', title: 'Cardiac risk' }]}
        onAction={jest.fn()}
      />
    );
    expect(screen.getByText(/Cardiac risk/)).toBeInTheDocument();
  });

  it('skips a critical alert that has no title', () => {
    const { container } = render(
      <ChatHeaderContext alerts={[{ severity: 'critical' }]} onAction={jest.fn()} />
    );
    // No flags and no appointment -> renders null.
    expect(container).toBeEmptyDOMElement();
  });

  it('joins multiple flags with a separator', () => {
    render(
      <ChatHeaderContext
        allergy="Penicillin"
        alerts={[{ severity: 'critical', title: 'Bleed' }]}
        onAction={jest.fn()}
      />
    );
    expect(screen.getByText('Allergy: Penicillin · Bleed')).toBeInTheDocument();
  });

  it('renders the appointment banner with a formatted label and patient name', () => {
    render(<ChatHeaderContext appointment={appointment} onAction={jest.fn()} />);
    expect(screen.getByText('Appointment')).toBeInTheDocument();
    expect(screen.getByText(/Bella/)).toBeInTheDocument();
  });

  it('shows reschedule for upcoming appointments and hides mark complete', () => {
    render(<ChatHeaderContext appointment={appointment} onAction={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send form' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book follow-up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  });

  it('shows mark complete for in-progress appointments and hides reschedule', () => {
    render(
      <ChatHeaderContext
        appointment={{ ...appointment, status: 'IN_PROGRESS' } as Appointment}
        onAction={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
  });

  it('hides mark complete while a completion request is in flight', () => {
    render(
      <ChatHeaderContext
        appointment={{ ...appointment, status: 'IN_PROGRESS' } as Appointment}
        completing
        onAction={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  });

  it.each(['Reschedule', 'Send form', 'Book follow-up'])(
    'calls onAction with "%s" when that button is clicked',
    (label) => {
      const onAction = jest.fn();
      render(<ChatHeaderContext appointment={appointment} onAction={onAction} />);
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(onAction).toHaveBeenCalledWith(label);
    }
  );

  it('calls onAction with "Mark complete" for in-progress appointments', () => {
    const onAction = jest.fn();
    render(
      <ChatHeaderContext
        appointment={{ ...appointment, status: 'IN_PROGRESS' } as Appointment}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(onAction).toHaveBeenCalledWith('Mark complete');
  });

  it('falls back to "Linked appointment" when start time and name are absent', () => {
    const bare = {} as unknown as Appointment;
    render(<ChatHeaderContext appointment={bare} onAction={jest.fn()} />);
    expect(screen.getByText('Linked appointment')).toBeInTheDocument();
  });

  it('uses the companion name when patient name is absent', () => {
    const companionAppt = {
      startTime: new Date('2026-06-25T15:00:00Z'),
      companion: { name: 'Rex' },
    } as unknown as Appointment;
    render(<ChatHeaderContext appointment={companionAppt} onAction={jest.fn()} />);
    expect(screen.getByText(/Rex/)).toBeInTheDocument();
  });

  it('renders both the flags bar and the appointment banner together', () => {
    render(
      <ChatHeaderContext allergy="Penicillin" appointment={appointment} onAction={jest.fn()} />
    );
    expect(screen.getByText(/Allergy: Penicillin/)).toBeInTheDocument();
    expect(screen.getByText('Appointment')).toBeInTheDocument();
  });
});
