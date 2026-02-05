import {
  validateTaskForm,
  buildTaskTemplate,
  applyTemplateToForm,
  toTemplateOptions,
  TaskFormErrors,
} from "@/app/lib/taskForm";
import { Task, TaskTemplate, TaskLibrary } from "@/app/features/tasks/types/task";

describe("taskForm utilities", () => {
  describe("validateTaskForm", () => {
    const baseTask: Task = {
      _id: "task-1",
      name: "Test Task",
      assignedTo: "user-1",
      category: "MEDICATION",
      source: "CUSTOM",
      status: "PENDING",
      audience: "PARENT_TASK",
      dueAt: new Date(),
    };

    it("returns empty errors for valid task", () => {
      const errors = validateTaskForm(baseTask);
      expect(errors).toEqual({});
    });

    it("returns error when assignedTo is missing", () => {
      const task = { ...baseTask, assignedTo: "" };
      const errors = validateTaskForm(task);
      expect(errors.assignedTo).toBe("Please select a companion or staff");
    });

    it("returns error when name is missing", () => {
      const task = { ...baseTask, name: "" };
      const errors = validateTaskForm(task);
      expect(errors.name).toBe("Name is required");
    });

    it("returns error when category is missing", () => {
      const task = { ...baseTask, category: "" as any };
      const errors = validateTaskForm(task);
      expect(errors.category).toBe("Category is required");
    });

    it("returns error when source is ORG_TEMPLATE but templateId is missing", () => {
      const task = { ...baseTask, source: "ORG_TEMPLATE" as const, templateId: "" };
      const errors = validateTaskForm(task);
      expect(errors.templateId).toBe("Template is required");
    });

    it("returns no templateId error when source is ORG_TEMPLATE with templateId", () => {
      const task = {
        ...baseTask,
        source: "ORG_TEMPLATE" as const,
        templateId: "template-123",
      };
      const errors = validateTaskForm(task);
      expect(errors.templateId).toBeUndefined();
    });

    it("returns error when source is YC_LIBRARY but libraryTaskId is missing", () => {
      const task = {
        ...baseTask,
        source: "YC_LIBRARY" as const,
        libraryTaskId: "",
      };
      const errors = validateTaskForm(task);
      expect(errors.libraryTaskId).toBe("Library task is required");
    });

    it("returns no libraryTaskId error when source is YC_LIBRARY with libraryTaskId", () => {
      const task = {
        ...baseTask,
        source: "YC_LIBRARY" as const,
        libraryTaskId: "lib-123",
      };
      const errors = validateTaskForm(task);
      expect(errors.libraryTaskId).toBeUndefined();
    });

    it("returns multiple errors when multiple fields are invalid", () => {
      const task = {
        ...baseTask,
        name: "",
        assignedTo: "",
        category: "" as any,
      };
      const errors = validateTaskForm(task);
      expect(Object.keys(errors).length).toBe(3);
      expect(errors.name).toBeDefined();
      expect(errors.assignedTo).toBeDefined();
      expect(errors.category).toBeDefined();
    });
  });

  describe("buildTaskTemplate", () => {
    it("builds template from task with EMPLOYEE_TASK audience", () => {
      const task: Task = {
        _id: "task-1",
        name: "Employee Task",
        description: "Test description",
        category: "MEDICATION",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-1",
        source: "CUSTOM",
        dueAt: new Date(),
        status: "PENDING",
      };

      const template = buildTaskTemplate(task);

      expect(template._id).toBe("");
      expect(template.source).toBe("ORG_TEMPLATE");
      expect(template.category).toBe("MEDICATION");
      expect(template.name).toBe("Employee Task");
      expect(template.description).toBe("Test description");
      expect(template.defaultRole).toBe("EMPLOYEE");
      expect(template.isActive).toBe(true);
    });

    it("builds template from task with COMPANION_TASK audience", () => {
      const task: Task = {
        _id: "task-1",
        name: "Companion Task",
        description: "Companion description",
        category: "DIET",
        audience: "PARENT_TASK",
        assignedTo: "user-1",
        source: "CUSTOM",
        dueAt: new Date(),
        status: "PENDING",
      };

      const template = buildTaskTemplate(task);

      expect(template.defaultRole).toBe("PARENT");
      expect(template.category).toBe("DIET");
    });

    it("builds template with empty description", () => {
      const task: Task = {
        _id: "task-1",
        name: "No Description Task",
        description: "",
        category: "HYGIENE",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-1",
        source: "CUSTOM",
        dueAt: new Date(),
        status: "PENDING",
      };

      const template = buildTaskTemplate(task);

      expect(template.description).toBe("");
    });
  });

  describe("applyTemplateToForm", () => {
    const baseTask: Task = {
      _id: "task-1",
      name: "Original Name",
      description: "Original description",
      category: "MEDICATION",
      assignedTo: "user-1",
      audience: "EMPLOYEE_TASK",
      source: "CUSTOM",
      dueAt: new Date(),
      status: "PENDING",
    };

    it("applies TaskTemplate to form data", () => {
      const template: TaskTemplate = {
        _id: "template-1",
        name: "Template Name",
        description: "Template description",
        kind: "DIET",
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        category: "DIET",
        defaultRole: "PARENT",
        isActive: true,
        createdBy: "user-1",
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result.name).toBe("Template Name");
      expect(result.description).toBe("Template description");
      expect(result.category).toBe("DIET");
      expect(result.assignedTo).toBe("user-1");
    });

    it("applies TaskLibrary to form data using defaultDescription", () => {
      const library: TaskLibrary = {
        _id: "lib-1",
        name: "Library Task",
        defaultDescription: "Library default description",
        kind: "HYGIENE",
        source: "YC_LIBRARY",
        category: "HYGIENE",
        schema: {},
        isActive: true,
      };

      const result = applyTemplateToForm(baseTask, library);

      expect(result.name).toBe("Library Task");
      expect(result.description).toBe("Library default description");
      expect(result.category).toBe("HYGIENE");
    });

    it("handles template with empty name", () => {
      const template: TaskTemplate = {
        _id: "template-1",
        name: "",
        kind: "MEDICATION",
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        category: "MEDICATION",
        defaultRole: "PARENT",
        isActive: true,
        createdBy: "user-1",
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result.name).toBe("");
    });

    it("handles template with undefined description", () => {
      const template = {
        _id: "template-1",
        name: "Template",
        kind: "MEDICATION",
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        category: "MEDICATION",
        defaultRole: "PARENT",
        isActive: true,
        createdBy: "user-1",
      } as TaskTemplate;

      const result = applyTemplateToForm(baseTask, template);

      expect(result.description).toBe("");
    });

    it("preserves other task fields", () => {
      const template: TaskTemplate = {
        _id: "template-1",
        name: "Template",
        kind: "DIET",
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        category: "DIET",
        defaultRole: "PARENT",
        isActive: true,
        createdBy: "user-1",
      };

      const result = applyTemplateToForm(baseTask, template);

      expect(result._id).toBe("task-1");
      expect(result.assignedTo).toBe("user-1");
    });
  });

  describe("toTemplateOptions", () => {
    it("converts templates to options with name and _id", () => {
      const templates = [
        { _id: "t1", name: "Template 1" },
        { _id: "t2", name: "Template 2" },
      ] as TaskTemplate[];

      const options = toTemplateOptions(templates);

      expect(options).toEqual([
        { label: "Template 1", value: "t1" },
        { label: "Template 2", value: "t2" },
      ]);
    });

    it("uses id property if available", () => {
      const templates = [{ id: "id-1", name: "With ID" }] as any[];

      const options = toTemplateOptions(templates);

      expect(options[0].value).toBe("id-1");
    });

    it("uses _id as fallback when id is not available", () => {
      const templates = [{ _id: "_id-1", name: "With _ID" }] as any[];

      const options = toTemplateOptions(templates);

      expect(options[0].value).toBe("_id-1");
    });

    it("uses default label for template without name", () => {
      const templates = [{ _id: "t1", name: "" }] as TaskTemplate[];

      const options = toTemplateOptions(templates);

      expect(options[0].label).toBe("Untitled template");
    });

    it("returns empty array for empty input", () => {
      const options = toTemplateOptions([]);
      expect(options).toEqual([]);
    });

    it("handles null/undefined input", () => {
      const options = toTemplateOptions(null as any);
      expect(options).toEqual([]);
    });
  });
});
