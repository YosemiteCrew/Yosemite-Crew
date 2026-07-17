import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Appointment } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';
import PhoneMyDayRail, {
  type PhoneMyDayRailProps,
} from '@/app/features/appointments/components/Calendar/responsive/PhoneMyDayRail';
import type { MyDayRound } from '@/app/features/appointments/components/Calendar/responsive/myDayRail';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('react-icons/io5', () => ({
  IoBedOutline: () => <span data-testid="icon-bed" />,
  IoCheckboxOutline: () => <span data-testid="icon-checkbox" />,
  IoCheckmark: () => <span data-testid="icon-check" />,
}));

const NOW = new Date(2026, 6, 7, 10, 20);
const at = (hours: number, minutes = 0) => new Date(2026, 6, 7, hours, minutes);

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  patient: {
    id: 'pet-1',
    name: 'Pretzel',
    species: 'dog',
    parent: { id: 'parent-1', name: 'Lena Fischer' },
  },
  organisationId: 'org-1',
  appointmentDate: at(9, 45),
  startTime: at(9, 45),
  timeSlot: '09:45',
  durationMinutes: 30,
  endTime: at(10, 15),
  status: 'UPCOMING',
  appointmentType: {
    id: 'svc-1',
    name: 'ear recheck',
    speciality: { id: 'sp-1', name: 'General' },
  },
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  _id: 'task-1',
  assignedTo: 'vet-1',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  name: 'Call Lena · cytology results',
  companionId: 'pet-2',
  dueAt: at(13),
  status: 'PENDING',
  ...overrides,
});

const makeRound = (overrides: Partial<MyDayRound> = {}): MyDayRound => ({
  id: 'round-1',
  title: 'Ward 2 rounds',
  dueAt: at(12),
  items: [
    { id: 'ri-1', label: 'Poppy · Surolan 5 drops L ear', status: 'DUE' },
    { id: 'ri-2', label: 'Poppy · feed ¼ can i/d', status: 'SIGNED' },
  ],
  ...overrides,
});

const renderRail = (overrides: Partial<PhoneMyDayRailProps> = {}) => {
  const props: PhoneMyDayRailProps = {
    now: NOW,
    contextLabel: 'Tue 7 Jul · Dr. Weber',
    userInitials: 'SW',
    view: 'my-day',
    appointments: [],
    tasks: [],
    rounds: [],
    ...overrides,
  };
  return { ...render(<PhoneMyDayRail {...props} />), props };
};

