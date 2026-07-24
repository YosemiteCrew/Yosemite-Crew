import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Task } from '@/app/features/tasks/types/task';

/* ────────────────────────────── icon + primitive mocks ───────────────────────────── */

jest.mock('react-icons/io5', () => ({
  IoAddOutline: () => <span data-testid="ic-add" />,
  IoArrowBackOutline: () => <span data-testid="ic-back" />,
  IoEyeOffOutline: () => <span data-testid="ic-eyeoff" />,
  IoEyeOutline: () => <span data-testid="ic-eye" />,
  IoPencilOutline: () => <span data-testid="ic-pencil" />,
}));

jest.mock('@/app/ui/primitives/TabToggle/TabToggle', () => ({
  __esModule: true,
  default: ({ tabs, activeKey, onChange, panelId }: any) => (
    <div data-testid="tab-toggle">
      {tabs.map((t: any) => (
        <button
          key={t.key}
          type="button"
          data-active={String(t.key === activeKey)}
          data-panel={panelId(t.key)}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption }: any) => (
    <div data-testid="label-dropdown">
      <span data-testid="dd-default">{defaultOption}</span>
      {options?.map((o: any) => (
        <button key={o.value} type="button" onClick={() => onSelect(o)}>
          {o.label}
        </button>
      ))}
      {!options?.length && <span>{placeholder}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled, icon }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {icon}
      {text}
    </button>
  ),
}));

jest.mock(
  '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton',
  () => ({
    __esModule: true,
    default: ({ icon, label, onClick, disabled }: any) => (
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>
        {icon}
      </button>
    ),
  })
);

jest.mock('@/app/features/tasks/components/TaskFormFields', () => ({
  __esModule: true,
  default: ({ onAssigneeSelect, hideTemplatePicker }: any) => (
    <div data-testid="task-form-fields" data-hidetemplate={String(hideTemplatePicker)}>
      <button type="button" onClick={() => onAssigneeSelect({ label: 'X', value: 'x' })}>
        assign-in-form
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/tasks/components/RecurrenceScopeModal', () => ({
  __esModule: true,
  default: ({ showModal, onConfirm, busy, taskName }: any) =>
    showModal ? (
      <div data-testid="scope-modal" data-busy={String(busy)}>
        <span>scope:{taskName}</span>
        <button type="button" onClick={() => onConfirm('ALL')}>
          confirm-scope
        </button>
      </div>
    ) : null,
}));

/* ────────────────────────────── store + service mocks ───────────────────────────── */

let mockEncountersById: Record<string, unknown> = {};
let mockFocusTaskId: string | null = null;
const mockSetFocusTaskId = jest.fn();
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: any) =>
    selector({
      encountersById: mockEncountersById,
      focusTaskId: mockFocusTaskId,
      setFocusTaskId: mockSetFocusTaskId,
    }),
}));

let mockTasksById: Record<string, Task> = {};
jest.mock('@/app/stores/taskStore', () => ({
  useTaskStore: (selector: any) => selector({ tasksById: mockTasksById }),
}));

let mockTeam: unknown[] = [];
jest.mock('@/app/hooks/useTeam', () => ({
  useLoadTeam: jest.fn(),
  useTeamForPrimaryOrg: () => mockTeam,
}));

