// controllers/task.controller.ts
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  CompleteTaskInput,
  CreateCustomTaskInput,
  CreateFromLibraryInput,
  CreateFromTemplateInput,
  TaskService,
  TaskServiceError,
  TaskAudience,
  TaskUpdateInput,
} from "src/services/task.service";
import { TaskLibraryService } from "src/services/taskLibrary.service";
import {
  CreateTaskTemplateInput,
  TaskTemplateService,
  UpdateTaskTemplateInput,
} from "src/services/taskTemplate.service";
import { TaskKind } from "src/models/taskLibraryDefinition";
import { TaskStatus } from "src/models/task";

type CreateCustomTaskRequestBody = Omit<
  CreateCustomTaskInput,
  "createdBy" | "assignedBy" | "assignedTo"
> & { assignedTo?: string };

type CreateFromLibraryRequestBody = Omit<
  CreateFromLibraryInput,
  "createdBy" | "assignedBy"
>;

type CreateFromTemplateRequestBody = Omit<
  CreateFromTemplateInput,
  "createdBy" | "assignedBy"
>;

type ChangeStatusRequestBody = {
  status?: TaskStatus;
  completion?: CompleteTaskInput;
};

type CreateTaskTemplateRequestBody = Omit<CreateTaskTemplateInput, "createdBy">;
type UpdateTaskTemplateRequestBody = UpdateTaskTemplateInput;

const TASK_STATUSES: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const parseStatusList = (
  status?: string | string[],
): TaskStatus[] | undefined => {
  if (!status) return undefined;
  const values = Array.isArray(status) ? status : status.split(",");
  const parsed = values.filter((value): value is TaskStatus =>
    TASK_STATUSES.includes(value as TaskStatus),
  );
  return parsed.length ? parsed : undefined;
};

const parseStatusValue = (
  status?: string | string[],
): TaskStatus | undefined => {
  if (!status) return undefined;
  const value = Array.isArray(status) ? status[0] : status;
  return TASK_STATUSES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : undefined;
};

const parseDateQuery = (value?: string | string[]): Date | undefined => {
  if (!value) return undefined;
  const str = Array.isArray(value) ? value[0] : value;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseAudience = (
  audience?: string | string[],
): TaskAudience | undefined => {
  if (!audience) return undefined;
  const value = Array.isArray(audience) ? audience[0] : audience;
  return value === "EMPLOYEE_TASK" || value === "PARENT_TASK"
    ? value
    : undefined;
};

const parseTaskKind = (kind?: string | string[]): TaskKind | undefined => {
  if (!kind) return undefined;
  const value = Array.isArray(kind) ? kind[0] : kind;
  return value === "MEDICATION" ||
    value === "OBSERVATION_TOOL" ||
    value === "HYGIENE" ||
    value === "DIET" ||
    value === "CUSTOM"
    ? value
    : undefined;
};

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TaskServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request): string => {
  const authReq = req as AuthenticatedRequest;

  const headerUser = req.headers["x-user-id"];
  if (headerUser && typeof headerUser === "string") return headerUser;

  return authReq.userId!;
};

