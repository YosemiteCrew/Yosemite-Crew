import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddTask from '@/app/features/tasks/pages/Tasks/Sections/AddTask';
import { createTask, createTaskTemplate } from '@/app/features/tasks/services/taskService';

// Local mocks (this file deliberately does NOT use the shared taskAddTaskTestMocks
// helper, because it needs a richer TaskFormFields stub that surfaces the
// audience/assignee callbacks and the resolved option lists so the per-branch
// logic in AddTask can actually be exercised).
let mockCompanions: unknown;
let mockTeams: unknown;
let mockResolveMemberName: (id?: string) => string;

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/tasks/components/TaskFormFields', () => ({
  __esModule: true,
  default: ({
    formData,
    formDataErrors,
    assigneeOptions,
    onAudienceSelect,
    onAssigneeSelect,
  }: any) => (
    <div>
      <div data-testid="errors">
        {Object.values(formDataErrors ?? {}).map((error: any) => (
          <div key={error}>{error}</div>
        ))}
      </div>
      <div data-testid="audience">{formData.audience}</div>
      <div data-testid="assignedTo">{formData.assignedTo}</div>
      <div data-testid="companionId">{formData.companionId ?? ''}</div>
      <div data-testid="assignee-options">
        {(assigneeOptions ?? []).map((option: any) => `${option.label}:${option.value}`).join('|')}
      </div>
      <button type="button" onClick={() => onAudienceSelect({ value: 'PARENT_TASK' })}>
        audience-parent
      </button>
      <button type="button" onClick={() => onAudienceSelect({ value: 'EMPLOYEE_TASK' })}>
        audience-employee
      </button>
      <button
        type="button"
        onClick={() =>
          onAssigneeSelect((assigneeOptions ?? [])[0] ?? { value: 'none', label: 'none' })
        }
      >
        assignee-first
      </button>
      <button
        type="button"
        onClick={() => onAssigneeSelect({ value: 'missing', label: 'missing' })}
      >
        assignee-missing
      </button>
    </div>
  ),
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsForPrimaryOrg: () => mockCompanions,
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => mockTeams,
}));

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: () => ({ resolveMemberName: (id?: string) => mockResolveMemberName(id) }),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  createTask: jest.fn(),
  createTaskTemplate: jest.fn(),
  getTaskLibrary: jest.fn().mockResolvedValue([]),
  getTaskTemplatesForPrimaryOrg: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/lib/date', () => ({
  applyUtcTime: (d: Date) => d,
  getUtcTimeValue: () => '00:00',
  getPreferredTimeValue: () => '00:00',
  generateTimeSlots: () => ['09:00'],
}));

const validPrefill = () =>
  ({
    audience: 'EMPLOYEE_TASK',
    assignedTo: 'team-1',
    source: 'CUSTOM',
    category: 'CUSTOM',
    name: 'Valid Task',
    description: 'Carry over details',
    dueAt: new Date('2026-03-14T10:00:00.000Z'),
    status: 'PENDING',
  }) as any;

