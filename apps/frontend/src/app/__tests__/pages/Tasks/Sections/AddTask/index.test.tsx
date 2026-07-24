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
  default: ({ showModal, children, variant, size }: any) =>
    showModal ? (
      <div data-testid="modal" data-variant={variant} data-size={size}>
        {children}
      </div>
    ) : null,
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

const serialize = (options: any[]) =>
  (options ?? []).map((option: any) => `${option.label}:${option.value}`).join('|');

jest.mock('@/app/features/tasks/components/TaskFormFields', () => ({
  __esModule: true,
  default: ({
    formData,
    formDataErrors,
    teamOptions,
    parentOptions,
    onSelectTeam,
    onSelectParent,
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
      <div data-testid="team-options">{serialize(teamOptions)}</div>
      <div data-testid="parent-options">{serialize(parentOptions)}</div>
      <button
        type="button"
        onClick={() => onSelectTeam?.((teamOptions ?? [])[0] ?? { value: 'none', label: 'none' })}
      >
        select-team-first
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectParent?.((parentOptions ?? [])[0] ?? { value: 'none', label: 'none' })
        }
      >
        select-parent-first
      </button>
      <button
        type="button"
        onClick={() => onSelectParent?.({ value: 'missing', label: 'missing' })}
      >
        select-parent-missing
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

  it('opens the New task form as a centered medium dialog', () => {
    render(<AddTask showModal setShowModal={jest.fn()} />);

    const modal = screen.getByTestId('modal');
    expect(modal).toHaveAttribute('data-variant', 'centered');
    expect(modal).toHaveAttribute('data-size', 'md');
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

  it('applies prefill defaults for missing optional fields', () => {
    render(
      <AddTask
        showModal
        setShowModal={jest.fn()}
        prefill={
          {
            name: 'Bare',
            timezone: 'UTC',
            recurrence: { type: 'DAILY', isMaster: true, masterTaskId: 'm1' },
          } as any
        }
      />
    );

    // No prefill.audience -> falls back to the previous audience (EMPLOYEE_TASK).
    expect(screen.getByTestId('audience')).toHaveTextContent('EMPLOYEE_TASK');
    // No prefill.assignedTo -> reset to empty string.
    expect(screen.getByTestId('assignedTo')).toBeEmptyDOMElement();
  });

  it('does not render or apply prefill while the modal is closed', () => {
    render(
      <AddTask
        showModal={false}
        setShowModal={jest.fn()}
        prefill={{ name: 'Closed', dueAt: new Date() } as any}
      />
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
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

    // The chip row is fed BOTH lists at once: team members and pet-parent chips.
    expect(screen.getByTestId('team-options')).toHaveTextContent('Team One:pr-1|pr-2:pr-2|t3:t3');
    expect(screen.getByTestId('parent-options')).toHaveTextContent(
      'Resolved Person:p-resolved|Buddy:p-named|p-noname:p-noname'
    );

    // Picking a team chip assigns the employee task to that member.
    fireEvent.click(screen.getByRole('button', { name: 'select-team-first' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('EMPLOYEE_TASK');
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('pr-1');
    expect(screen.getByTestId('companionId')).toBeEmptyDOMElement();

    // Picking a pet-parent chip flips to a parent task, sets the parent + companion.
    fireEvent.click(screen.getByRole('button', { name: 'select-parent-first' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('PARENT_TASK');
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('p-resolved');
    expect(screen.getByTestId('companionId')).toHaveTextContent('c1');

    // A parent option with no matching companion still assigns, without a companion id.
    fireEvent.click(screen.getByRole('button', { name: 'select-parent-missing' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('PARENT_TASK');
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('missing');
    expect(screen.getByTestId('companionId')).toBeEmptyDOMElement();

    // Re-picking a team chip flips back to an employee task and clears the companion.
    fireEvent.click(screen.getByRole('button', { name: 'select-team-first' }));
    expect(screen.getByTestId('audience')).toHaveTextContent('EMPLOYEE_TASK');
    expect(screen.getByTestId('assignedTo')).toHaveTextContent('pr-1');
    expect(screen.getByTestId('companionId')).toBeEmptyDOMElement();
  });

  it('handles missing companion and team collections', () => {
    mockCompanions = undefined;
    mockTeams = undefined;

    render(<AddTask showModal setShowModal={jest.fn()} />);

    expect(screen.getByTestId('team-options')).toBeEmptyDOMElement();
    expect(screen.getByTestId('parent-options')).toBeEmptyDOMElement();
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
