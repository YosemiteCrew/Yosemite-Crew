import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { Task as FhirTask } from "@yosemite-crew/fhir";
import { z } from "zod";
import { TaskService, TaskServiceError } from "src/services/task.service";
import { taskFhirMapper } from "src/services/fhir-task.mapper";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import { resolveUserIdFromRequest } from "src/utils/request";
import type { OrgRequest } from "src/middlewares/rbac";

const taskResourceSchema = z
  .object({ resourceType: z.literal("Task") })
  .passthrough();

const listQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  audience: z.union([z.string(), z.array(z.string())]).optional(),
});

const handleError = createFhirErrorHandler({
  isServiceError: (error): error is TaskServiceError =>
    error instanceof TaskServiceError,
  invalidPayloadMessage: "Invalid FHIR payload.",
  logMessage: "Unexpected FHIR task error",
});

const parseStatusList = (value?: string | string[]) => {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : value.split(",");
  const mapped = values
    .map((status) => taskFhirMapper.fromTaskStatus(status.trim()))
    .filter(Boolean);
  return mapped.length ? mapped : undefined;
};

const parseAudience = (value?: string | string[]) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "EMPLOYEE_TASK" || raw === "PARENT_TASK" ? raw : undefined;
};

const loadTaskOrThrow = async (input: {
  taskId: string;
  organisationId?: string;
  actorId?: string;
  canViewAny?: boolean;
}) => {
  const { taskId, organisationId, actorId, canViewAny } = input;
  const task = await TaskService.getById(taskId);
  if (!task) {
    throw new TaskServiceError("Task not found", 404);
  }

  if (organisationId && task.organisationId !== organisationId) {
    throw new TaskServiceError("Task does not belong to organisation", 403);
  }

  if (!canViewAny && actorId) {
    if (task.assignedTo !== actorId && task.createdBy !== actorId) {
      throw new TaskServiceError("Forbidden – insufficient permissions", 403);
    }
  }

  return task;
};

export const TaskFhirController = {
  async listEmployeeTasks(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const actorId = resolveUserIdFromRequest(req);
      const canViewAny =
        (req as OrgRequest).userPermissions?.includes("tasks:view:any") ??
        false;
      if (!canViewAny && !actorId) {
        throw new TaskServiceError("Forbidden – insufficient permissions", 403);
      }
      const tasks = await TaskService.listForEmployee({
        organisationId: req.params.organisationId,
        userId: canViewAny ? undefined : actorId,
        status: parseStatusList(query.status),
      });
      return res.status(200).json(taskFhirMapper.listBundle(tasks));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listCompanionTasks(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const tasks = await TaskService.listForCompanion({
        patientId: req.params.patientId,
        organisationId: req.query.organisationId as string | undefined,
        audience: parseAudience(query.audience),
        status: parseStatusList(query.status),
      });
      return res.status(200).json(taskFhirMapper.listBundle(tasks));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async create(
    req: Request<ParamsDictionary, unknown, unknown>,
    res: Response,
  ) {
    try {
      const body = taskResourceSchema.parse(req.body) as unknown as FhirTask;
      const userId = resolveUserIdFromRequest(req) ?? "";
      const input = taskFhirMapper.fromFhirTask(body, {
        organisationId: req.params.organisationId,
        createdBy: userId,
        assignedBy: userId,
      });

      const task = await TaskService.createCustom(input);
      const nextStatus = taskFhirMapper.fromTaskStatus(body.status);
      const hydrated =
        nextStatus !== "PENDING"
          ? (await TaskService.changeStatus(task.id, nextStatus, userId)).task
          : task;

      return res.status(201).json(taskFhirMapper.toFhirTask(hydrated));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const actorId = resolveUserIdFromRequest(req);
      const canViewAny =
        (req as OrgRequest).userPermissions?.includes("tasks:view:any") ??
        false;
      const task = await loadTaskOrThrow({
        taskId: req.params.taskId,
        organisationId: req.params.organisationId,
        actorId,
        canViewAny,
      });
      return res.status(200).json(taskFhirMapper.toFhirTask(task));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(
    req: Request<ParamsDictionary, unknown, unknown>,
    res: Response,
  ) {
    try {
      const body = taskResourceSchema.parse(req.body) as unknown as FhirTask;
      const userId = resolveUserIdFromRequest(req) ?? "";
      const canViewAny =
        (req as OrgRequest).userPermissions?.includes("tasks:view:any") ??
        false;
      await loadTaskOrThrow({
        taskId: req.params.taskId,
        organisationId: req.params.organisationId,
        actorId: userId,
        canViewAny,
      });
      const updated = await TaskService.updateTask(
        req.params.taskId,
        taskFhirMapper.toTaskUpdateInput(body),
        userId,
      );

      const nextStatus = taskFhirMapper.fromTaskStatus(body.status);
      const hydrated =
        nextStatus !== "PENDING"
          ? (await TaskService.changeStatus(updated.id, nextStatus, userId))
              .task
          : updated;

      return res.status(200).json(taskFhirMapper.toFhirTask(hydrated));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async changeStatus(req: Request, res: Response) {
    try {
      const body = taskResourceSchema.parse(req.body) as unknown as FhirTask;
      const nextStatus = taskFhirMapper.fromTaskStatus(body.status);
      const userId = resolveUserIdFromRequest(req) ?? "";
      const canViewAny =
        (req as OrgRequest).userPermissions?.includes("tasks:view:any") ??
        false;
      await loadTaskOrThrow({
        taskId: req.params.taskId,
        organisationId: req.params.organisationId,
        actorId: userId,
        canViewAny,
      });
      const { task } = await TaskService.changeStatus(
        req.params.taskId,
        nextStatus,
        userId,
      );
      return res.status(200).json(taskFhirMapper.toFhirTask(task));
    } catch (error) {
      return handleError(error, res);
    }
  },
};
