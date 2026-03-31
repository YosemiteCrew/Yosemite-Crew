import { renderHook, act, waitFor } from '@testing-library/react';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import {
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
} from '@/app/features/tasks/services/taskService';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import { getPreferredTimeValue } from '@/app/lib/date';

jest.mock('@/app/features/tasks/services/taskService', () => ({
  createTask: jest.fn(),
  createTaskTemplate: jest.fn(),
  getTaskLibrary: jest.fn(),
  getTaskTemplatesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: jest.fn((date: Date, minutes: number) => {
    const d = new Date(date);
    d.setMinutes(minutes);
    return d;
  }),
  getPreferredTimeZone: jest.fn(() => 'UTC'),
}));

jest.mock('@/app/lib/date', () => ({
  getPreferredTimeValue: jest.fn((dueAt?: string, fallback = '00:00') => {
    if (!dueAt) return fallback;
    return '10:00';
  }),
}));

jest.mock('@/app/lib/taskForm', () => ({
  applyTemplateToForm: jest.fn((prev: any, template: any) => ({
    ...prev,
    name: template.name,
    category: template.kind,
  })),
  buildTaskTemplate: jest.fn((formData: any) => ({
    _id: '',
    source: 'ORG_TEMPLATE',
    category: formData.category,
    name: formData.name,
    kind: formData.category,
    organisationId: '',
    createdBy: '',
    defaultRole: 'EMPLOYEE',
    isActive: true,
  })),
  toTemplateOptions: jest.fn((list: any[]) =>
    list.map((t: any) => ({ label: t.name, value: t._id }))
  ),
  validateTaskForm: jest.fn(() => ({})),
}));

const mockCreateTask = createTask as jest.Mock;
const mockCreateTaskTemplate = createTaskTemplate as jest.Mock;
const mockGetTaskLibrary = getTaskLibrary as jest.Mock;
const mockGetTaskTemplatesForPrimaryOrg = getTaskTemplatesForPrimaryOrg as jest.Mock;
const mockBuildDateInPreferredTimeZone = buildDateInPreferredTimeZone as jest.Mock;
const mockGetPreferredTimeZone = getPreferredTimeZone as jest.Mock;
const { validateTaskForm } = jest.requireMock('@/app/lib/taskForm');

const baseTask = {
  _id: '',
  source: 'CUSTOM' as const,
  audience: 'EMPLOYEE_TASK' as const,
  status: 'PENDING' as const,
  name: 'Test task',
  category: 'CUSTOM',
  assignedTo: 'staff-1',
  dueAt: new Date('2026-01-15T10:00:00Z'),
};

