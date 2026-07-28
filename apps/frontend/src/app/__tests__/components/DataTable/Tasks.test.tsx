import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Tasks from '@/app/ui/tables/Tasks';
import { getTaskStatusTone } from '@/app/ui/tables/tableUtils';

const useTeamMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any) => (
        <div key={item.id}>
          {columns.map((col: any) => (
            <div key={col.key || col.label}>{col.render ? col.render(item) : item[col.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/cards/TaskCard', () => ({
  __esModule: true,
  default: ({ item }: any) => <div data-testid="task-card">{item.name}</div>,
}));

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/io',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock('@/app/lib/tasks', () => ({
  canRescheduleTask: jest.fn(() => true),
  canShowTaskStatusChangeAction: jest.fn(() => true),
  getPreferredNextTaskStatus: jest.fn(() => 'IN_PROGRESS'),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getFormattedDate: () => 'Jan 2, 2024',
}));

jest.mock('@/app/lib/validators', () => ({
  toTitleCase: (value: string) => value.toUpperCase(),
}));

describe('Tasks table', () => {
  beforeEach(() => {
    useTeamMock.mockReturnValue([
      { _id: 'u1', name: 'Alex' },
      { _id: 'u2', name: 'Morgan' },
    ]);
  });

  it('renders table and handles view action', () => {
    const setActiveTask = jest.fn();
    const setViewPopup = jest.fn();
    const setChangeStatusPopup = jest.fn();
    const setReschedulePopup = jest.fn();
    const task: any = {
      id: 't1',
      name: 'Follow up',
      description: 'Call parent',
      category: 'pending',
      assignedBy: 'u1',
      assignedTo: 'u2',
      dueAt: new Date(),
      status: 'pending',
    };

    render(
      <Tasks
        filteredList={[task]}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setReschedulePopup={setReschedulePopup}
      />
    );

    expect(screen.getByTitle('PENDING')).toHaveStyle({
      backgroundColor: 'var(--color-pill-neutral-bg)',
    });

    fireEvent.click(screen.getByTestId('IoEyeOutline'));
    expect(setActiveTask).toHaveBeenCalledWith(task);
    expect(setViewPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('IoSyncOutline'));
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('IoIosCalendar'));
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('shows empty state for mobile list', () => {
    render(<Tasks filteredList={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('maps dashboard task statuses to inventory-style pill tones', () => {
    expect(getTaskStatusTone('PENDING')).toBe('neutral');
    expect(getTaskStatusTone('IN_PROGRESS')).toBe('progress');
    expect(getTaskStatusTone('COMPLETED')).toBe('success');
    expect(getTaskStatusTone('CANCELLED')).toBe('warning');
  });
});
