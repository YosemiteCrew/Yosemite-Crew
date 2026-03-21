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
  const [orgTemplates, setOrgTemplates] = useState<TaskTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<TaskLibrary[]>([]);
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

  useEffect(() => {
    if (!loadOnMount) return;

    const load = async () => {
      if (formData.source !== 'ORG_TEMPLATE' && formData.source !== 'YC_LIBRARY') return;
      try {
        if (formData.source === 'ORG_TEMPLATE') {
          const data = await getTaskTemplatesForPrimaryOrg();
          setOrgTemplates(data);
        } else if (formData.source === 'YC_LIBRARY') {
          const data = await getTaskLibrary();
          setLibraryTemplates(data);
        }
      } catch (err) {
        console.log('Error loading templates:', err);
      }
    };
    load();
  }, [loadOnMount, formData.source]);

  const templateOptions: Option[] = useMemo(() => {
    const list = formData.source === 'ORG_TEMPLATE' ? orgTemplates : libraryTemplates;
    return toTemplateOptions(list);
  }, [formData.source, orgTemplates, libraryTemplates]);

  const selectTemplate = useCallback(
    (templateId: string) => {
      let template;
      if (formData.source === 'ORG_TEMPLATE') {
        template = orgTemplates.find((t) => t._id === templateId);
      } else if (formData.source === 'YC_LIBRARY') {
        template = libraryTemplates.find((t) => t._id === templateId);
      }
      if (template) {
        setFormData((prev) => applyTemplateToForm(prev, template));
      }
    },
    [formData.source, orgTemplates, libraryTemplates]
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
