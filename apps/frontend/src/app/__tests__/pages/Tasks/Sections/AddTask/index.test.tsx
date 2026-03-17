import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/app/__tests__/testUtils/taskAddTaskTestMocks';
import AddTask from '@/app/features/tasks/pages/Tasks/Sections/AddTask';
import { createTask } from '@/app/features/tasks/services/taskService';

describe('Tasks AddTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors when saving empty form', () => {
    render(<AddTask showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Please select a companion or staff')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('creates only after save when opened with reused task prefill', async () => {
    const setShowModal = jest.fn();
    (createTask as jest.Mock).mockResolvedValue(undefined);

    render(
      <AddTask
        showModal
        setShowModal={setShowModal}
        prefill={
          {
            _id: 'old-task',
            audience: 'EMPLOYEE_TASK',
            assignedTo: 'team-1',
            source: 'CUSTOM',
            category: 'CUSTOM',
            name: 'Reused Task',
            description: 'Carry over details',
            dueAt: new Date('2026-03-14T10:00:00.000Z'),
            status: 'COMPLETED',
          } as any
        }
      />
    );

    expect(createTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: '',
          name: 'Reused Task',
          description: 'Carry over details',
          assignedTo: 'team-1',
          status: 'PENDING',
        })
      );
    });
  });
});
