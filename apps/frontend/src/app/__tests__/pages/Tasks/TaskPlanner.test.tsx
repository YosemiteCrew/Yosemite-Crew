import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Stands in for `next/dynamic` and, unlike the page-level suite's stub, actually
 * calls each `loading` option - the skeleton every view shows before its chunk
 * arrives is only reachable through it.
 */
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options?: { loading?: () => React.ReactNode }) => {
    const source = loader.toString();
    const nameFor = () => {
      if (source.includes('Calendar/TaskCalendar')) return 'calendar';
      if (source.includes('TaskBoard')) return 'board';
      return 'table';
    };
    const Loadable = (props: Record<string, unknown>) => (
      <div data-testid={`dyn-${nameFor()}`} data-can-edit={String(props.canEditTasks)}>
        {options?.loading ? options.loading() : null}
      </div>
    );
    Loadable.displayName = 'MockDynamic';
    return Loadable;
  },
}));

import TaskPlanner from '@/app/features/tasks/pages/Tasks/TaskPlanner';

const baseProps = {
  filteredList: [],
  allTasks: [],
  canEditTasks: true,
  setActiveTask: jest.fn(),
  setViewPopup: jest.fn(),
  setChangeStatusPopup: jest.fn(),
  setChangeStatusPreferredStatus: jest.fn(),
  setReschedulePopup: jest.fn(),
  activeCalendar: 'week',
  setActiveCalendar: jest.fn(),
  currentDate: new Date('2026-01-05T00:00:00.000Z'),
  setCurrentDate: jest.fn(),
  weekStart: new Date('2026-01-05T00:00:00.000Z'),
  setWeekStart: jest.fn(),
  onAddTask: jest.fn(),
  onCreateFromCalendarSlot: jest.fn(),
  filterOptions: [{ key: 'parent_task', name: 'Pet parents' }],
  activeFilter: 'all',
  setActiveFilter: jest.fn(),
  statusOptions: [{ key: 'pending', name: 'Pending' }],
  activeStatus: 'all',
  setActiveStatus: jest.fn(),
};

describe('TaskPlanner', () => {
  it('renders the calendar grid for the calendar view', () => {
    const { container } = render(<TaskPlanner {...baseProps} activeView="calendar" />);

    expect(screen.getByTestId('dyn-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('dyn-board')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dyn-table')).not.toBeInTheDocument();
    // The pulsing placeholder is what fills the planner until the chunk lands.
    expect(container.querySelector('.animate-pulse')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the board for the board view', () => {
    render(<TaskPlanner {...baseProps} activeView="board" />);

    expect(screen.getByTestId('dyn-board')).toBeInTheDocument();
    expect(screen.queryByTestId('dyn-calendar')).not.toBeInTheDocument();
  });

  it('renders the table, inside its own overflow box, for any other view', () => {
    const { container } = render(<TaskPlanner {...baseProps} activeView="list" />);

    const table = screen.getByTestId('dyn-table');
    expect(table).toBeInTheDocument();
    expect(container.querySelector('.h-full.min-h-0.overflow-hidden')).toContainElement(table);
  });

  it('passes the edit permission through to the active view', () => {
    render(<TaskPlanner {...baseProps} canEditTasks={false} activeView="board" />);

    expect(screen.getByTestId('dyn-board')).toHaveAttribute('data-can-edit', 'false');
  });
});
