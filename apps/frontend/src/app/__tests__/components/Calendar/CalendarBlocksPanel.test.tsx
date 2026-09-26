import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarBlocksPanel from '@/app/features/appointments/components/Calendar/CalendarBlocksPanel';

const mockModalProps = jest.fn();
jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({
    children,
    showModal,
    setShowModal,
  }: {
    children: React.ReactNode;
    showModal: boolean;
    setShowModal: (show: boolean) => void;
  }) => {
    mockModalProps({ showModal, setShowModal });
    return showModal ? (
      <div role="dialog">
        <button type="button" onClick={() => setShowModal(false)}>
          Dismiss modal
        </button>
        {children}
      </div>
    ) : null;
  },
}));

const block = {
  id: 'block-1',
  organisationId: 'org-1',
  targetType: 'STAFF' as const,
  targetId: 'staff-1',
  startAt: '2027-01-06T11:00:00.000Z',
  endAt: '2027-01-06T12:00:00.000Z',
  reason: 'Lunch',
  createdBy: 'user-1',
  createdAt: '2027-01-06T10:00:00.000Z',
  updatedAt: '2027-01-06T10:00:00.000Z',
};
const teams = [
  {
    _id: 'staff-1',
    practionerId: 'staff-1',
    organisationId: 'org-1',
    name: 'Dr Rivera',
    role: 'Veterinarian',
    speciality: [],
    status: 'Available' as const,
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

const renderPanel = (overrides: Partial<React.ComponentProps<typeof CalendarBlocksPanel>> = {}) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const rendered = render(
    <CalendarBlocksPanel
      blocks={[block]}
      teams={teams}
      rooms={[]}
      canEdit
      onSave={onSave}
      onDelete={onDelete}
      {...overrides}
    />
  );
  return { onSave, onDelete, ...rendered };
};

describe('CalendarBlocksPanel', () => {
  it('shows the reason and resource and opens an editable block', () => {
    mockModalProps.mockClear();
    renderPanel();
    expect(screen.getByText('Lunch')).toBeVisible();
    expect(screen.getByText(/Dr Rivera/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Edit calendar block');
    expect(screen.getByLabelText('Reason')).toHaveValue('Lunch');
    act(() => mockModalProps.mock.lastCall?.[0].setShowModal(false));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a room name and falls back when a resource is no longer listed', () => {
    const room = {
      id: 'room-1',
      name: 'Imaging room',
      organisationId: 'org-1',
      code: 'I1',
      type: 'IMAGING' as const,
    };
    renderPanel({
      blocks: [
        { ...block, targetType: 'ROOM', targetId: 'room-1', reason: 'Cleaning' },
        {
          ...block,
          id: 'orphan-room',
          targetType: 'ROOM',
          targetId: 'removed-room',
          reason: 'Closure',
        },
        { ...block, id: 'orphan', targetId: 'removed-staff', reason: 'Unavailable' },
      ],
      teams: [],
      rooms: [room],
    });
    expect(screen.getByText(/Imaging room/)).toBeVisible();
    expect(screen.getByText(/Room ·/)).toBeVisible();
    expect(screen.getByText(/Staff member/)).toBeVisible();
  });

  it('uses the team identifier and role when display fields are missing', () => {
    const fallbackTeam = { ...teams[0], _id: 'staff-fallback', practionerId: '', name: '' };
    const { unmount } = renderPanel({ blocks: [], teams: [fallbackTeam] });
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    expect(screen.getByRole('option', { name: 'Veterinarian' })).toHaveValue('staff-fallback');
    unmount();
    renderPanel({ blocks: [{ ...block, targetId: 'staff-fallback' }], teams: [fallbackTeam] });
    expect(screen.getByText(/Staff member/)).toBeVisible();
  });

  it('creates a staff block with validated times and reports save failures', async () => {
    const { onSave } = renderPanel({ blocks: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    fireEvent.change(screen.getByLabelText('Staff member'), { target: { value: 'staff-1' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-01-06T11:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-06T12:00' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Training' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(null, expect.objectContaining({ reason: 'Training' }))
    );

    onSave.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    fireEvent.change(screen.getByLabelText('Staff member'), { target: { value: 'staff-1' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-01-06T11:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-06T12:00' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Training' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this block.');
  });

  it('rejects missing targets and reversed times, and supports room blocks', () => {
    renderPanel({
      blocks: [],
      rooms: [
        { id: 'room-1', name: 'Exam room', organisationId: 'org-1', code: 'E1', type: 'EXAM_ROOM' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a staff member or room.');
    fireEvent.change(screen.getByLabelText('Applies to'), { target: { value: 'ROOM' } });
    fireEvent.change(screen.getByLabelText('Room'), { target: { value: 'room-1' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-01-06T12:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-06T11:00' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Closure' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent('The end must be after the start.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss modal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels a block and omits write controls in read-only mode', () => {
    const { onDelete, unmount } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Lunch' }));
    expect(onDelete).toHaveBeenCalledWith('block-1');
    fireEvent.click(screen.getByRole('button', { name: 'Block time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    renderPanel({ canEdit: false, teams: [] });
    expect(screen.queryByRole('button', { name: 'Block time' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Lunch' })).not.toBeInTheDocument();
  });

  it('reports when cancelling a block fails', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('offline'));
    renderPanel({ onDelete });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Lunch' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not cancel this block. Please try again.'
    );
    expect(screen.getByText('Lunch')).toBeVisible();
  });
});
