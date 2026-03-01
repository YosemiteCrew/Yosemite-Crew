import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskInfo from '@/app/features/tasks/pages/Tasks/Sections/TaskInfo';

const mockResolveMemberName = jest.fn((id?: string) =>
  id === 'team-1' ? 'Dr. Who' : id === 'parent-1' ? 'Parent One' : '-'
);
const mockCan = jest.fn(() => true);
const mockEditableAccordion = jest.fn();

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: (props: any) => {
    mockEditableAccordion(props);
    return (
      <div>
        <div>{props.title}</div>
        <div data-testid="assigned-by">{props.data.assignedBy}</div>
        <div data-testid="assigned-to">{props.data.assignedTo}</div>
      </div>
    );
  },
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [{ _id: 'team-1', name: 'Dr. Who', practionerId: 'team-1' }],
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsForPrimaryOrg: () => [{ id: 'comp-1', name: 'Buddy', parentId: 'parent-1' }],
}));

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: () => ({ resolveMemberName: mockResolveMemberName }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: { sub: 'me' } }),
}));

const baseTask = {
  _id: 'task-1',
  audience: 'EMPLOYEE_TASK',
  assignedBy: 'team-1',
  assignedTo: 'team-1',
  name: 'Task A',
  category: 'CUSTOM',
  dueAt: new Date().toISOString(),
  status: 'PENDING',
};

describe('TaskInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves member names for assignedBy and assignedTo', () => {
    render(<TaskInfo showModal setShowModal={jest.fn()} activeTask={baseTask as any} />);

    expect(screen.getByText('Task details')).toBeInTheDocument();
    expect(screen.getByTestId('assigned-by')).toHaveTextContent('Dr. Who');
    expect(screen.getByTestId('assigned-to')).toHaveTextContent('Dr. Who');
  });

  it('shows no edit icon when current user is neither assigner nor assignee', () => {
    render(
      <TaskInfo
        showModal
        setShowModal={jest.fn()}
        activeTask={{ ...baseTask, assignedBy: 'team-1', assignedTo: 'other-user' } as any}
      />
    );

    const props = mockEditableAccordion.mock.calls[0][0];
    expect(props.showEditIcon).toBe(false);
  });

  it('allows only status edit when current user is assignee', () => {
    render(
      <TaskInfo
        showModal
        setShowModal={jest.fn()}
        activeTask={{ ...baseTask, assignedBy: 'team-1', assignedTo: 'me' } as any}
      />
    );

    const props = mockEditableAccordion.mock.calls[0][0];
    const statusField = props.fields.find((f: any) => f.key === 'status');
    const nameField = props.fields.find((f: any) => f.key === 'name');
    expect(props.showEditIcon).toBe(true);
    expect(statusField.editable).toBe(true);
    expect(nameField.editable).toBe(false);
  });

  it('locks status edit when current user is assigner', () => {
    render(
      <TaskInfo
        showModal
        setShowModal={jest.fn()}
        activeTask={{ ...baseTask, assignedBy: 'me', assignedTo: 'team-1' } as any}
      />
    );

    const props = mockEditableAccordion.mock.calls[0][0];
    const statusField = props.fields.find((f: any) => f.key === 'status');
    const nameField = props.fields.find((f: any) => f.key === 'name');
    expect(props.showEditIcon).toBe(true);
    expect(statusField.editable).toBe(false);
    expect(nameField.editable).toBe(true);
  });
});