describe('Tasks AddTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanions = [];
    mockTeams = [];
    mockResolveMemberName = () => '-';
    (createTask as jest.Mock).mockResolvedValue(undefined);
    (createTaskTemplate as jest.Mock).mockResolvedValue(undefined);
  });

  it('shows validation errors when saving empty form', () => {
    render(<AddTask showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(screen.getByText('Please select a companion or staff')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('closes the modal from the footer Cancel button', () => {
    const setShowModal = jest.fn();
    render(<AddTask showModal setShowModal={setShowModal} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(setShowModal).toHaveBeenCalledWith(false);
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

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

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

  it('applies prefill defaults for missing optional fields and calls onPrefillConsumed', async () => {
    const onPrefillConsumed = jest.fn();

    render(
      <AddTask
        showModal
        setShowModal={jest.fn()}
        onPrefillConsumed={onPrefillConsumed}
        prefill={
          {
            name: 'Bare',
            timezone: 'UTC',
            recurrence: { type: 'DAILY', isMaster: true, masterTaskId: 'm1' },
          } as any
        }
      />
    );

    await waitFor(() => expect(onPrefillConsumed).toHaveBeenCalled());
    // No prefill.audience -> falls back to the previous audience (EMPLOYEE_TASK).
    expect(screen.getByTestId('audience')).toHaveTextContent('EMPLOYEE_TASK');
    // No prefill.assignedTo -> reset to empty string.
    expect(screen.getByTestId('assignedTo')).toBeEmptyDOMElement();
  });

  it('does not render or apply prefill while the modal is closed', () => {
    const onPrefillConsumed = jest.fn();

    render(
      <AddTask
        showModal={false}
        setShowModal={jest.fn()}
        prefill={{ name: 'Closed', dueAt: new Date() } as any}
        onPrefillConsumed={onPrefillConsumed}
      />
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    expect(onPrefillConsumed).not.toHaveBeenCalled();
  });

  it('toggles audience and assignee selection for staff and pet parents', () => {
    mockCompanions = [
      { id: 'c1', parentId: 'p-resolved', name: 'CompA' },
      { id: 'c2', parentId: 'p-named', name: 'Buddy' },
      { id: 'c3', parentId: 'p-noname' },
      { id: 'c4', name: 'NoParent' },
    ];
    mockTeams = [
      { _id: 't1', practionerId: 'pr-1', name: 'Team One' },
      { _id: 't2', practionerId: 'pr-2', name: '' },
      { _id: 't3', practionerId: '', name: '' },
    ];
    mockResolveMemberName = (id?: string) => (id === 'p-resolved' ? 'Resolved Person' : '-');

    render(<AddTask showModal setShowModal={jest.fn()} />);

    // Default audience is EMPLOYEE_TASK -> staff (team) options with fallbacks.
    expect(screen.getByTestId('assignee-options')).toHaveTextContent(
      'Team One:pr-1|pr-2:pr-2|t3:t3'
    );

    fireEvent.click(screen.getByRole('button', { name: 'assignee-first' }));
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('pr-1');

    // Switch to a parent task.
    fireEvent.click(screen.getByRole('button', { name: 'audience-parent' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('PARENT_TASK');
    expect(screen.getByTestId('assignedTo')).toBeEmptyDOMElement();
    expect(screen.getByTestId('assignee-options')).toHaveTextContent(
      'Resolved Person:p-resolved|Buddy:p-named|p-noname:p-noname'
    );

    // Select a companion that resolves to a real parent id (found branch).
    fireEvent.click(screen.getByRole('button', { name: 'assignee-first' }));
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('p-resolved');
    expect(screen.getByTestId('companionId')).toHaveTextContent('c1');

    // Select an option with no matching companion (not-found branch -> no change).
    fireEvent.click(screen.getByRole('button', { name: 'assignee-missing' }));
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('p-resolved');

    // Switch back to an employee task.
    fireEvent.click(screen.getByRole('button', { name: 'audience-employee' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('EMPLOYEE_TASK');
  });

  it('handles missing companion and team collections', () => {
    mockCompanions = undefined;
    mockTeams = undefined;

    render(<AddTask showModal setShowModal={jest.fn()} />);

    expect(screen.getByTestId('assignee-options')).toBeEmptyDOMElement();
  });

  it('surfaces an error when task creation fails', async () => {
    (createTask as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    render(<AddTask showModal setShowModal={jest.fn()} prefill={validPrefill()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() =>
      expect(screen.getByText('Failed to create task. Please try again.')).toBeInTheDocument()
    );
  });

  it('shows a saving state while the request is in flight', async () => {
    let resolveCreate: (value?: unknown) => void = () => {};
    (createTask as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(<AddTask showModal setShowModal={jest.fn()} prefill={validPrefill()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument()
    );

    await act(async () => {
      resolveCreate(undefined);
    });
  });
});
