import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '@/app/ui/cards/TaskCard';
import { Task } from '@/app/features/tasks/types/task';

// --- Mocks ---

jest.mock('@/app/ui/tables/Tasks', () => ({
  getStatusStyle: jest.fn(() => ({ color: 'green' })),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getFormattedDate: jest.fn((date: any) => `Formatted ${String(date)}`),
}));

jest.mock('@/app/lib/tasks', () => ({
  canRescheduleTask: jest.fn(() => true),
  canShowTaskStatusChangeAction: jest.fn(() => true),
  getTaskQuickDetails: jest.fn((task: any) => [
    { label: 'Category', value: task.category || '-' },
    { label: 'Description', value: task.description || '-' },
    { label: 'Additional notes', value: task.additionalNotes || '-' },
  ]),
}));

jest.mock('react-icons/io5', () => ({
  IoEyeOutline: () => <span>view-icon</span>,
}));

jest.mock('react-icons/md', () => ({
  MdOutlineAutorenew: () => <span>status-icon</span>,
}));

jest.mock('react-icons/io', () => ({
  IoIosCalendar: () => <span>calendar-icon</span>,
}));

import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';

const mockTask: Task = {
  _id: 'task-1',
  name: 'Order supplies',
  description: 'Buy gloves and masks',
  category: 'Admin',
  assignedBy: 'Alice',
  assignedTo: 'Bob',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  dueAt: new Date('2025-01-10T00:00:00.000Z'),
  status: 'IN_PROGRESS',
} as any;

describe('TaskCard Component', () => {
  const mockHandleView = jest.fn();
  const mockHandleChangeStatus = jest.fn();
  const mockHandleReschedule = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task details correctly', () => {
    render(
      <TaskCard
        item={mockTask}
        handleViewTask={mockHandleView}
        handleChangeStatusTask={mockHandleChangeStatus}
        handleRescheduleTask={mockHandleReschedule}
        canEditTasks
      />
    );

    // Header
    expect(screen.getByText('Order supplies')).toBeInTheDocument();

    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('Buy gloves and masks')).toBeInTheDocument();

    // Category
    expect(screen.getByText('Category:')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    // From / To
    expect(screen.getByText('From:')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();

    expect(screen.getByText('To:')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    expect(getFormattedDate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Formatted/)).toBeInTheDocument();

    expect(screen.getByText('In_progress')).toBeInTheDocument();

    expect(screen.getByText('view-icon')).toBeInTheDocument();
    expect(screen.getByText('status-icon')).toBeInTheDocument();
    expect(screen.getByText('calendar-icon')).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const incompleteTask: Task = {
      ...mockTask,
      description: undefined,
      assignedBy: undefined,
    } as any;

    render(
      <TaskCard
        item={incompleteTask}
        handleViewTask={mockHandleView}
        handleChangeStatusTask={mockHandleChangeStatus}
        handleRescheduleTask={mockHandleReschedule}
        canEditTasks
      />
    );

    // Still renders labels and doesn't crash
    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('Category:')).toBeInTheDocument();
    expect(screen.getByText('From:')).toBeInTheDocument();
    expect(screen.getByText('To:')).toBeInTheDocument();
    expect(screen.getByText('Due date:')).toBeInTheDocument();
    expect(screen.getByText('In_progress')).toBeInTheDocument();
  });

  it('calls handleViewTask with the task when clicking View', () => {
    render(
      <TaskCard
        item={mockTask}
        handleViewTask={mockHandleView}
        handleChangeStatusTask={mockHandleChangeStatus}
        handleRescheduleTask={mockHandleReschedule}
        canEditTasks
      />
    );

    fireEvent.click(screen.getByText('view-icon'));

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(expect.objectContaining({ _id: 'task-1' }));
  });
});