const mockChangeTaskStatus = jest.fn();
const mockLoadTasks = jest.fn();
const mockUpdateTask = jest.fn();
jest.mock('@/app/features/tasks/services/taskService', () => ({
  changeTaskStatus: (...args: unknown[]) => mockChangeTaskStatus(...args),
  loadTasksForPrimaryOrg: (...args: unknown[]) => mockLoadTasks(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
}));

jest.mock('@/app/lib/timezone', () => ({
  getPreferredTimeZone: () => 'UTC',
}));

jest.mock('@/app/lib/appointmentWorkspace', () => ({
  formatStampDate: (value: string) => `D(${value})`,
}));

const mockHandleCreate = jest.fn();
const mockSetFormData = jest.fn();
const mockSetFormDataErrors = jest.fn();
let mockTaskForm: Record<string, unknown>;
jest.mock('@/app/hooks/useTaskForm', () => ({
  useTaskForm: jest.fn(() => mockTaskForm),
}));

import TasksPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/TasksPanel';
import { useTaskForm } from '@/app/hooks/useTaskForm';

/* ────────────────────────────── fixtures + helpers ───────────────────────────── */

const makeTask = (overrides: Partial<Task> & Pick<Task, '_id'>): Task => ({
  assignedTo: '',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  name: '',
  dueAt: new Date('2026-02-01T09:30:00Z'),
  status: 'PENDING',
  appointmentId: 'appt-1',
  ...overrides,
});

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const mockParentOptions = [{ label: 'Parent A', value: 'pa1' }];

const renderPanel = (props: Record<string, unknown> = {}) =>
  render(
    <TasksPanel
      appointmentId="appt-1"
      companionId="comp-1"
      parentOptions={mockParentOptions}
      {...props}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockEncountersById = { 'appt-1': { id: 'appt-1' } };
  mockFocusTaskId = null;
  mockTasksById = {};
  mockTeam = [];
  mockChangeTaskStatus.mockResolvedValue(undefined);
  mockLoadTasks.mockResolvedValue(undefined);
  mockUpdateTask.mockResolvedValue(undefined);
  // A valid task: the edit path now runs the same validateTaskForm rules as
  // create, so the base fixture has to satisfy them for an edit to reach the API.
  mockTaskForm = {
    formData: {
      name: 'FD',
      assignedTo: 'u1',
      category: 'CARE',
      dueAt: new Date('2026-02-01T09:30:00Z'),
    },
    setFormData: mockSetFormData,
    due: new Date('2026-02-01T00:00:00Z'),
    setDue: jest.fn(),
    dueTimeValue: '09:00',
    setDueTimeValue: jest.fn(),
    formDataErrors: {},
    setFormDataErrors: mockSetFormDataErrors,
    error: null,
    isLoading: false,
    templateOptions: [],
    selectTemplate: jest.fn(),
    handleCreate: mockHandleCreate,
  };
});

/* ────────────────────────────── tests ───────────────────────────── */

describe('TasksPanel — guard + load', () => {
  it('renders nothing when the appointment has no encounter', () => {
    mockEncountersById = {};
    renderPanel();
    expect(screen.queryByRole('button', { name: 'New Task' })).not.toBeInTheDocument();
  });

  it('loads workspace tasks on mount', async () => {
    renderPanel();
    await waitFor(() =>
      expect(mockLoadTasks).toHaveBeenCalledWith({
        force: true,
        silent: true,
        filters: { includeCompleted: true, audience: ['EMPLOYEE_TASK', 'PARENT_TASK'] },
      })
    );
    await settle();
  });

  it('logs a load failure without crashing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLoadTasks.mockRejectedValueOnce(new Error('load failed'));
    renderPanel();
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Failed to load workspace tasks:', expect.any(Error))
    );
    errorSpy.mockRestore();
    await settle();
  });

  it('shows the empty state and a New Task button when there are no tasks', () => {
    renderPanel();
    expect(screen.getByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
  });
});

