import {
  validateTaskForm,
  buildTaskTemplate,
  applyTemplateToForm,
  toTemplateOptions,
} from '@/app/lib/taskForm';
import { Task, TaskTemplate, TaskLibrary, TaskKindOptions } from '@/app/features/tasks/types/task';

describe('taskForm utilities', () => {
  it('exposes the production task category taxonomy', () => {
    expect(TaskKindOptions.map((option) => option.value)).toEqual([
      'MEDICATION',
      'CARE',
      'DIET',
      'PROCEDURE',
      'DIAGNOSTIC',
      'COMMUNICATION',
      'BILLING',
      'RECORD',
      'ADMIN',
      'CUSTOM',
    ]);
  });

  describe('validateTaskForm', () => {
    const baseTask: Task = {
      _id: 'task-1',
      name: 'Test Task',
      assignedTo: 'user-1',
      companionId: 'companion-1',
      category: 'MEDICATION',
      source: 'CUSTOM',
      status: 'PENDING',
      audience: 'PARENT_TASK',
      dueAt: new Date(),
    };

    it('returns empty errors for valid task', () => {
      const errors = validateTaskForm(baseTask);
      expect(errors).toEqual({});
    });

    it('returns error when assignedTo is missing', () => {
      const task = { ...baseTask, assignedTo: '' };
      const errors = validateTaskForm(task);
      expect(errors.assignedTo).toBe('Please select a companion or staff');
    });

    it('returns error when name is missing', () => {
      const task = { ...baseTask, name: '' };
      const errors = validateTaskForm(task);
      expect(errors.name).toBe('Name is required');
    });

    it('returns error when category is missing', () => {
      const task = { ...baseTask, category: '' as any };
      const errors = validateTaskForm(task);
      expect(errors.category).toBe('Category is required');
    });

    it('returns error when dueAt is invalid', () => {
      const task = { ...baseTask, dueAt: new Date('invalid') as any };
      const errors = validateTaskForm(task);
      expect(errors.dueAt).toBe('Due date and time are required');
    });

    it('returns error for parent task when companion is missing', () => {
      const task = { ...baseTask, companionId: undefined };
      const errors = validateTaskForm(task);
      expect(errors.assignedTo).toBe('Please select a valid companion');
    });

    it('returns error for invalid reminder offset when reminder is enabled', () => {
      const task = {
        ...baseTask,
        reminder: {
          enabled: true,
          offsetMinutes: 0,
        },
      };
      const errors = validateTaskForm(task);
      expect(errors.reminder).toBe('Reminder minutes must be greater than 0');
    });

    // Source/template are no longer user-selected fields — "Load from template"
    // prefills an editable CUSTOM task, so there is no templateId/libraryTaskId
    // required-validation. (See applyTemplateToForm.)

    it('requires an end date for a repeating task', () => {
      const task = {
        ...baseTask,
        recurrence: { type: 'DAILY' as const, isMaster: true },
      };
      const errors = validateTaskForm(task);
      expect(errors.endDate).toBe('End date is required for a repeating task');
    });

    it('rejects an end date before the due date for a repeating task', () => {
      const task = {
        ...baseTask,
        dueAt: new Date('2026-05-10T09:00:00Z'),
        recurrence: {
          type: 'WEEKLY' as const,
          isMaster: true,
          endDate: new Date('2026-05-01T09:00:00Z'),
        },
      };
      const errors = validateTaskForm(task);
      expect(errors.endDate).toBe('End date must be on or after the due date');
    });

    it('accepts a one-off task without an end date', () => {
      const task = { ...baseTask, recurrence: { type: 'ONCE' as const, isMaster: false } };
      const errors = validateTaskForm(task);
      expect(errors.endDate).toBeUndefined();
    });

    it('returns multiple errors when multiple fields are invalid', () => {
      const task = {
        ...baseTask,
        name: '',
        assignedTo: '',
        category: '' as any,
      };
      const errors = validateTaskForm(task);
      expect(Object.keys(errors).length).toBe(3);
      expect(errors.name).toBeDefined();
      expect(errors.assignedTo).toBeDefined();
      expect(errors.category).toBeDefined();
    });
  });

  describe('buildTaskTemplate', () => {
    it('builds template from task with EMPLOYEE_TASK audience', () => {
      const task: Task = {
        _id: 'task-1',
        name: 'Employee Task',
        description: 'Test description',
        category: 'MEDICATION',
        audience: 'EMPLOYEE_TASK',
        assignedTo: 'user-1',
        source: 'CUSTOM',
        dueAt: new Date(),
        status: 'PENDING',
      };

      const template = buildTaskTemplate(task);

      expect(template._id).toBe('');
      expect(template.source).toBe('ORG_TEMPLATE');
      expect(template.category).toBe('MEDICATION');
      expect(template.name).toBe('Employee Task');
      expect(template.description).toBe('Test description');
      expect(template.defaultRole).toBe('EMPLOYEE');
      expect(template.isActive).toBe(true);
      expect(template.kind).toBe('MEDICATION');
    });

    it('builds template from task with COMPANION_TASK audience', () => {
      const task: Task = {
        _id: 'task-1',
        name: 'Companion Task',
        description: 'Companion description',
        category: 'DIET',
        audience: 'PARENT_TASK',
        assignedTo: 'user-1',
        source: 'CUSTOM',
        dueAt: new Date(),
        status: 'PENDING',
      };

      const template = buildTaskTemplate(task);

      expect(template.defaultRole).toBe('PARENT');
      expect(template.category).toBe('DIET');
    });

    it('builds template with empty description', () => {
      const task: Task = {
        _id: 'task-1',
        name: 'No Description Task',
        description: '',
        category: 'HYGIENE',
        audience: 'EMPLOYEE_TASK',
        assignedTo: 'user-1',
        source: 'CUSTOM',
        dueAt: new Date(),
        status: 'PENDING',
      };

      const template = buildTaskTemplate(task);

      expect(template.description).toBe('');
    });
  });

  describe('applyTemplateToForm', () => {
    const baseTask: Task = {
      _id: 'task-1',
      name: 'Original Name',
      description: 'Original description',
      category: 'MEDICATION',
      assignedTo: 'user-1',
      audience: 'EMPLOYEE_TASK',
      source: 'CUSTOM',
      dueAt: new Date(),
      status: 'PENDING',
    };

    it('applies TaskTemplate to form data', () => {
      const template: TaskTemplate = {
        _id: 'template-1',
        name: 'Template Name',
        description: 'Template description',
        kind: 'DIET',
        source: 'ORG_TEMPLATE',
        organisationId: 'org-1',
        category: 'DIET',
        defaultRole: 'PARENT',
        isActive: true,
        createdBy: 'user-1',
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result.name).toBe('Template Name');
      expect(result.description).toBe('Template description');
      expect(result.category).toBe('DIET');
      // Prefill keeps the task CUSTOM (values copied into the editable form).
      expect(result.source).toBe('CUSTOM');
      expect(result.assignedTo).toBe('user-1');
    });

    it('applies TaskLibrary to form data using defaultDescription', () => {
      const library: TaskLibrary = {
        _id: 'lib-1',
        name: 'Library Task',
        defaultDescription: 'Library default description',
        kind: 'HYGIENE',
        source: 'YC_LIBRARY',
        category: 'HYGIENE',
        schema: {},
        isActive: true,
      };

      const result = applyTemplateToForm(baseTask, library);

      expect(result.name).toBe('Library Task');
      expect(result.description).toBe('Library default description');
      expect(result.category).toBe('HYGIENE');
      // Prefill keeps the task CUSTOM (values copied into the editable form).
      expect(result.source).toBe('CUSTOM');
    });

    it('handles template with empty name', () => {
      const template: TaskTemplate = {
        _id: 'template-1',
        name: '',
        kind: 'MEDICATION',
        source: 'ORG_TEMPLATE',
        organisationId: 'org-1',
        category: 'MEDICATION',
        defaultRole: 'PARENT',
        isActive: true,
        createdBy: 'user-1',
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result.name).toBe('');
    });

    it('handles template with undefined description', () => {
      const template = {
        _id: 'template-1',
        name: 'Template',
        kind: 'MEDICATION',
        source: 'ORG_TEMPLATE',
        organisationId: 'org-1',
        category: 'MEDICATION',
        defaultRole: 'PARENT',
        isActive: true,
        createdBy: 'user-1',
      } as TaskTemplate;

      const result = applyTemplateToForm(baseTask, template);

      expect(result.description).toBe('');
    });

    it('preserves other task fields', () => {
      const template: TaskTemplate = {
        _id: 'template-1',
        name: 'Template',
        kind: 'DIET',
        source: 'ORG_TEMPLATE',
        organisationId: 'org-1',
        category: 'DIET',
        defaultRole: 'PARENT',
        isActive: true,
        createdBy: 'user-1',
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result._id).toBe('task-1');
      expect(result.assignedTo).toBe('user-1');
    });
  });

  describe('toTemplateOptions', () => {
    it('converts templates to options with name and _id', () => {
      const templates = [
        { _id: 't1', name: 'Template 1' },
        { _id: 't2', name: 'Template 2' },
      ] as TaskTemplate[];

      const options = toTemplateOptions(templates);

      expect(options).toEqual([
        { label: 'Template 1', value: 't1' },
        { label: 'Template 2', value: 't2' },
      ]);
    });

    it('uses id property if available', () => {
      const templates = [{ id: 'id-1', name: 'With ID' }] as any[];

      const options = toTemplateOptions(templates);

      expect(options[0].value).toBe('id-1');
    });

    it('uses _id as fallback when id is not available', () => {
      const templates = [{ _id: '_id-1', name: 'With _ID' }] as any[];

      const options = toTemplateOptions(templates);

      expect(options[0].value).toBe('_id-1');
    });

    it('uses default label for template without name', () => {
      const templates = [{ _id: 't1', name: '' }] as TaskTemplate[];

      const options = toTemplateOptions(templates);

      expect(options[0].label).toBe('Untitled template');
    });

    it('returns empty array for empty input', () => {
      const options = toTemplateOptions([]);
      expect(options).toEqual([]);
    });

    it('handles null/undefined input', () => {
      const options = toTemplateOptions(null as any);
      expect(options).toEqual([]);
    });
  });
});
