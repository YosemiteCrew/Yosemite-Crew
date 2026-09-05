import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Tasks from '@/app/ui/tables/Tasks';
import { getTaskStatusTone } from '@/app/ui/tables/tableUtils';

const useTeamMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

/* The stub renders the EMPTY branch as well as rows, and derives its copy the
   way the real table does. It used to drop the empty state entirely, which is
   how the desktop table and the phone card list beside it were allowed to
   disagree unseen: the table had no `itemNoun` and fell back to "No records
   yet" while the cards said "No tasks yet", and no test could see it.
   Only the copy is mirrored, not the card, so this file does not need the
   icon mocks NoDataMessage would pull in. */
jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => {
  const { emptyStateCopy } = jest.requireActual('@/app/ui/tables/tableUtils');
  return {
    __esModule: true,
    default: ({ data, columns, itemNoun }: any) => (
      <div data-testid="table">
        {data.length === 0 ? (
          <div>{emptyStateCopy(itemNoun ?? 'records').title}</div>
        ) : (
          data.map((item: any) => (
            <div key={item.id}>
              {columns.map((col: any) => (
                <div key={col.key || col.label}>
                  {col.render ? col.render(item) : item[col.key]}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    ),
  };
});

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

    const statusPill = screen.getByTitle('PENDING');
    expect(statusPill).toHaveClass('yc-status-pill', 'text-[10px]', 'leading-[normal]');
    expect(statusPill).toHaveStyle({
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
    /* TWO nodes, and that is the point: the desktop table and the phone card
       list are both in the jsdom DOM, and both must say the same thing. The
       table had no `itemNoun`, so it fell back to "No records yet" while the
       card list beside it said "No tasks yet" - the same split-on-window-width
       defect this sweep set out to remove, left half-fixed in this very file. */
    expect(screen.getAllByText('No tasks yet')).toHaveLength(2);
    expect(screen.queryByText('No records yet')).not.toBeInTheDocument();
  });

  it('maps dashboard task statuses to inventory-style pill tones', () => {
    expect(getTaskStatusTone('PENDING')).toBe('neutral');
    expect(getTaskStatusTone('IN_PROGRESS')).toBe('progress');
    expect(getTaskStatusTone('COMPLETED')).toBe('success');
    expect(getTaskStatusTone('CANCELLED')).toBe('warning');
  });

  it('clamps a long description to two lines and keeps the full text on hover', () => {
    // Free text in a 200px column: without the clamp one verbose task set the
    // height of every row on the page.
    const description =
      'Call the parent to confirm the pre-anaesthetic fasting window, then reconfirm ' +
      'the drop-off time and remind them to bring the previous practice records.';
    const task: any = {
      id: 't-long',
      name: 'Follow up',
      description,
      category: 'pending',
      assignedBy: 'u1',
      assignedTo: 'u2',
      dueAt: new Date(),
      status: 'pending',
    };

    render(
      <Tasks
        filteredList={[task]}
        setActiveTask={jest.fn()}
        setViewPopup={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        setReschedulePopup={jest.fn()}
      />
    );

    const cell = screen.getAllByTitle(description)[0];
    expect(cell).toHaveClass('cell-clamp-2');
    expect(cell).toHaveTextContent(description);
  });

  it('leaves a short description unclamped of any tooltip noise', () => {
    const task: any = {
      id: 't-short',
      name: 'Follow up',
      description: '',
      category: 'pending',
      assignedBy: 'u1',
      assignedTo: 'u2',
      dueAt: new Date(),
      status: 'pending',
    };

    render(
      <Tasks
        filteredList={[task]}
        setActiveTask={jest.fn()}
        setViewPopup={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        setReschedulePopup={jest.fn()}
      />
    );

    // An empty description must not advertise an empty tooltip.
    expect(document.querySelector('.cell-clamp-2')).not.toHaveAttribute('title');
  });
});
