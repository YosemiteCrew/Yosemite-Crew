// controllers/task.controller.ts
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { AuthenticatedRequest } from "src/middlewares/auth";
import type { OrgRequest } from "src/middlewares/rbac";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  isTaskCategory,
  isTaskKind,
  type TaskCategory,
} from "@yosemite-crew/types";
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
import {
  CreateTaskLibraryDefinitionInput,
  TaskLibraryService,
  UpdateTaskLibraryDefinitionInput,
} from "src/services/taskLibrary.service";
import {
  CreateTaskTemplateInput,
  TaskTemplateService,
  UpdateTaskTemplateInput,
} from "src/services/taskTemplate.service";
import { TaskKind, TaskStatus } from "@prisma/client";

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

const TASK_STATUSES = new Set<TaskStatus>([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
const pickFirstQueryValue = (value?: string | string[]): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const parseStatusList = (
  status?: string | string[],
): TaskStatus[] | undefined => {
  if (!status) return undefined;
  const values = Array.isArray(status) ? status : status.split(",");
  const parsed = values.filter((value): value is TaskStatus =>
    TASK_STATUSES.has(value as TaskStatus),
  );
  return parsed.length ? parsed : undefined;
};

const parseStatusValue = (
  status?: string | string[],
): TaskStatus | undefined => {
  if (!status) return undefined;
  const value = Array.isArray(status) ? status[0] : status;
  return TASK_STATUSES.has(value as TaskStatus)
    ? (value as TaskStatus)
    : undefined;
};

const parseDateQuery = (value?: string | string[]): Date | undefined => {
  if (!value) return undefined;
  const str = Array.isArray(value) ? value[0] : value;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseBooleanQuery = (
  value?: boolean | string | string[],
): boolean | undefined => {
  if (typeof value === "boolean") return value;
  const str = pickFirstQueryValue(value);
  if (str === undefined) return undefined;
  if (str === "true" || str === "1") return true;
  if (str === "false" || str === "0") return false;
  return undefined;
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
  return typeof value === "string" && isTaskKind(value) ? value : undefined;
};

const parseTaskCategory = (
  category?: string | string[],
): TaskCategory | undefined => {
  if (!category) return undefined;
  const value = pickFirstQueryValue(category);
  return value && isTaskCategory(value) ? value : undefined;
};

type TaskListQuery = {
  userId?: string;
  assignedTo?: string;
  patientId?: string;
  companionId?: string;
  clientId?: string;
  appointmentId?: string;
  encounterId?: string;
  episodeOfCareId?: string;
  admissionId?: string;
  templateInstanceId?: string;
  scheduleId?: string;
  audience?: string;
  assignedRole?: string;
  status?: string | string[];
  category?: string | string[];
  subcategory?: string | string[];
  kind?: string | string[];
  dueFrom?: string | string[];
  dueTo?: string | string[];
  fromDueAt?: string | string[];
  toDueAt?: string | string[];
  includeCompleted?: boolean | string | string[];
};

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TaskServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (
  req: Request<ParamsDictionary, unknown, unknown, Record<string, unknown>>,
): string => {
  const authReq = req as AuthenticatedRequest;
  return typeof authReq.userId === "string" ? authReq.userId : "";
};

const hasPermission = (
  req: { userPermissions?: OrgRequest["userPermissions"] },
  permission: string,
): boolean => Boolean(req.userPermissions?.includes(permission as never));

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

  // PMS — Create Custom Task
  createCustomTaskFromPms: async (
    req: Request<ParamsDictionary, unknown, CreateCustomTaskInput>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);

      const input: CreateCustomTaskInput = {
        ...req.body,
        createdBy: actorId,
        assignedBy: actorId,
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
      const actorId = resolveUserId(req);
      const canViewAny = hasPermission(req as OrgRequest, "tasks:view:any");
      const task = await TaskService.getById(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (!canViewAny) {
        if (
          !actorId ||
          (task.assignedTo !== actorId && task.createdBy !== actorId)
        ) {
          return res
            .status(403)
            .json({ message: "Forbidden – insufficient permissions" });
        }
      }

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

  updateTaskPMS: async (
    req: Request<{ taskId: string }, unknown, TaskUpdateInput>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);
      const taskId = req.params.taskId;

      if (!actorId) {
        return res.status(403).json({ message: "Account not found" });
      }

      const task = await TaskService.updateTask(taskId, req.body, actorId);
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

  // PMS — Change Status
  changeStatusPMS: async (
    req: Request<{ taskId: string }, unknown, ChangeStatusRequestBody>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);
      if (!actorId) {
        return res.status(403).json({ message: "Account not found" });
      }

      const taskId = req.params.taskId;
      const status = parseStatusValue(req.body.status);
      const completion = req.body.completion;

      if (!status) {
        return res.status(400).json({ message: "Invalid task status" });
      }

      const result = await TaskService.changeStatus(
        taskId,
        status,
        actorId,
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
        patientId?: string;
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
        patientId: req.query.patientId,
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
    req: Request<{ organisationId: string }, unknown, unknown, TaskListQuery>,
    res: Response,
  ) => {
    try {
      const actorId = resolveUserId(req);
      const canViewAny = hasPermission(req as OrgRequest, "tasks:view:any");
      if (!canViewAny && !actorId) {
        return res.status(403).json({ message: "Account not found" });
      }

      const organisationId =
        (req as OrgRequest).organisationId ?? req.params.organisationId;
      const requestedAssignedTo = req.query.assignedTo ?? req.query.userId;
      const assignedTo = canViewAny ? requestedAssignedTo : actorId;
      const audience =
        parseAudience(req.query.audience) ??
        parseAudience(req.query.assignedRole);

      const tasks = await TaskService.listForEmployee({
        organisationId,
        userId: assignedTo,
        assignedTo,
        patientId:
          req.query.patientId ?? req.query.companionId ?? req.query.clientId,
        companionId: req.query.companionId,
        clientId: req.query.clientId,
        appointmentId: pickFirstQueryValue(req.query.appointmentId),
        encounterId: pickFirstQueryValue(req.query.encounterId),
        episodeOfCareId: pickFirstQueryValue(req.query.episodeOfCareId),
        admissionId: pickFirstQueryValue(req.query.admissionId),
        templateInstanceId: pickFirstQueryValue(req.query.templateInstanceId),
        scheduleId: pickFirstQueryValue(req.query.scheduleId),
        audience,
        assignedRole: parseAudience(req.query.assignedRole),
        status: parseStatusList(req.query.status),
        category: parseTaskCategory(req.query.category),
        subcategory: pickFirstQueryValue(req.query.subcategory),
        kind: parseTaskKind(req.query.kind),
        dueFrom:
          parseDateQuery(req.query.dueFrom) ??
          parseDateQuery(req.query.fromDueAt),
        dueTo:
          parseDateQuery(req.query.dueTo) ?? parseDateQuery(req.query.toDueAt),
        includeCompleted: parseBooleanQuery(req.query.includeCompleted),
      });

      res.json(tasks);
    } catch (error) {
      handleError(error, res);
    }
  },

  // Companion Task List
  listForCompanion: async (
    req: Request<{ patientId: string }, unknown, unknown, TaskListQuery>,
    res: Response,
  ) => {
    try {
      const organisationId = (req as OrgRequest).organisationId;
      const tasks = await TaskService.listForCompanion({
        patientId: req.params.patientId,
        organisationId,
        audience: parseAudience(req.query.audience),
        companionId: req.query.companionId,
        clientId: req.query.clientId,
        assignedTo: pickFirstQueryValue(req.query.assignedTo),
        assignedRole: parseAudience(req.query.assignedRole),
        appointmentId: pickFirstQueryValue(req.query.appointmentId),
        encounterId: pickFirstQueryValue(req.query.encounterId),
        episodeOfCareId: pickFirstQueryValue(req.query.episodeOfCareId),
        admissionId: pickFirstQueryValue(req.query.admissionId),
        templateInstanceId: pickFirstQueryValue(req.query.templateInstanceId),
        scheduleId: pickFirstQueryValue(req.query.scheduleId),
        status: parseStatusList(req.query.status),
        category: parseTaskCategory(req.query.category),
        subcategory: pickFirstQueryValue(req.query.subcategory),
        kind: parseTaskKind(req.query.kind),
        dueFrom:
          parseDateQuery(req.query.dueFrom) ??
          parseDateQuery(req.query.fromDueAt),
        dueTo:
          parseDateQuery(req.query.dueTo) ?? parseDateQuery(req.query.toDueAt),
        includeCompleted: parseBooleanQuery(req.query.includeCompleted),
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

  create: async (
    req: Request<ParamsDictionary, unknown, CreateTaskLibraryDefinitionInput>,
    res: Response,
  ) => {
    try {
      const doc = await TaskLibraryService.create(req.body);
      res.status(201).json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },

  update: async (
    req: Request<
      { libraryId: string },
      unknown,
      UpdateTaskLibraryDefinitionInput
    >,
    res: Response,
  ) => {
    try {
      const doc = await TaskLibraryService.update(
        req.params.libraryId,
        req.body,
      );
      res.json(doc);
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
      { kind?: string; inpatientOnly?: string; search?: string }
    >,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.organisationId;
      const kind = parseTaskKind(req.query.kind);
      const inpatientOnly =
        req.query.inpatientOnly === "true"
          ? true
          : req.query.inpatientOnly === "false"
            ? false
            : undefined;
      const docs = await TaskTemplateService.listForOrganisation(
        organisationId,
        kind,
        {
          inpatientOnly,
          search: req.query.search,
        },
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