describe('TasksPanel — employee task rows', () => {
  const seedFourStatuses = () => {
    mockTasksById = {
      e1: makeTask({
        _id: 'e1',
        name: 'Give meds',
        description: 'IV fluids',
        status: 'IN_PROGRESS',
        source: 'ORG_TEMPLATE',
        templateId: 'tpl-1',
        category: 'MEDICATION',
      }),
      e2: makeTask({
        _id: 'e2',
        name: '',
        description: 'Observe patient',
        status: 'COMPLETED',
        category: '',
        dueAt: undefined as unknown as Date,
      }),
      e3: makeTask({
        _id: 'e3',
        name: '',
        description: '',
        status: 'CANCELLED',
        source: 'YC_LIBRARY',
        libraryTaskId: 'lib-9',
        dueAt: undefined as unknown as Date,
      }),
      e4: makeTask({ _id: 'e4', name: 'Pending job', description: 'note', status: 'PENDING' }),
      // A task for a different appointment is filtered out of this panel.
      eOther: makeTask({ _id: 'eOther', name: 'Other appt task', appointmentId: 'zzz' }),
    };
  };

  it('renders rows for each status and cycles status to the next value on click', async () => {
    seedFourStatuses();
    renderPanel();

    expect(screen.getByText('Give meds')).toBeInTheDocument();
    // Task with no name falls back to its description, then to the literal "Task".
    expect(screen.getByText('Observe patient')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    // A task belonging to a different appointment is not shown here.
    expect(screen.queryByText('Other appt task')).not.toBeInTheDocument();
    // A valid dueAt produces a "Due:" line (both e1 and e4 have one).
    expect(screen.getAllByText(/Due:/).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: 'Change status for Give meds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change status for Observe patient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change status for Task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change status for Pending job' }));

    await waitFor(() => expect(mockChangeTaskStatus).toHaveBeenCalledTimes(4));
    const statuses = mockChangeTaskStatus.mock.calls.map((c) => (c[0] as Task).status);
    // UPCOMING→COMPLETED, COMPLETED→CANCELLED, CANCELLED→PENDING, PENDING→IN_PROGRESS
    expect(statuses).toEqual(['COMPLETED', 'CANCELLED', 'PENDING', 'IN_PROGRESS']);
    await settle();
  });

  it('assigns an employee and lists team options (skipping members with no id)', async () => {
    mockTeam = [
      { name: 'Dr Alice', practionerId: 'p1' },
      { name: '   ', practionerId: 'p2' },
      { name: 'NoId', practionerId: '' },
    ];
    mockTasksById = { e1: makeTask({ _id: 'e1', name: 'Give meds', description: 'IV' }) };
    renderPanel();

    // name → practionerId fallback for the blank-name member; empty id is skipped.
    expect(screen.getByRole('button', { name: 'Dr Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'p2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'NoId' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dr Alice' }));
    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: 'p1' }))
    );
    await settle();
  });

  it('surfaces a save error and refetches when a status sync fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockChangeTaskStatus.mockRejectedValueOnce(new Error('sync failed'));
    mockTasksById = { e1: makeTask({ _id: 'e1', name: 'Give meds' }) };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Change status for Give meds' }));

    expect(await screen.findByText('Unable to update task. Please try again.')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('Failed to sync task change:', expect.any(Error));
    // A refetch is fired to roll the optimistic update back.
    await waitFor(() => expect(mockLoadTasks).toHaveBeenCalledTimes(2));
    errorSpy.mockRestore();
    await settle();
  });

  it('expands a rich task into its read-only details and collapses it again', async () => {
    mockTasksById = {
      e1: makeTask({
        _id: 'e1',
        name: 'Give meds',
        description: 'IV fluids',
        status: 'IN_PROGRESS',
        category: 'MEDICATION',
        recurrence: { type: 'DAILY', isMaster: false, endDate: new Date('2026-02-10T00:00:00Z') },
        reminder: { enabled: true, offsetMinutes: 30 },
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'View Give meds' }));
    expect(screen.getByText('Task details')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('30 minutes before')).toBeInTheDocument();
    // Duration joins the due date and recurrence end date via formatStampDate.
    expect(screen.getByText('D(2026-02-01) - D(2026-02-10)')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();

    // Toggling the same row off collapses the breakdown.
    fireEvent.click(screen.getByRole('button', { name: 'Hide details for Give meds' }));
    expect(screen.queryByText('Task details')).not.toBeInTheDocument();
    await settle();
  });

  it('renders the fallback labels and em dash for a sparse task detail', async () => {
    mockTasksById = {
      e2: makeTask({
        _id: 'e2',
        name: '',
        description: 'Observe patient',
        status: 'COMPLETED',
        category: '',
        dueAt: undefined as unknown as Date,
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'View Observe patient' }));
    // Empty category → DetailRow renders the em dash fallback.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No reminder')).toBeInTheDocument();
    expect(screen.getByText('Does not repeat')).toBeInTheDocument();
    // No due date/end date → the Duration row is not rendered.
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
    await settle();
  });
});