export const TaskController = {
  // MOBILE — Create Custom Task
  createCustomTask: async (
    req: Request<ParamsDictionary, unknown, CreateCustomTaskRequestBody>,
    res: Response,
  ) => {
    try {
      const providerUserId = resolveUserId(req);
      const authUser =
        await AuthUserMobileService.getByProviderUserId(providerUserId);

      if (!authUser?.parentId) {
        return res.status(403).json({ message: "Parent account not found" });
      }

      const parentId = authUser.parentId.toString();

      const input: CreateCustomTaskInput = {
        ...req.body,
        createdBy: parentId,
        assignedBy: parentId,
        assignedTo: req.body.assignedTo ?? parentId, // fallback
      };

      const task = await TaskService.createCustom(input);
      res.status(201).json(task);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — Create From Library
  createFromLibrary: async (
    req: Request<ParamsDictionary, unknown, CreateFromLibraryRequestBody>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);

      const input: CreateFromLibraryInput = {
        ...req.body,
        createdBy: actorId,
        assignedBy: actorId,
      };

      const task = await TaskService.createFromLibrary(input);
      res.status(201).json(task);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — Create From Template
  createFromTemplate: async (
    req: Request<ParamsDictionary, unknown, CreateFromTemplateRequestBody>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);

      const input: CreateFromTemplateInput = {
        ...req.body,
        createdBy: actorId,
        assignedBy: actorId,
      };

      const task = await TaskService.createFromTemplate(input);
      res.status(201).json(task);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Get Task Detail
  getById: async (req: Request, res: Response) => {
    try {
      const task = await TaskService.getById(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      res.json(task);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Update Task
  updateTask: async (
    req: Request<{ taskId: string }, unknown, TaskUpdateInput>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);
      const taskId = req.params.taskId;

      const authUser = await AuthUserMobileService.getByProviderUserId(actorId);

      if (!authUser?.parentId) {
        return res.status(403).json({ message: "Parent account not found" });
      }

      const parentId = authUser.parentId.toString();

      const task = await TaskService.updateTask(taskId, req.body, parentId);
      res.json(task);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Change Status
  changeStatus: async (
    req: Request<{ taskId: string }, unknown, ChangeStatusRequestBody>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);

      const authUser = await AuthUserMobileService.getByProviderUserId(actorId);

      if (!authUser?.parentId) {
        return res.status(403).json({ message: "Parent account not found" });
      }

      const parentId = authUser.parentId.toString();

      const taskId = req.params.taskId;

      const status = parseStatusValue(req.body.status);
      const completion = req.body.completion;

      if (!status) {
        return res.status(400).json({ message: "Invalid task status" });
      }

      const result = await TaskService.changeStatus(
        taskId,
        status,
        parentId,
        completion,
      );
      res.json(result);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Mobile — List Parent Tasks
  listParentTasks: async (
    req: Request<
      ParamsDictionary,
      unknown,
      unknown,
      {
        companionId?: string;
        fromDueAt?: string;
        toDueAt?: string;
        status?: string;
      }
    >,
    res: Response,
  ) => {
    try {
      const providerUserId = resolveUserId(req);
      const authUser =
        await AuthUserMobileService.getByProviderUserId(providerUserId);

      const parentId = authUser?.parentId?.toString();
      if (!parentId)
        return res.status(403).json({ message: "Parent not found" });

      const tasks = await TaskService.listForParent({
        parentId,
        companionId: req.query.companionId,
        fromDueAt: parseDateQuery(req.query.fromDueAt),
        toDueAt: parseDateQuery(req.query.toDueAt),
        status: parseStatusList(req.query.status),
      });

      res.json(tasks);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — List Employee Tasks
  listEmployeeTasks: async (
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      {
        userId?: string;
        companionId?: string;
        fromDueAt?: string;
        toDueAt?: string;
        status?: string;
      }
    >,
    res: Response,
  ) => {
    try {
      const { organisationId } = req.params; // override param
      const userId = req.query.userId;

      const tasks = await TaskService.listForEmployee({
        organisationId,
        userId,
        companionId: req.query.companionId,
        fromDueAt: parseDateQuery(req.query.fromDueAt),
        toDueAt: parseDateQuery(req.query.toDueAt),
        status: parseStatusList(req.query.status),
      });

      res.json(tasks);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Companion Task List
  listForCompanion: async (
    req: Request<
      { companionId: string },
      unknown,
      unknown,
      {
        audience?: string;
        fromDueAt?: string;
        toDueAt?: string;
        status?: string;
      }
    >,
    res: Response,
  ) => {
    try {
      const tasks = await TaskService.listForCompanion({
        companionId: req.params.companionId,
        audience: parseAudience(req.query.audience),
        fromDueAt: parseDateQuery(req.query.fromDueAt),
        toDueAt: parseDateQuery(req.query.toDueAt),
        status: parseStatusList(req.query.status),
      });

      res.json(tasks);
    } catch (error) {
      handleError(error, res);
    }
  },
};

export const TaskLibraryController = {
  list: async (
    req: Request<
      unknown,
      unknown,
      unknown,
      {
        kind?: string;
      }
    >,
    res: Response,
  ) => {
    try {
      const kind = parseTaskKind(req.query.kind);
      const items = await TaskLibraryService.listActive(kind);
      res.json(items);
    } catch (error) {
      handleError(error, res);
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const id = req.params.libraryId;
      const item = await TaskLibraryService.getById(id);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },
};

export const TaskTemplateController = {
  create: async (
    req: Request<ParamsDictionary, unknown, CreateTaskTemplateRequestBody>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);
      const data: CreateTaskTemplateInput = {
        ...req.body,
        createdBy: actorId,
      };

      const doc = await TaskTemplateService.create(data);
      res.status(201).json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },

  update: async (
    req: Request<
      { templateId: string },
      unknown,
      UpdateTaskTemplateRequestBody
    >,
    res: Response,
  ) => {
    try {
      const id = req.params.templateId;
      const doc = await TaskTemplateService.update(id, req.body);
      res.json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },

  archive: async (req: Request, res: Response) => {
    try {
      await TaskTemplateService.archive(req.params.templateId);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },

  list: async (
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      { kind?: string }
    >,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.organisationId;
      const kind = parseTaskKind(req.query.kind);
      const docs = await TaskTemplateService.listForOrganisation(
        organisationId,
        kind,
      );
      res.json(docs);
    } catch (error) {
      handleError(error, res);
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const doc = await TaskTemplateService.getById(req.params.templateId);
      res.json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },
};
