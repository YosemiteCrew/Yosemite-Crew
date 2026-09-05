import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CheckInBoardPanel from '@/app/features/appointments/components/CheckInBoard/CheckInBoardPanel';

const fetchCheckIns = jest.fn();
const createCheckIn = jest.fn();
const markCheckInSeen = jest.fn();
const completeCheckIn = jest.fn();
const cancelCheckIn = jest.fn();
const markCheckInNoShow = jest.fn();
const assignCheckInRoom = jest.fn();

jest.mock('@/app/features/appointments/services/patientCheckInService', () => ({
  __esModule: true,
  fetchCheckIns: (...a: unknown[]) => fetchCheckIns(...a),
  createCheckIn: (...a: unknown[]) => createCheckIn(...a),
  markCheckInSeen: (...a: unknown[]) => markCheckInSeen(...a),
  completeCheckIn: (...a: unknown[]) => completeCheckIn(...a),
  cancelCheckIn: (...a: unknown[]) => cancelCheckIn(...a),
  markCheckInNoShow: (...a: unknown[]) => markCheckInNoShow(...a),
  assignCheckInRoom: (...a: unknown[]) => assignCheckInRoom(...a),
  // Pure predicate the hook and board share; keep the real behaviour so the
  // active-only filtering under test is the production one.
  isActiveCheckInStatus: (status: string) => status === 'WAITING' || status === 'IN_CONSULTATION',
}));

let primaryOrgId: string | null = 'org-1';
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (sel: (s: { primaryOrgId: string | null }) => unknown) => sel({ primaryOrgId }),
}));

let canEdit = true;
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => canEdit }),
}));

const RESOLVED_COMPANION = {
  companion: { id: 'patient-1', name: 'Buddy' },
  parent: { id: 'client-1', firstName: 'Sam', lastName: 'Owner' },
};
let companionsParents: Array<{
  companion: { id: string; name: string };
  parent: { id: string; firstName: string; lastName: string };
}> = [RESOLVED_COMPANION];
jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
  useCompanionsParentsForPrimaryOrg: () => companionsParents,
}));

let rooms = [{ id: 'room-1', name: 'Exam 1' }];
jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: () => rooms,
}));

// Presentational double: exposes the container's wiring as buttons + text.
jest.mock('@/app/features/appointments/components/CheckInBoard/CheckInBoard', () => ({
  __esModule: true,
  default: ({
    entries,
    companions,
    rooms: roomOptions,
    loading,
    error,
    showAll,
    onToggleShowAll,
    onSeen,
    onComplete,
    onCancel,
    onNoShow,
    onAssignRoom,
    onAdd,
  }: any) => (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="show-all">{String(showAll)}</span>
      <span data-testid="companions">{companions.length}</span>
      <span data-testid="rooms">{roomOptions.length}</span>
      {entries.map((e: any) => (
        <div key={e.id} data-testid="entry">
          {e.companionName}/{e.ownerName ?? 'none'}/{e.status}/{e.roomName ?? 'no-room'}
        </div>
      ))}
      <span data-testid="has-actions">
        {String(Boolean(onSeen && onComplete && onCancel && onNoShow && onAssignRoom && onAdd))}
      </span>
      <button onClick={() => onToggleShowAll(true)}>show all</button>
      {onSeen ? <button onClick={() => onSeen('ci-1')}>seen</button> : null}
      {onComplete ? <button onClick={() => onComplete('ci-1')}>complete</button> : null}
      {onCancel ? <button onClick={() => onCancel('ci-1')}>cancel</button> : null}
      {onNoShow ? <button onClick={() => onNoShow('ci-1')}>no-show</button> : null}
      {onAssignRoom ? <button onClick={() => onAssignRoom('ci-1', 'room-1')}>assign</button> : null}
      {onAdd ? (
        <button
          onClick={() => onAdd({ patientId: 'patient-1', clientId: 'client-1', arrivedAt: 'now' })}
        >
          add
        </button>
      ) : null}
    </div>
  ),
}));

const waitingEntry = {
  id: 'ci-1',
  patientId: 'patient-1',
  status: 'WAITING',
  assignedRoomId: 'room-1',
};
const completedEntry = {
  id: 'ci-2',
  patientId: 'patient-1',
  status: 'COMPLETED',
  assignedRoomId: null,
};