describe('TasksPanel — parent tab', () => {
  it('renders parent rows read-only with a managed-elsewhere reason', () => {
    mockTasksById = {
      p1: makeTask({
        _id: 'p1',
        audience: 'PARENT_TASK',
        name: 'Feed pet',
        assignedTo: 'pa1',
      }),
      p2: makeTask({
        _id: 'p2',
        audience: 'PARENT_TASK',
        name: 'Walk pet',
        assignedTo: undefined as unknown as string,
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Parent task' }));

    expect(screen.getByText('Feed pet')).toBeInTheDocument();
    expect(screen.getByText('Walk pet')).toBeInTheDocument();
    // Assigned id shown as read-only text; missing assignee falls back to Unassigned.
    expect(screen.getByText('pa1')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    // The status pill is not an actionable button on parent rows.
    expect(
      screen.queryByRole('button', { name: 'Change status for Feed pet' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Feed pet' })).toBeDisabled();
    expect(
      screen.getAllByText('Parent tasks are managed from the pet parent app.').length
    ).toBeGreaterThanOrEqual(2);
  });

  it('shows the empty state on the parent tab when there are no parent tasks', () => {
    mockTasksById = { e1: makeTask({ _id: 'e1', name: 'Give meds' }) };
    renderPanel({ parentOptions: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Parent task' }));
    expect(screen.getByText('No tasks yet.')).toBeInTheDocument();
  });
});

describe('TasksPanel — new/edit form', () => {
  it('opens a new employee task form and creates via handleCreate', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByText('New task')).toBeInTheDocument();
    expect(screen.getByTestId('task-form-fields')).toHaveAttribute('data-hidetemplate', 'false');

    // The shared form's assignee select feeds back into the task form data.
    fireEvent.click(screen.getByRole('button', { name: 'assign-in-form' }));
    expect(mockSetFormData).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: 'x' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(mockHandleCreate).toHaveBeenCalled());

    // Back returns to the task list.
    fireEvent.click(screen.getByRole('button', { name: 'Back to tasks' }));
    expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
    await settle();

    const call = (useTaskForm as jest.Mock).mock.calls[0][0];
    expect(call.isCompanionTask).toBe(false);
    expect(call.initialTask).toEqual(
      expect.objectContaining({ appointmentId: 'appt-1', audience: 'EMPLOYEE_TASK' })
    );
  });

  // #1904: employee (non-parent) tasks created from Quick Actions must carry the
  // appointment's pet id as `patientId` — otherwise medication/observation-tool
  // tasks 400 on the backend (companionId IS the patient id in this system).
  // patientId is forwarded whenever companionId is present, NOT gated on the parent tab.
  it('seeds a new employee task with patientId from the companion id', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByText('New task')).toBeInTheDocument();
    await settle();

    const call = (useTaskForm as jest.Mock).mock.calls.at(-1)?.[0];
    expect(call.isCompanionTask).toBe(false);
    expect(call.initialTask).toEqual(
      expect.objectContaining({ audience: 'EMPLOYEE_TASK', patientId: 'comp-1' })
    );
    // It stays an employee task — no companionId is added for the non-parent tab.
    expect(call.initialTask.companionId).toBeUndefined();
  });

  it('opens a new parent task form seeded with the companion id', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Parent task' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByText('New task')).toBeInTheDocument();
    await settle();

    const call = (useTaskForm as jest.Mock).mock.calls.at(-1)?.[0];
    expect(call.isCompanionTask).toBe(true);
    expect(call.initialTask).toEqual(
      expect.objectContaining({ audience: 'PARENT_TASK', companionId: 'comp-1' })
    );
  });

  it('shows the useTaskForm validation error and disabled saving state', () => {
    mockTaskForm.error = 'Form invalid';
    mockTaskForm.isLoading = true;
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByText('Form invalid')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Saving…' });
    expect(save).toBeDisabled();
  });

  it('edits a non-series task directly and closes the form on success', async () => {
    mockTasksById = { e4: makeTask({ _id: 'e4', name: 'Pending job', status: 'PENDING' }) };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Pending job' }));
    expect(screen.getByText('Edit task')).toBeInTheDocument();
    expect(screen.getByTestId('task-form-fields')).toHaveAttribute('data-hidetemplate', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'e4', appointmentId: 'appt-1', audience: 'EMPLOYEE_TASK' }),
        undefined
      )
    );
    // onSaved closes the form back to the list.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument()
    );
    await settle();

    const call = (useTaskForm as jest.Mock).mock.calls.at(-1)?.[0];
    // editingTask.companionId is absent, so the panel companion id fills it in.
    expect(call.initialTask.companionId).toBe('comp-1');
  });

  // Bug 28: a repeating task with no end date used to be PATCHed anyway and fail
  // server-side with the generic "Unable to update task", even though the form's
  // own rule requires an end date. The edit path must validate like create does.
  it('blocks an edit of a repeating task that has no end date and surfaces the field error', async () => {
    mockTaskForm.formData = {
      name: 'Feed renal diet',
      assignedTo: 'u1',
      category: 'DIET',
      dueAt: new Date('2026-07-01T09:00:00Z'),
      // "Every 12 hours" with the End date left empty — exactly the QA screenshot.
      recurrence: { type: 'CUSTOM', isMaster: true, cronExpression: '0 */12 * * *' },
    };
    mockTasksById = { e9: makeTask({ _id: 'e9', name: 'Feed renal diet' }) };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Feed renal diet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await settle();

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockSetFormDataErrors).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: 'End date is required for a repeating task' })
    );
  });

  it('saves an edit of a repeating task once an end date is set', async () => {
    mockTaskForm.formData = {
      name: 'Feed renal diet',
      assignedTo: 'u1',
      category: 'DIET',
      dueAt: new Date('2026-07-01T09:00:00Z'),
      recurrence: {
        type: 'CUSTOM',
        isMaster: true,
        cronExpression: '0 */12 * * *',
        endDate: new Date('2026-07-10T09:00:00Z'),
      },
    };
    mockTasksById = { e10: makeTask({ _id: 'e10', name: 'Feed renal diet' }) };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Feed renal diet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    expect(mockSetFormDataErrors).toHaveBeenCalledWith({});
    await settle();
  });

  it('routes a recurring-series edit through the scope modal and surfaces a save failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUpdateTask.mockRejectedValueOnce(new Error('update failed'));
    mockTasksById = {
      es1: makeTask({
        _id: 'es1',
        name: 'Series task',
        companionId: 'comp-x',
        recurrence: { type: 'DAILY', isMaster: true },
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Series task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    // A series task opens the recurrence scope modal instead of saving directly.
    expect(await screen.findByTestId('scope-modal')).toHaveTextContent('scope:Series task');

    fireEvent.click(screen.getByRole('button', { name: 'confirm-scope' }));

    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(expect.objectContaining({ _id: 'es1' }), 'ALL')
    );
    expect(await screen.findByText('Unable to update task. Please try again.')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('Failed to update task:', expect.any(Error));

    // The editingTask already carries a companion id, so the panel id is not used.
    const call = (useTaskForm as jest.Mock).mock.calls.at(-1)?.[0];
    expect(call.initialTask.companionId).toBe('comp-x');
    errorSpy.mockRestore();
    await settle();
  });
});

