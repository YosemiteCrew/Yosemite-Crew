import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import RescheduleTask from '@/app/features/tasks/pages/Tasks/Sections/Reschedule';
import { rescheduleTask } from '@/app/features/tasks/services/taskService';
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

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('09:45')}>
      pick-time
    </button>
  ),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  rescheduleTask: jest.fn(),
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
    (rescheduleTask as jest.Mock).mockResolvedValue({});
  });

  it('blocks saving and warns for non-reschedulable statuses', async () => {
    (canRescheduleTask as jest.Mock).mockReturnValue(false);

    render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={activeTask} />);
    fireEvent.click(screen.getByText('Update'));

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
    fireEvent.click(screen.getByText('pick-time'));
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(buildDateInPreferredTimeZone).toHaveBeenCalledWith(
        new Date('2026-04-15T00:00:00Z'),
        585
      );
    });
    // A one-off task reschedules straight away, with no series scope. Only the
    // id, the new time and the timezone are sent - a scoped update applies every
    // field it receives to every occurrence.
    expect(rescheduleTask).toHaveBeenCalledWith(
      'task-1',
      new Date('2026-04-15T09:45:00Z'),
      'Asia/Kolkata',
      undefined
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('shows error notification when save fails', async () => {
    (rescheduleTask as jest.Mock).mockRejectedValue(new Error('save failed'));

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

  describe('recurring series', () => {
    const seriesTask: any = {
      ...activeTask,
      recurrence: { type: 'DAILY', isMaster: true },
    };

    it('asks which occurrences a series reschedule applies to instead of moving just one', async () => {
      render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={seriesTask} />);

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByText('Edit recurring task')).toBeInTheDocument();
      });
      // The edit is held until the user picks a scope.
      expect(rescheduleTask).not.toHaveBeenCalled();
      expect(setShowModal).not.toHaveBeenCalledWith(false);
    });

    it('applies the reschedule to the whole series when the user chooses all tasks', async () => {
      render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={seriesTask} />);

      fireEvent.click(screen.getByText('pick-date'));
      fireEvent.click(screen.getByText('pick-time'));
      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByLabelText('All tasks in the series')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText('All tasks in the series'));
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        // Crucially NOT the whole task: name, assignee, medication and reminders
        // must not be copied across the series by a reschedule.
        expect(rescheduleTask).toHaveBeenCalledWith(
          'task-1',
          new Date('2026-04-15T09:45:00Z'),
          'Asia/Kolkata',
          'ALL'
        );
      });
      expect(setShowModal).toHaveBeenCalledWith(false);
    });

    it('defaults to this task only when the user confirms without changing the scope', async () => {
      render(<RescheduleTask showModal setShowModal={setShowModal} activeTask={seriesTask} />);

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByText('Save changes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        expect(rescheduleTask).toHaveBeenCalledWith(
          'task-1',
          expect.any(Date),
          expect.any(String),
          'THIS'
        );
      });
    });
  });
});