describe('useTaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildDateInPreferredTimeZone.mockImplementation((date: Date) => date);
    mockGetPreferredTimeZone.mockReturnValue('UTC');
    (validateTaskForm as jest.Mock).mockReturnValue({});
  });

  it('initializes with EMPTY_TASK defaults for non-companion task', () => {
    const { result } = renderHook(() => useTaskForm());
    expect(result.current.formData).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.templateOptions).toEqual([]);
  });

  it('initializes with initialTask when provided', () => {
    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { name: 'prefilled', dueAt: new Date('2026-01-15T10:00:00Z') } })
    );
    expect(result.current.formData.name).toBe('prefilled');
  });

  it('initializes due to new Date() when initialTask.dueAt is not provided', () => {
    const { result } = renderHook(() => useTaskForm({ initialTask: {} }));
    expect(result.current.due).toBeInstanceOf(Date);
  });

  it('initializes due with initialTask.dueAt when provided', () => {
    const dueAt = new Date('2026-06-01T09:00:00Z');
    const { result } = renderHook(() => useTaskForm({ initialTask: { dueAt } }));
    expect(result.current.due).toBeInstanceOf(Date);
  });

  it('resetForm restores initial state', async () => {
    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask }));

    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, name: 'changed' }));
    });

    expect(result.current.formData.name).toBe('changed');

    await act(async () => {
      result.current.resetForm();
    });

    expect(result.current.formData.name).toBe('Test task');
    expect(result.current.error).toBeNull();
  });

  it('handleCreate returns false when validation errors exist', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({ name: 'Required' });
    const { result } = renderHook(() => useTaskForm());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreate();
    });

    expect(returnValue).toBe(false);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('handleCreate returns true on success and calls onSuccess', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({});
    mockCreateTask.mockResolvedValue({ _id: 'new-task' });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask, onSuccess }));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreate();
    });

    expect(returnValue).toBe(true);
    expect(mockCreateTask).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handleCreate returns false and sets error on exception', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({});
    mockCreateTask.mockRejectedValue(new Error('create failed'));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask }));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreate();
    });

    expect(returnValue).toBe(false);
    expect(result.current.error).toBe('Failed to create task. Please try again.');
    consoleSpy.mockRestore();
  });

  it('handleCreateTemplate returns false when validation errors', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({ name: 'Required' });
    const { result } = renderHook(() => useTaskForm());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreateTemplate();
    });

    expect(returnValue).toBe(false);
  });

  it('handleCreateTemplate calls createTaskTemplate and createTask on success', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({});
    mockCreateTaskTemplate.mockResolvedValue({});
    mockCreateTask.mockResolvedValue({ _id: 't1' });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask, onSuccess }));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreateTemplate();
    });

    expect(returnValue).toBe(true);
    expect(mockCreateTaskTemplate).toHaveBeenCalled();
    expect(mockCreateTask).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handleCreateTemplate returns false and sets error on exception', async () => {
    (validateTaskForm as jest.Mock).mockReturnValue({});
    mockCreateTaskTemplate.mockRejectedValue(new Error('template failed'));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask }));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreateTemplate();
    });

    expect(returnValue).toBe(false);
    expect(result.current.error).toBe('Failed to create task template. Please try again.');
    consoleSpy.mockRestore();
  });

  it('loads ORG_TEMPLATE templates when source is ORG_TEMPLATE and loadOnMount is true', async () => {
    const templates = [{ _id: 't1', name: 'Template A', kind: 'CUSTOM' }];
    mockGetTaskTemplatesForPrimaryOrg.mockResolvedValue(templates);

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'ORG_TEMPLATE' } })
    );

    await waitFor(() => {
      expect(mockGetTaskTemplatesForPrimaryOrg).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.templateOptions).toEqual([{ label: 'Template A', value: 't1' }]);
    });
  });

  it('loads YC_LIBRARY templates when source is YC_LIBRARY and loadOnMount is true', async () => {
    const libraryItems = [{ _id: 'lib-1', name: 'Library Task', kind: 'MEDICATION' }];
    mockGetTaskLibrary.mockResolvedValue(libraryItems);

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'YC_LIBRARY' } })
    );

    await waitFor(() => {
      expect(mockGetTaskLibrary).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.templateOptions).toEqual([{ label: 'Library Task', value: 'lib-1' }]);
    });
  });

  it('does not load templates when loadOnMount is false', async () => {
    const { result } = renderHook(() =>
      useTaskForm({
        initialTask: { ...baseTask, source: 'ORG_TEMPLATE' },
        loadOnMount: false,
      })
    );

    await act(async () => {});
    expect(mockGetTaskTemplatesForPrimaryOrg).not.toHaveBeenCalled();
    expect(result.current.templateOptions).toEqual([]);
  });

  it('handles template loading error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockGetTaskTemplatesForPrimaryOrg.mockRejectedValue(new Error('load error'));

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'ORG_TEMPLATE' } })
    );

    await waitFor(() => {
      expect(mockGetTaskTemplatesForPrimaryOrg).toHaveBeenCalled();
    });

    expect(result.current.templateOptions).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('selectTemplate from ORG_TEMPLATE list applies template to form', async () => {
    const templates = [{ _id: 't1', name: 'Template A', kind: 'HYGIENE' }];
    mockGetTaskTemplatesForPrimaryOrg.mockResolvedValue(templates);

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'ORG_TEMPLATE' } })
    );

    await waitFor(() => expect(mockGetTaskTemplatesForPrimaryOrg).toHaveBeenCalled());

    await waitFor(() => {
      expect(result.current.templateOptions).toEqual([{ label: 'Template A', value: 't1' }]);
    });

    await act(async () => {
      result.current.selectTemplate('t1');
    });

    expect(result.current.formData.name).toBe('Template A');
  });

  it('selectTemplate from YC_LIBRARY list applies template to form', async () => {
    const libraryItems = [{ _id: 'lib-1', name: 'Library Task', kind: 'MEDICATION' }];
    mockGetTaskLibrary.mockResolvedValue(libraryItems);

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'YC_LIBRARY' } })
    );

    await waitFor(() => expect(mockGetTaskLibrary).toHaveBeenCalled());

    await waitFor(() => {
      expect(result.current.templateOptions).toEqual([{ label: 'Library Task', value: 'lib-1' }]);
    });

    await act(async () => {
      result.current.selectTemplate('lib-1');
    });

    expect(result.current.formData.name).toBe('Library Task');
  });

  it('selectTemplate does nothing when templateId not found', async () => {
    mockGetTaskTemplatesForPrimaryOrg.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useTaskForm({ initialTask: { ...baseTask, source: 'ORG_TEMPLATE' } })
    );

    await waitFor(() => expect(mockGetTaskTemplatesForPrimaryOrg).toHaveBeenCalled());

    const nameBefore = result.current.formData.name;
    await act(async () => {
      result.current.selectTemplate('non-existent');
    });

    expect(result.current.formData.name).toBe(nameBefore);
  });

  it('selectTemplate does nothing for CUSTOM source', async () => {
    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask }));
    const nameBefore = result.current.formData.name;

    await act(async () => {
      result.current.selectTemplate('anything');
    });

    expect(result.current.formData.name).toBe(nameBefore);
  });

  it('updates dueAt when due date changes', async () => {
    const { result } = renderHook(() => useTaskForm({ initialTask: baseTask }));
    const newDate = new Date('2026-03-01');

    await act(async () => {
      result.current.setDue(newDate);
    });

    expect(mockBuildDateInPreferredTimeZone).toHaveBeenCalled();
  });

  it('handles null due date without crashing', async () => {
    const { result } = renderHook(() => useTaskForm());

    await act(async () => {
      result.current.setDue(null);
    });

    // Should not throw
    expect(result.current.due).toBeNull();
  });
});