describe('CheckInBoardPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    canEdit = true;
    rooms = [{ id: 'room-1', name: 'Exam 1' }];
    companionsParents = [RESOLVED_COMPANION];
    fetchCheckIns.mockResolvedValue([waitingEntry, completedEntry]);
    markCheckInSeen.mockResolvedValue(waitingEntry);
    completeCheckIn.mockResolvedValue(waitingEntry);
    cancelCheckIn.mockResolvedValue(waitingEntry);
    markCheckInNoShow.mockResolvedValue(waitingEntry);
    assignCheckInRoom.mockResolvedValue(waitingEntry);
    createCheckIn.mockResolvedValue(waitingEntry);
  });

  it('loads active check-ins and resolves companion, owner and room names', async () => {
    render(<CheckInBoardPanel />);
    await waitFor(() => expect(fetchCheckIns).toHaveBeenCalledWith('org-1'));
    // Only the active (WAITING) entry is visible by default; the resolved names attach.
    expect(await screen.findByTestId('entry')).toHaveTextContent('Buddy/Sam Owner/WAITING/Exam 1');
    expect(screen.getAllByTestId('entry')).toHaveLength(1);
    expect(screen.getByTestId('has-actions')).toHaveTextContent('true');
    expect(screen.getByTestId('companions')).toHaveTextContent('1');
    expect(screen.getByTestId('rooms')).toHaveTextContent('1');
  });

  it('reveals terminal statuses when show-all is toggled on', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('show all');
    fireEvent.click(screen.getByText('show all'));
    await waitFor(() => expect(screen.getAllByTestId('entry')).toHaveLength(2));
    expect(screen.getByTestId('show-all')).toHaveTextContent('true');
  });

  it('withholds edit actions without permission but keeps the show-all toggle', async () => {
    canEdit = false;
    render(<CheckInBoardPanel />);
    await waitFor(() => expect(fetchCheckIns).toHaveBeenCalled());
    expect(screen.getByTestId('has-actions')).toHaveTextContent('false');
    expect(screen.getByText('show all')).toBeInTheDocument();
  });

  it('runs the seen transition then refetches', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('seen');
    fireEvent.click(screen.getByText('seen'));
    await waitFor(() => expect(markCheckInSeen).toHaveBeenCalledWith('org-1', 'ci-1'));
    expect(fetchCheckIns).toHaveBeenCalledTimes(2);
  });

  it('completes an in-consultation check-in then refetches', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('complete');
    fireEvent.click(screen.getByText('complete'));
    await waitFor(() => expect(completeCheckIn).toHaveBeenCalledWith('org-1', 'ci-1'));
    expect(fetchCheckIns).toHaveBeenCalledTimes(2);
  });

  it('marks a no-show then refetches', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('no-show');
    fireEvent.click(screen.getByText('no-show'));
    await waitFor(() => expect(markCheckInNoShow).toHaveBeenCalledWith('org-1', 'ci-1'));
    expect(fetchCheckIns).toHaveBeenCalledTimes(2);
  });

  it('assigns a room then refetches', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('assign');
    fireEvent.click(screen.getByText('assign'));
    await waitFor(() => expect(assignCheckInRoom).toHaveBeenCalledWith('org-1', 'ci-1', 'room-1'));
    expect(fetchCheckIns).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error when an action fails', async () => {
    cancelCheckIn.mockRejectedValueOnce(new Error('x'));
    render(<CheckInBoardPanel />);
    await screen.findByText('cancel');
    fireEvent.click(screen.getByText('cancel'));
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('could not be completed')
    );
  });

  it('creates a check-in and refetches', async () => {
    render(<CheckInBoardPanel />);
    await screen.findByText('add');
    fireEvent.click(screen.getByText('add'));
    await waitFor(() =>
      expect(createCheckIn).toHaveBeenCalledWith('org-1', {
        patientId: 'patient-1',
        clientId: 'client-1',
        arrivedAt: 'now',
      })
    );
    await waitFor(() => expect(fetchCheckIns).toHaveBeenCalledTimes(2));
  });

  it('does not refetch when creating a check-in fails', async () => {
    createCheckIn.mockRejectedValueOnce(new Error('x'));
    render(<CheckInBoardPanel />);
    await screen.findByText('add');
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(createCheckIn).toHaveBeenCalled());
    expect(fetchCheckIns).toHaveBeenCalledTimes(1);
  });

  it('shows a load error when the fetch throws', async () => {
    fetchCheckIns.mockReset().mockRejectedValue(new Error('down'));
    render(<CheckInBoardPanel />);
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Unable to load the check-in board')
    );
  });

  it('renders nothing to load without a primary org', async () => {
    primaryOrgId = null;
    render(<CheckInBoardPanel />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(fetchCheckIns).not.toHaveBeenCalled();
  });

  it('does not fire a transition or a create when there is no primary org', async () => {
    primaryOrgId = null;
    render(<CheckInBoardPanel />);
    await screen.findByText('seen');
    fireEvent.click(screen.getByText('seen'));
    fireEvent.click(screen.getByText('add'));
    await Promise.resolve();
    expect(markCheckInSeen).not.toHaveBeenCalled();
    expect(createCheckIn).not.toHaveBeenCalled();
    expect(fetchCheckIns).not.toHaveBeenCalled();
  });

  it('leaves owner and client ids undefined when the parent has no name or id', async () => {
    companionsParents = [
      {
        companion: { id: 'patient-1', name: 'Buddy' },
        parent: { id: '', firstName: '', lastName: '' },
      },
    ];
    render(<CheckInBoardPanel />);
    await waitFor(() => expect(fetchCheckIns).toHaveBeenCalled());
    // The resolved entry keeps its patient name but no owner name to attach.
    expect(await screen.findByTestId('entry')).toHaveTextContent('Buddy/none/WAITING/Exam 1');
    expect(screen.getByTestId('companions')).toHaveTextContent('1');
  });
});
