import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
} from '@/app/features/tasks/services/taskService';
import { Option } from '@/app/features/companions/types/companion';
import {
  EMPTY_COMPANION_TASK,
  EMPTY_TASK,
  Task,
  TaskLibrary,
  TaskTemplate,
} from '@/app/features/tasks/types/task';
import { getPreferredTimeValue } from '@/app/lib/date';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import {
  applyTemplateToForm,
  buildTaskTemplate,
  TaskFormErrors,
  toTemplateOptions,
  validateTaskForm,
} from '@/app/lib/taskForm';

export type UseTaskFormOptions = {
  initialTask?: Partial<Task>;
  isCompanionTask?: boolean;
  loadOnMount?: boolean;
  onSuccess?: () => void;
};

export const useTaskForm = (options: UseTaskFormOptions = {}) => {
  const { initialTask, isCompanionTask = false, loadOnMount = true, onSuccess } = options;

  const emptyTask = isCompanionTask ? EMPTY_COMPANION_TASK : EMPTY_TASK;

  const [formData, setFormData] = useState<Task>({
    ...emptyTask,
    ...initialTask,
  });
  const [due, setDue] = useState<Date | null>(
    initialTask?.dueAt ? new Date(initialTask.dueAt) : new Date()
  );
  const [dueTimeValue, setDueTimeValue] = useState(
    getPreferredTimeValue(initialTask?.dueAt, '00:00')
  );
  const [formDataErrors, setFormDataErrors] = useState<TaskFormErrors>({});
  // Selectable templates: org task templates first, then YC library, in one
  // list so the load commits as a single state update.
  const [templates, setTemplates] = useState<Array<TaskTemplate | TaskLibrary>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({ ...emptyTask, ...initialTask });
    setDue(initialTask?.dueAt ? new Date(initialTask.dueAt) : new Date());
    setDueTimeValue(getPreferredTimeValue(initialTask?.dueAt, '00:00'));
    setFormDataErrors({});
    setError(null);
  }, [emptyTask, initialTask]);

  useEffect(() => {
    if (!due) return;
    const [hourValue, minuteValue] = String(dueTimeValue || '00:00')
      .split(':')
      .map((value) => Number.parseInt(value, 10));
    const hour = Number.isFinite(hourValue) ? hourValue : 0;
    const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
    setFormData((prev) => ({
      ...prev,
      dueAt: buildDateInPreferredTimeZone(due, hour * 60 + minute),
      timezone: prev.timezone || getPreferredTimeZone(),
    }));
  }, [due, dueTimeValue]);

  // Load the org task templates (and YC library) up front so the single
  // "Load from template" picker is always populated — the form no longer
  // exposes a "Source" selector that gated which list to fetch.
  useEffect(() => {
    if (!loadOnMount) return;
    let active = true;

    const load = async () => {
      const [orgResult, libraryResult] = await Promise.allSettled([
        getTaskTemplatesForPrimaryOrg(),
        getTaskLibrary(),
      ]);
      if (!active) return;
      const orgTemplates = orgResult.status === 'fulfilled' ? (orgResult.value ?? []) : [];
      const libraryTemplates =
        libraryResult.status === 'fulfilled' ? (libraryResult.value ?? []) : [];
      const merged = [...orgTemplates, ...libraryTemplates];
      // Single commit for both lists so the load is one atomic state update. Skip
      // the commit entirely when there are no templates — avoids a no-op re-render
      // (and the empty state already starts as []).
      if (merged.length > 0) setTemplates(merged);
      if (orgResult.status === 'rejected' && libraryResult.status === 'rejected') {
        console.log('Error loading task templates:', orgResult.reason);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [loadOnMount]);

  const templateOptions: Option[] = useMemo(() => toTemplateOptions(templates), [templates]);

  const selectTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t._id === templateId);
      if (template) {
        setFormData((prev) => applyTemplateToForm(prev, template));
      }
    },
    [templates]
  );

  const handleCreate = useCallback(async () => {
    const errors = validateTaskForm(formData);
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setIsLoading(true);
    try {
      await createTask(formData);
      resetForm();
      onSuccess?.();
      return true;
    } catch (err) {
      console.log(err);
      setError('Failed to create task. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData, resetForm, onSuccess]);

  const handleCreateTemplate = useCallback(async () => {
    const errors = validateTaskForm(formData);
    delete errors.libraryTaskId;
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setIsLoading(true);
    try {
      const template: TaskTemplate = buildTaskTemplate(formData);
      await createTaskTemplate(template);
      await createTask(formData);
      resetForm();
      onSuccess?.();
      return true;
    } catch (err) {
      console.log(err);
      setError('Failed to create task template. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData, resetForm, onSuccess]);

  return {
    formData,
    setFormData,
    due,
    setDue,
    dueTimeValue,
    setDueTimeValue,
    formDataErrors,
    setFormDataErrors,
    error,
    isLoading,
    templateOptions,
    selectTemplate,
    handleCreate,
    handleCreateTemplate,
    resetForm,
  };
};