describe('PhoneMyDayRail', () => {
  it('renders the header identity and context label', () => {
    renderRail();
    expect(screen.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    expect(screen.getByText('SW')).toBeInTheDocument();
    expect(screen.getByText('Tue 7 Jul · Dr. Weber')).toBeInTheDocument();
  });

  it('renders the empty state when there is nothing today', () => {
    renderRail();
    expect(screen.getByText('Nothing scheduled today.')).toBeInTheDocument();
    expect(screen.queryByTestId('my-day-now-marker')).not.toBeInTheDocument();
  });

  it('renders the three summary chips from the rail', () => {
    renderRail({
      appointments: [
        makeAppointment({ id: 'a-1', startTime: at(9, 45), status: 'COMPLETED' }),
        makeAppointment({ id: 'a-2', startTime: at(10, 30) }),
      ],
      tasks: [makeTask({ _id: 't-1', dueAt: at(9) })],
      rounds: [makeRound()],
    });

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('2 · next 10:30')).toBeInTheDocument();
    expect(screen.getByText('1 · 1 overdue')).toBeInTheDocument();
    expect(screen.getByText('1 due 12:00')).toBeInTheDocument();
  });

  describe('view toggle', () => {
    it('marks the active view and reports changes', async () => {
      const onViewChange = jest.fn();
      renderRail({ view: 'my-day', onViewChange });

      expect(screen.getByRole('button', { name: 'My day' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Clinic' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );

      await userEvent.click(screen.getByRole('button', { name: 'Clinic' }));
      expect(onViewChange).toHaveBeenCalledWith('clinic');
    });

    it('does not throw when no handler is wired', async () => {
      renderRail({ view: 'clinic' });
      await userEvent.click(screen.getByRole('button', { name: 'My day' }));
      expect(screen.getByRole('button', { name: 'Clinic' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
  });

  describe('appointments', () => {
    it('renders a completed appointment with its done time and a check', () => {
      renderRail({
        appointments: [makeAppointment({ status: 'COMPLETED', concern: 'notes signed' })],
      });
      expect(screen.getByText('Pretzel · ear recheck')).toBeInTheDocument();
      expect(screen.getByText('Done 09:45 · notes signed')).toBeInTheDocument();
      expect(screen.getByTestId('icon-check')).toBeInTheDocument();
      expect(screen.getByText('09:45')).toBeInTheDocument();
    });

    it('renders the next appointment as the focused card with actions', async () => {
      const onOpenWorkspace = jest.fn();
      const onOpenResult = jest.fn();
      const appointment = makeAppointment({
        id: 'a-next',
        startTime: at(10, 30),
        room: { id: 'rm-1', name: 'Rm 1' },
        concern: 'Result ready',
      });
      renderRail({ appointments: [appointment], onOpenWorkspace, onOpenResult });

      expect(screen.getByText('Rm 1 · Result ready · Lena Fischer')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Pretzel' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Open workspace' }));
      expect(onOpenWorkspace).toHaveBeenCalledWith(appointment);

      await userEvent.click(screen.getByRole('button', { name: 'Result' }));
      expect(onOpenResult).toHaveBeenCalledWith(appointment);
    });

    it('hides the Result action when no handler is supplied', () => {
      renderRail({ appointments: [makeAppointment({ startTime: at(10, 30) })] });
      expect(screen.getByRole('button', { name: 'Open workspace' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Result' })).not.toBeInTheDocument();
    });

    it('uses the companion photo and name when present', () => {
      const base = makeAppointment({ startTime: at(10, 30) });
      renderRail({
        appointments: [
          {
            ...base,
            companion: { ...base.patient, name: 'Poppy' },
          },
        ],
      });
      expect(screen.getByRole('img', { name: 'Poppy' })).toBeInTheDocument();
      expect(screen.getByText('Poppy · ear recheck')).toBeInTheDocument();
    });

    it('renders a later appointment as a plain upcoming card and reports selection', async () => {
      const onSelectAppointment = jest.fn();
      const next = makeAppointment({ id: 'a-next', startTime: at(10, 30) });
      const later = makeAppointment({ id: 'a-later', startTime: at(14), concern: 'vaccination' });
      renderRail({ appointments: [next, later], onSelectAppointment });

      await userEvent.click(screen.getByText('14:00').parentElement!.querySelector('button')!);
      expect(onSelectAppointment).toHaveBeenCalledWith(later);
    });

    it('reports selection of a completed appointment', async () => {
      const onSelectAppointment = jest.fn();
      const done = makeAppointment({ status: 'COMPLETED', startTime: at(9, 45) });
      renderRail({ appointments: [done], onSelectAppointment });

      await userEvent.click(screen.getByText('Pretzel · ear recheck'));
      expect(onSelectAppointment).toHaveBeenCalledWith(done);
    });

    it('does not throw when clicking cards with no selection handler', async () => {
      renderRail({
        appointments: [makeAppointment({ status: 'COMPLETED', startTime: at(9, 45) })],
      });
      await userEvent.click(screen.getByText('Pretzel · ear recheck'));
      expect(screen.getByText('Pretzel · ear recheck')).toBeInTheDocument();
    });
  });

  describe('tasks', () => {
    it('renders a task with its checkbox glyph, subtitle and due pill', () => {
      renderRail({ tasks: [makeTask()], companionNameById: { 'pet-2': 'Poppy' } });
      expect(screen.getByText('Call Lena · cytology results')).toBeInTheDocument();
      expect(screen.getByText('Task · due 13:00 · linked to Poppy')).toBeInTheDocument();
      expect(screen.getByTestId('icon-checkbox')).toBeInTheDocument();
      expect(screen.getByText('13:00')).toBeInTheDocument();
    });

    it('omits the linked companion when the task has none', () => {
      renderRail({ tasks: [makeTask({ companionId: undefined })] });
      expect(screen.getByText('Task · due 13:00')).toBeInTheDocument();
    });

    it('toggles a task', async () => {
      const onToggleTask = jest.fn();
      const task = makeTask();
      renderRail({ tasks: [task], onToggleTask });
      await userEvent.click(
        screen.getByRole('button', { name: 'Complete Call Lena · cytology results' })
      );
      expect(onToggleTask).toHaveBeenCalledWith(task);
    });

    it('shows a completed task as pressed and struck through', () => {
      renderRail({ tasks: [makeTask({ status: 'COMPLETED' })] });
      expect(
        screen.getByRole('button', { name: 'Complete Call Lena · cytology results' })
      ).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Call Lena · cytology results')).toHaveClass('line-through');
    });

    it('does not throw when toggling with no handler', async () => {
      renderRail({ tasks: [makeTask()] });
      await userEvent.click(
        screen.getByRole('button', { name: 'Complete Call Lena · cytology results' })
      );
      expect(screen.getByText('Call Lena · cytology results')).toBeInTheDocument();
    });
  });

  describe('rounds', () => {
    it('renders the round heading, items and sign affordances', () => {
      renderRail({ rounds: [makeRound()] });
      expect(screen.getByText('Ward 2 rounds · 1 due')).toBeInTheDocument();
      expect(screen.getByTestId('icon-bed')).toBeInTheDocument();
      expect(screen.getByText('Poppy · Surolan 5 drops L ear')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
      expect(screen.getByText('Signed')).toBeInTheDocument();
    });

    it('reports opening the ward and signing an item', async () => {
      const onOpenRound = jest.fn();
      const onSignRoundItem = jest.fn();
      const round = makeRound();
      renderRail({ rounds: [round], onOpenRound, onSignRoundItem });

      await userEvent.click(screen.getByRole('button', { name: 'Open ward' }));
      expect(onOpenRound).toHaveBeenCalledWith(round);

      await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
      expect(onSignRoundItem).toHaveBeenCalledWith(round, 'ri-1');
    });

    it('does not throw when round handlers are omitted', async () => {
      renderRail({ rounds: [makeRound()] });
      await userEvent.click(screen.getByRole('button', { name: 'Open ward' }));
      await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
      expect(screen.getByText('Ward 2 rounds · 1 due')).toBeInTheDocument();
    });
  });

  describe('now marker', () => {
    it('threads the marker between past and future entries', () => {
      renderRail({
        appointments: [
          makeAppointment({ id: 'a-1', startTime: at(9, 45), status: 'COMPLETED' }),
          makeAppointment({ id: 'a-2', startTime: at(10, 30) }),
        ],
      });
      const marker = screen.getByTestId('my-day-now-marker');
      expect(within(marker).getByText('10:20')).toBeInTheDocument();
    });

    it('withholds the marker once the whole day has passed', () => {
      // Reported from the running app: with everything behind you the marker
      // trailed the last row as a lone line over empty space.
      renderRail({ appointments: [makeAppointment({ startTime: at(9) })] });
      expect(screen.queryByTestId('my-day-now-marker')).not.toBeInTheDocument();
    });
  });

  describe('anytime today group', () => {
    it('renders undated tasks and rounds as pills with a count', () => {
      renderRail({
        tasks: [
          makeTask({
            _id: 't-undated',
            name: 'Sign Laboklin form',
            dueAt: null as unknown as Date,
          }),
        ],
        rounds: [makeRound({ id: 'r-undated', dueAt: null })],
      });
      expect(screen.getByText('Anytime today · 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign Laboklin form/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ward 2 rounds · 1 due/ })).toBeInTheDocument();
    });

    it('reports interaction from the anytime pills', async () => {
      const onToggleTask = jest.fn();
      const onOpenRound = jest.fn();
      const task = makeTask({ _id: 't-undated', dueAt: null as unknown as Date });
      const round = makeRound({ id: 'r-undated', dueAt: null });
      renderRail({ tasks: [task], rounds: [round], onToggleTask, onOpenRound });

      await userEvent.click(screen.getByRole('button', { name: /Call Lena/ }));
      expect(onToggleTask).toHaveBeenCalledWith(task);

      await userEvent.click(screen.getByRole('button', { name: /Ward 2 rounds/ }));
      expect(onOpenRound).toHaveBeenCalledWith(round);
    });

    it('shows a completed undated task with a check', () => {
      renderRail({
        tasks: [makeTask({ dueAt: null as unknown as Date, status: 'COMPLETED' })],
      });
      expect(screen.getByTestId('icon-check')).toBeInTheDocument();
    });

    it('does not throw when anytime handlers are omitted', async () => {
      renderRail({
        tasks: [makeTask({ dueAt: null as unknown as Date })],
        rounds: [makeRound({ dueAt: null })],
      });
      await userEvent.click(screen.getByRole('button', { name: /Call Lena/ }));
      await userEvent.click(screen.getByRole('button', { name: /Ward 2 rounds/ }));
      expect(screen.getByText('Anytime today · 2')).toBeInTheDocument();
    });

    it('hides the group entirely when everything is dated', () => {
      renderRail({ tasks: [makeTask()] });
      expect(screen.queryByText(/Anytime today/)).not.toBeInTheDocument();
    });
  });

  it('applies a caller className', () => {
    renderRail({ className: 'custom-rail' });
    expect(screen.getByRole('region', { name: 'My day' })).toHaveClass('custom-rail');
  });
});
