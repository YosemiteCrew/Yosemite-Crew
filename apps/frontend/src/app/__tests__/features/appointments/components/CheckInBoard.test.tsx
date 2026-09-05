import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CheckInBoard, {
  type PatientCheckInView,
} from '@/app/features/appointments/components/CheckInBoard/CheckInBoard';
import type {
  CheckInStatus,
  TriagePriority,
} from '@/app/features/appointments/services/patientCheckInService';

const row = (
  id: string,
  status: CheckInStatus,
  triagePriority: TriagePriority,
  overrides: Partial<PatientCheckInView> = {}
): PatientCheckInView => ({
  id,
  organisationId: 'org-1',
  patientId: `patient-${id}`,
  clientId: `client-${id}`,
  appointmentId: null,
  arrivedAt: '2026-09-05T08:00:00.000Z',
  triagePriority,
  triageNote: null,
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: '2026-09-05T08:00:00.000Z',
  seenAt: null,
  waitMinutes: 15,
  status,
  notes: null,
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
  companionName: `Companion ${id}`,
  ownerName: `Owner ${id}`,
  ...overrides,
});

const handlers = () => ({
  onSeen: jest.fn(),
  onComplete: jest.fn(),
  onCancel: jest.fn(),
  onNoShow: jest.fn(),
  onAssignRoom: jest.fn(),
  onAdd: jest.fn(async () => true),
  onToggleShowAll: jest.fn(),
});