describe('TasksPanel — locally-generated rows + focus', () => {
  it('seeds a draft task when editing a row that is not backed by the store', async () => {
    // Row id (task._id) deliberately differs from its store key so the backing
    // lookup misses and openEdit seeds a draft from the schedule row.
    mockTasksById = {
      ghostKey: makeTask({
        _id: 'grow1',
        name: 'Ghost row',
        description: 'ghost desc',
        assignedTo: 'p1',
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ghost row' }));
    expect(screen.getByText('Edit task')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(mockHandleCreate).toHaveBeenCalled());
    await settle();
  });

  it('seeds a draft with fallbacks when the schedule row has no assignee or due date', async () => {
    mockTasksById = {
      ghostKey2: makeTask({
        _id: 'grow2',
        name: '',
        description: 'only desc',
        assignedTo: undefined as unknown as string,
        dueAt: undefined as unknown as Date,
      }),
    };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit only desc' }));
    expect(screen.getByText('Edit task')).toBeInTheDocument();
    await settle();

    const call = (useTaskForm as jest.Mock).mock.calls.at(-1)?.[0];
    expect(call.initialTask.assignedTo).toBe('');
    expect(call.initialTask.description).toBe('only desc');
    expect(call.initialTask.timezone).toBe('UTC');
  });

  it('returns early without an API call when syncing a row missing from the store', async () => {
    // The ghost row is rendered but its id is not a store key, so the sync guard
    // short-circuits before hitting the backend.
    mockTasksById = { ghostKey: makeTask({ _id: 'grow1', name: 'Ghost row' }) };
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Change status for Ghost row' }));
    await settle();
    expect(mockChangeTaskStatus).not.toHaveBeenCalled();
  });

  it('auto-opens the edit form for a focused task and clears the focus flag', () => {
    mockFocusTaskId = 'e1';
    mockTasksById = { e1: makeTask({ _id: 'e1', name: 'Give meds' }) };
    renderPanel();

    expect(screen.getByText('Edit task')).toBeInTheDocument();
    expect(mockSetFocusTaskId).toHaveBeenCalledWith(null);
  });

  it('clears the focus flag without opening a form when the focused task is missing', () => {
    mockFocusTaskId = 'missing';
    mockTasksById = { e1: makeTask({ _id: 'e1', name: 'Give meds' }) };
    renderPanel();

    expect(screen.queryByText('Edit task')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
    expect(mockSetFocusTaskId).toHaveBeenCalledWith(null);
  });
});
