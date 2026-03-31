import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import RescheduleTask from '@/app/features/tasks/pages/Tasks/Sections/Reschedule';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import { getPreferredTimeValue } from '@/app/lib/date';
import { canRescheduleTask } from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date('2026-04-15T00:00:00Z'))}>
      pick-date
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value || ''} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  updateTask: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: jest.fn(),
  getPreferredTimeZone: jest.fn(),
}));

jest.mock('@/app/lib/date', () => ({
  getPreferredTimeValue: jest.fn(),
}));

jest.mock('@/app/lib/tasks', () => ({
  canRescheduleTask: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

describe('Task Reschedule section', () => {
  const notifyMock = jest.fn();
  const setShowModal = jest.fn();
  const dueAt = new Date('2026-04-10T08:30:00Z');
  const activeTask: any = {
    _id: 'task-1',
    name: 'Task one',
    status: 'PENDING',
    dueAt,
    timezone: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (getPreferredTimeValue as jest.Mock).mockReturnValue('08:30');
    (canRescheduleTask as jest.Mock).mockReturnValue(true);
    (buildDateInPreferredTimeZone as jest.Mock).mockReturnValue(new Date('2026-04-15T09:45:00Z'));
    (getPreferredTimeZone as jest.Mock).mockReturnValue('Asia/Kolkata');
    (updateTask as jest.Mock).mockResolvedValue({});
  });

  it('blocks modal and warns for non-reschedulable statuses', async () => {
    (canRescheduleTask as jest.Mock).mockReturnValue(false);

    render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={activeTask} />);

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Reschedule blocked' })
      );
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('updates task dueAt and closes modal on success', async () => {
    render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={activeTask} />);

    fireEvent.click(screen.getByText('pick-date'));
    fireEvent.change(screen.getByLabelText('Due time'), { target: { value: '09:45' } });
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(buildDateInPreferredTimeZone).toHaveBeenCalledWith(
        new Date('2026-04-15T00:00:00Z'),
        585
      );
    });
    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: new Date('2026-04-15T09:45:00Z'), timezone: 'Asia/Kolkata' })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('shows error notification when save fails', async () => {
    (updateTask as jest.Mock).mockRejectedValue(new Error('save failed'));

    render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={activeTask} />);
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to reschedule' })
      );
    });
  });

  it('cancels and closes modal', () => {
    render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={activeTask} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