describe('CheckInBoard', () => {
  it('renders each row with a triage pill, status pill and patient + owner', () => {
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD'), row('2', 'IN_CONSULTATION', 'URGENT')]}
        {...handlers()}
      />
    );

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('In consultation')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Companion 1')).toBeInTheDocument();
    expect(screen.getByText('Owner 1')).toBeInTheDocument();
  });

  it('sorts rows by triage priority then arrival, most urgent first', () => {
    render(
      <CheckInBoard
        entries={[
          row('std', 'WAITING', 'STANDARD', {
            companionName: 'Standard Pet',
            arrivedAt: '2026-09-05T07:00:00.000Z',
          }),
          row('imm', 'WAITING', 'IMMEDIATE', {
            companionName: 'Immediate Pet',
            arrivedAt: '2026-09-05T09:00:00.000Z',
          }),
          row('urg', 'WAITING', 'URGENT', { companionName: 'Urgent Pet' }),
        ]}
        {...handlers()}
      />
    );

    const names = screen
      .getAllByText(/Immediate Pet|Urgent Pet|Standard Pet/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Immediate Pet', 'Urgent Pet', 'Standard Pet']);
  });

  it('breaks a triage tie by earliest arrival', () => {
    render(
      <CheckInBoard
        entries={[
          row('late', 'WAITING', 'STANDARD', {
            companionName: 'Late Pet',
            arrivedAt: '2026-09-05T10:00:00.000Z',
          }),
          row('early', 'WAITING', 'STANDARD', {
            companionName: 'Early Pet',
            arrivedAt: '2026-09-05T08:00:00.000Z',
          }),
        ]}
        {...handlers()}
      />
    );

    const names = screen.getAllByText(/Late Pet|Early Pet/).map((el) => el.textContent);
    expect(names).toEqual(['Early Pet', 'Late Pet']);
  });

  it('shows the actions each status permits and hides the rest', () => {
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD'), row('2', 'IN_CONSULTATION', 'STANDARD')]}
        {...handlers()}
      />
    );

    // WAITING -> Start consult, No-show, Cancel. IN_CONSULTATION -> Complete, Cancel.
    expect(screen.getAllByRole('button', { name: 'Start consult' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'No-show' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Complete' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
  });

  it('renders no row actions for a terminal (completed) entry', () => {
    // `showAll` so the completed row actually renders - without it the board
    // filters terminal statuses out and the assertions below would pass for the
    // wrong reason.
    render(<CheckInBoard entries={[row('1', 'COMPLETED', 'STANDARD')]} showAll {...handlers()} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start consult' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('hides terminal statuses unless showing all', () => {
    const entries = [row('1', 'WAITING', 'STANDARD'), row('2', 'COMPLETED', 'STANDARD')];
    const { rerender } = render(<CheckInBoard entries={entries} {...handlers()} />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();

    rerender(<CheckInBoard entries={entries} showAll {...handlers()} />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('invokes the seen handler with the entry id', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<CheckInBoard entries={[row('42', 'WAITING', 'STANDARD')]} {...props} />);

    await user.click(screen.getByRole('button', { name: 'Start consult' }));

    expect(props.onSeen).toHaveBeenCalledWith('42');
  });

  it('assigns a room from the row select', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <CheckInBoard
        entries={[row('7', 'WAITING', 'STANDARD')]}
        rooms={[
          { id: 'room-1', name: 'Exam 1' },
          { id: 'room-2', name: 'Exam 2' },
        ]}
        {...props}
      />
    );

    await user.selectOptions(screen.getByLabelText('Assign room'), 'room-2');
    expect(props.onAssignRoom).toHaveBeenCalledWith('7', 'room-2');
  });

  it('does not render the room control when no rooms are available', () => {
    render(<CheckInBoard entries={[row('1', 'WAITING', 'STANDARD')]} {...handlers()} />);

    expect(screen.queryByLabelText('Assign room')).not.toBeInTheDocument();
  });

  it('shows the assigned room name and triage note in the row detail', () => {
    render(
      <CheckInBoard
        entries={[
          row('1', 'IN_CONSULTATION', 'URGENT', {
            roomName: 'Exam 3',
            triageNote: 'Laboured breathing',
          }),
        ]}
        {...handlers()}
      />
    );

    expect(screen.getByText('Room: Exam 3 · Laboured breathing')).toBeInTheDocument();
  });

  it('opens the add form and submits a payload with the derived client id', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD')]}
        companions={[{ id: 'patient-9', name: 'Bruno', ownerName: 'Sarah', clientId: 'client-9' }]}
        {...props}
      />
    );

    expect(screen.queryByText('Triage priority')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    expect(screen.getByText('Patient')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Patient'), 'patient-9');
    await user.selectOptions(screen.getByLabelText('Triage priority'), 'IMMEDIATE');
    await user.click(screen.getByRole('button', { name: 'Check in patient' }));

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-9',
        clientId: 'client-9',
        triagePriority: 'IMMEDIATE',
        arrivedAt: expect.any(String),
      })
    );
  });

  it('submits the optional triage note, notes and an edited arrival time', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <CheckInBoard
        entries={[]}
        companions={[{ id: 'patient-9', name: 'Bruno', clientId: 'client-9' }]}
        {...props}
      />
    );

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    await user.selectOptions(screen.getByLabelText('Patient'), 'patient-9');
    await user.clear(screen.getByLabelText('Arrived at'));
    await user.type(screen.getByLabelText('Arrived at'), '2026-09-05T07:15');
    await user.type(screen.getByLabelText('Triage note'), 'Vomiting since morning');
    await user.type(screen.getByLabelText('Notes'), 'Owner waiting in car park');
    await user.click(screen.getByRole('button', { name: 'Check in patient' }));

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-9',
        clientId: 'client-9',
        triageNote: 'Vomiting since morning',
        notes: 'Owner waiting in car park',
        arrivedAt: new Date('2026-09-05T07:15').toISOString(),
      })
    );
  });

  it('ignores selecting the placeholder in the room control', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <CheckInBoard
        entries={[row('7', 'WAITING', 'STANDARD', { assignedRoomId: 'room-1' })]}
        rooms={[{ id: 'room-1', name: 'Exam 1' }]}
        {...props}
      />
    );

    await user.selectOptions(screen.getByLabelText('Assign room'), '');
    expect(props.onAssignRoom).not.toHaveBeenCalled();
  });

  it('falls back to a generic patient label when the name is unresolved', () => {
    render(
      <CheckInBoard
        entries={[
          row('1', 'WAITING', 'STANDARD', { companionName: undefined, ownerName: undefined }),
        ]}
        {...handlers()}
      />
    );

    expect(screen.getByText('Patient')).toBeInTheDocument();
  });

  it('blocks submit and warns when the chosen patient has no linked client', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <CheckInBoard
        entries={[]}
        companions={[{ id: 'patient-9', name: 'Bruno', ownerName: 'Sarah' }]}
        {...props}
      />
    );

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    await user.selectOptions(screen.getByLabelText('Patient'), 'patient-9');
    await user.click(screen.getByRole('button', { name: 'Check in patient' }));

    expect(props.onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('no linked client');
  });

  it('warns when submitting the add form without choosing a patient', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<CheckInBoard entries={[]} companions={[]} {...props} />);

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    await user.click(screen.getByRole('button', { name: 'Check in patient' }));

    expect(props.onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a patient');
  });

  it('surfaces a form error and stays open when the add resolves false', async () => {
    const user = userEvent.setup();
    const props = handlers();
    props.onAdd.mockResolvedValue(false);
    render(
      <CheckInBoard
        entries={[]}
        companions={[{ id: 'patient-9', name: 'Bruno', clientId: 'client-9' }]}
        {...props}
      />
    );

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    await user.selectOptions(screen.getByLabelText('Patient'), 'patient-9');
    await user.click(screen.getByRole('button', { name: 'Check in patient' }));

    expect(props.onAdd).toHaveBeenCalled();
    expect(
      await screen.findByText('Could not check the patient in. Try again.')
    ).toBeInTheDocument();
  });

  it('closes the add form on the cancel button', async () => {
    const user = userEvent.setup();
    render(
      <CheckInBoard
        entries={[]}
        companions={[{ id: 'patient-9', name: 'Bruno', clientId: 'client-9' }]}
        {...handlers()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Check in patient/ }));
    expect(screen.getByText('Triage priority')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Triage priority')).not.toBeInTheDocument();
  });

  it('toggles the show-all view via the header control', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<CheckInBoard entries={[row('1', 'WAITING', 'STANDARD')]} showAll={false} {...props} />);

    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(props.onToggleShowAll).toHaveBeenCalledWith(true);
  });

  it('shows the active-only empty state by default and the all empty state when showing all', () => {
    const { rerender } = render(<CheckInBoard entries={[]} {...handlers()} />);
    expect(screen.getByText('No patients are checked in')).toBeInTheDocument();

    rerender(<CheckInBoard entries={[]} showAll {...handlers()} />);
    expect(screen.getByText('No check-ins yet')).toBeInTheDocument();
  });

  it('shows a loading skeleton instead of rows or the empty state', () => {
    render(<CheckInBoard entries={[]} loading {...handlers()} />);

    expect(screen.queryByText('No patients are checked in')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start consult' })).not.toBeInTheDocument();
  });

  it('renders read-only when no action or add handlers are supplied', () => {
    render(<CheckInBoard entries={[row('1', 'WAITING', 'STANDARD')]} />);

    expect(screen.queryByRole('button', { name: 'Start consult' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check in patient/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('computes a live wait time from arrival when waitMinutes is null', () => {
    const arrived = new Date(Date.now() - 90 * 60000).toISOString();
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD', { waitMinutes: null, arrivedAt: arrived })]}
        {...handlers()}
      />
    );

    // 90 minutes -> "1h 30m".
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('renders a whole-hour wait without trailing minutes', () => {
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD', { waitMinutes: 120 })]}
        {...handlers()}
      />
    );

    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('omits the wait time when the arrival timestamp is unparseable', () => {
    render(
      <CheckInBoard
        entries={[row('1', 'WAITING', 'STANDARD', { waitMinutes: null, arrivedAt: 'nonsense' })]}
        {...handlers()}
      />
    );

    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
  });

  it('shows the error banner when an error is passed', () => {
    render(
      <CheckInBoard entries={[row('1', 'WAITING', 'STANDARD')]} error="Boom" {...handlers()} />
    );

    expect(within(screen.getByRole('alert')).getByText('Boom')).toBeInTheDocument();
  });
});
