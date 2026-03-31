import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChangeTaskStatus from '@/app/features/tasks/pages/Tasks/Sections/ChangeStatus';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';

const modalSpy = jest.fn();

jest.mock('@/app/features/tasks/services/taskService', () => ({
  changeTaskStatus: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal/ChangeStatusModal', () => ({
  __esModule: true,
  default: (props: any) => {
    modalSpy(props);
    return <div data-testid="change-status-modal" />;
  },
}));

describe('Tasks ChangeStatus wrapper', () => {
  const setShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes normalized status options and preferred status to modal', () => {
    render(
      <ChangeTaskStatus
        showModal
        setShowModal={setShowModal}
        activeTask={{ _id: 'task-1', status: 'PENDING', dueAt: new Date() } as any}
        preferredStatus="IN_PROGRESS"
      />
    );

    const props = modalSpy.mock.calls[0][0];
    expect(props.currentStatus).toBe('PENDING');
    expect(props.preferredStatus).toBe('IN_PROGRESS');
    expect(props.statusOptions.map((option: any) => option.value)).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ]);
  });

  it('saves updated task status through service', async () => {
    (changeTaskStatus as jest.Mock).mockResolvedValue({});

    render(
      <ChangeTaskStatus
        showModal
        setShowModal={setShowModal}
        activeTask={{ _id: 'task-2', status: 'IN_PROGRESS', dueAt: new Date() } as any}
      />
    );

    const props = modalSpy.mock.calls[0][0];
    await props.onSave('COMPLETED');

    expect(changeTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'task-2', status: 'COMPLETED' })
    );
  });
});
