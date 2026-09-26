import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { type Router } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * The mobile observation-tool routes end to end: the real router, companion
 * access middleware, controller and service over an in-memory database whose
 * `where` matching follows Prisma's rules (an `undefined` field is dropped).
 */

type Row = Record<string, unknown>;

const mockDb: Record<string, Row[]> = {};

const mockMatches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (condition && typeof condition === "object") {
      const filter = condition as { in?: unknown[]; not?: unknown };
      if (Array.isArray(filter.in)) return filter.in.includes(row[key]);
      if ("not" in filter) return row[key] !== filter.not;
    }
    return row[key] === condition;
  });

const mockTable = (name: string) => {
  const find = jest.fn(
    async ({ where }: { where?: Row } = {}) =>
      mockDb[name].find((row) => mockMatches(row, where)) ?? null,
  );
  return {
    findFirst: find,
    findUnique: find,
    create: jest.fn(async ({ data }: { data: Row }) => {
      const row = {
        id: `${name}-${mockDb[name].length + 1}`,
        taskId: null,
        evaluationAppointmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      mockDb[name].push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = mockDb[name].find((entry) => mockMatches(entry, where));
      if (!row) throw new Error(`${name} not found`);
      Object.assign(row, data);
      return row;
    }),
  };
};

const mockPrisma = {
  authUserMobile: mockTable("authUserMobile"),
  parentPatient: mockTable("parentPatient"),
  task: mockTable("task"),
  observationToolSubmission: mockTable("observationToolSubmission"),
  observationToolDefinition: mockTable("observationToolDefinition"),
  appointment: mockTable("appointment"),
  patientOrganisation: mockTable("patientOrganisation"),
};

const mockTaskService = {
  changeStatus: jest.fn(),
  linkToAppointment: jest.fn(),
};

jest.mock("src/config/prisma", () => ({ prisma: mockPrisma }));
jest.mock("src/services/task.service", () => ({
  TaskService: mockTaskService,
}));
jest.mock("src/middlewares/super-admin", () => ({
  requireSuperAdmin: jest.fn(),
}));
jest.mock("src/middlewares/auth", () => {
  const signIn = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const user = req.headers["x-test-user"];
    if (typeof user !== "string") {
      res.status(401).json({ message: "Unauthenticated" });
      return;
    }
    (req as express.Request & { userId?: string }).userId = user;
    next();
  };
  return { requireMobileAuth: signIn, requireWebAuth: signIn };
});

const ALL_OFF = {
  appointments: false,
  medicalRecords: false,
  chatWithVet: false,
  companionProfile: false,
  documents: false,
  emergencyBasedPermissions: false,
  expenses: false,
  tasks: false,
};

// Caller (session user) -> parent, and each parent's link to companion pat-1.
const PARENTS = {
  owner: "par-owner",
  coParent: "par-co-yes",
  coParentWithout: "par-co-no",
  otherParent: "par-other",
  pending: "par-pending",
  revoked: "par-revoked",
} as const;
type Caller = keyof typeof PARENTS;

const seed = () => {
  mockDb.authUserMobile = Object.entries(PARENTS).map(([user, parentId]) => ({
    id: `auth-${user}`,
    authProvider: "supertokens",
    providerUserId: user,
    email: `${user}@example.test`,
    parentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockDb.parentPatient = [
    // A primary parent needs no feature flag.
    {
      parentId: PARENTS.owner,
      patientId: "pat-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: ALL_OFF,
    },
    {
      parentId: PARENTS.coParent,
      patientId: "pat-1",
      role: "CO_PARENT",
      status: "ACTIVE",
      permissions: { ...ALL_OFF, medicalRecords: true, appointments: true },
    },
    {
      parentId: PARENTS.coParentWithout,
      patientId: "pat-1",
      role: "CO_PARENT",
      status: "ACTIVE",
      permissions: ALL_OFF,
    },
    {
      parentId: PARENTS.pending,
      patientId: "pat-1",
      role: "CO_PARENT",
      status: "PENDING",
      permissions: { ...ALL_OFF, medicalRecords: true, appointments: true },
    },
    {
      parentId: PARENTS.revoked,
      patientId: "pat-1",
      role: "PRIMARY",
      status: "REVOKED",
      permissions: ALL_OFF,
    },
    {
      parentId: PARENTS.otherParent,
      patientId: "pat-2",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: ALL_OFF,
    },
  ];
  mockDb.observationToolDefinition = [
    {
      id: "tool-1",
      name: "Comfort score",
      category: "Pain",
      isActive: true,
      fields: [{ key: "q1", scoring: { points: 2 } }],
    },
  ];
  mockDb.task = [
    {
      id: "task-1",
      patientId: "pat-1",
      organisationId: "org-a",
      observationToolId: "tool-1",
      assignedTo: PARENTS.owner,
    },
    {
      id: "task-2",
      patientId: "pat-2",
      organisationId: "org-a",
      observationToolId: "tool-1",
      assignedTo: PARENTS.otherParent,
    },
    {
      id: "task-3",
      patientId: "pat-1",
      organisationId: "org-a",
      observationToolId: "tool-1",
      assignedTo: PARENTS.owner,
    },
  ];
  mockDb.observationToolSubmission = [
    {
      id: "sub-1",
      toolId: "tool-1",
      taskId: "task-1",
      patientId: "pat-1",
      filledBy: PARENTS.owner,
      answers: { q1: "yes" },
      score: 2,
      summary: "Settled overnight",
      evaluationAppointmentId: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-01T10:00:00Z"),
    },
  ];
  mockDb.appointment = [
    { id: "appt-1", organisationId: "org-a", patient: { id: "pat-1" } },
    {
      id: "appt-other-companion",
      organisationId: "org-a",
      patient: { id: "pat-2" },
    },
    { id: "appt-other-org", organisationId: "org-b", patient: { id: "pat-1" } },
  ];
  mockDb.patientOrganisation = [];
};

let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  const router = jest.requireActual<{ default: Router }>(
    "src/routers/observationTool.routes",
  ).default;
  const app = express();
  app.use(express.json());
  app.use("/v1/observation-tools", router);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/observation-tools`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

const call = async (
  method: "GET" | "POST",
  path: string,
  caller?: Caller,
  body?: unknown,
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(caller ? { "x-test-user": caller } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Row | null,
  };
};

const submission = (id: string) =>
  mockDb.observationToolSubmission.find((row) => row.id === id);

describe("GET /mobile/tasks/:taskId/preview", () => {
  const preview = (caller?: Caller, taskId = "task-1") =>
    call("GET", `/mobile/tasks/${taskId}/preview`, caller);

  it.each<Caller>(["owner", "coParent"])(
    "returns the latest submission to a permitted caller (%s)",
    async (caller) => {
      const { status, body } = await preview(caller);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        taskId: "task-1",
        toolId: "tool-1",
        submissionId: "sub-1",
        score: 2,
        summary: "Settled overnight",
        answersPreview: { q1: "yes" },
      });
    },
  );

  it("returns 404 for another parent's task, exactly as for a missing task", async () => {
    const hidden = await preview("otherParent");
    const missing = await preview("otherParent", "no-such-task");

    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(missing.body);
    expect(hidden.body).not.toHaveProperty("submissionId");
  });

  it("returns 404 for a task of a companion the caller has no link to", async () => {
    const { status, body } = await preview("owner", "task-2");

    expect(status).toBe(404);
    expect(body).not.toHaveProperty("score");
  });

  it.each<Caller>(["pending", "revoked"])(
    "returns 404 to a %s link",
    async (caller) => {
      const { status, body } = await preview(caller);

      expect(status).toBe(404);
      expect(body).not.toHaveProperty("summary");
    },
  );

  it("returns 403 to a co-parent without the medical records permission", async () => {
    const { status, body } = await preview("coParentWithout");

    expect(status).toBe(403);
    expect(body).not.toHaveProperty("answersPreview");
  });

  it("returns 401 without a session", async () => {
    expect((await preview()).status).toBe(401);
  });
});

describe("POST /mobile/submissions/:submissionId/link-appointment", () => {
  const link = (
    caller: Caller,
    appointmentId: string,
    submissionId = "sub-1",
  ) =>
    call(
      "POST",
      `/mobile/submissions/${submissionId}/link-appointment`,
      caller,
      {
        appointmentId,
      },
    );

  it.each<Caller>(["owner", "coParent"])(
    "links the submission and its task to the companion's appointment (%s)",
    async (caller) => {
      const { status, body } = await link(caller, "appt-1");

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: "sub-1",
        evaluationAppointmentId: "appt-1",
      });
      expect(submission("sub-1")?.evaluationAppointmentId).toBe("appt-1");
      expect(mockTaskService.linkToAppointment).toHaveBeenCalledWith({
        taskId: "task-1",
        appointmentId: "appt-1",
      });
    },
  );

  it("returns 404 for another parent's submission, exactly as for a missing one", async () => {
    const hidden = await link("otherParent", "appt-other-companion");
    const missing = await link(
      "otherParent",
      "appt-other-companion",
      "no-such-sub",
    );

    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(missing.body);
    expect(hidden.body).not.toHaveProperty("answers");
    expect(submission("sub-1")?.evaluationAppointmentId).toBeNull();
    expect(mockTaskService.linkToAppointment).not.toHaveBeenCalled();
  });

  it.each<Caller>(["pending", "revoked"])(
    "returns 404 to a %s link and changes nothing",
    async (caller) => {
      const { status } = await link(caller, "appt-1");

      expect(status).toBe(404);
      expect(submission("sub-1")?.evaluationAppointmentId).toBeNull();
    },
  );

  it("returns 403 to a co-parent without the appointments permission", async () => {
    const { status } = await link("coParentWithout", "appt-1");

    expect(status).toBe(403);
    expect(submission("sub-1")?.evaluationAppointmentId).toBeNull();
  });

  it.each(["appt-other-companion", "appt-other-org", "no-such-appointment"])(
    "returns 404 for appointment %s and changes nothing",
    async (appointmentId) => {
      const { status, body } = await link("owner", appointmentId);

      expect(status).toBe(404);
      expect(body).toEqual({ message: "Appointment not found" });
      expect(submission("sub-1")?.evaluationAppointmentId).toBeNull();
      expect(
        mockPrisma.observationToolSubmission.update,
      ).not.toHaveBeenCalled();
      expect(mockTaskService.linkToAppointment).not.toHaveBeenCalled();
    },
  );
});

describe("POST /mobile/tools/:toolId/submissions", () => {
  const create = (caller: Caller, body: Row) =>
    call("POST", "/mobile/tools/tool-1/submissions", caller, body);
  const created = () => mockDb.observationToolSubmission.slice(1);

  it.each<Caller>(["owner", "coParent"])(
    "records a submission for the companion (%s)",
    async (caller) => {
      const { status, body } = await create(caller, {
        patientId: "pat-1",
        answers: { q1: "yes" },
      });

      expect(status).toBe(201);
      expect(body).toMatchObject({
        patientId: "pat-1",
        filledBy: PARENTS[caller],
        score: 2,
      });
      expect(created()).toHaveLength(1);
    },
  );

  it("completes the caller's own task", async () => {
    const { status } = await create("owner", {
      patientId: "pat-1",
      taskId: "task-3",
      answers: { q1: "yes" },
    });

    expect(status).toBe(201);
    expect(mockTaskService.changeStatus).toHaveBeenCalledWith(
      "task-3",
      "COMPLETED",
      PARENTS.owner,
      expect.anything(),
    );
  });

  it("returns 404 for another parent's companion and records nothing", async () => {
    const { status } = await create("otherParent", {
      patientId: "pat-1",
      answers: { q1: "yes" },
    });

    expect(status).toBe(404);
    expect(created()).toHaveLength(0);
  });

  it.each<Caller>(["pending", "revoked"])(
    "returns 404 to a %s link and records nothing",
    async (caller) => {
      const { status } = await create(caller, {
        patientId: "pat-1",
        answers: { q1: "yes" },
      });

      expect(status).toBe(404);
      expect(created()).toHaveLength(0);
    },
  );

  it("returns 403 to a co-parent without the medical records permission", async () => {
    const { status } = await create("coParentWithout", {
      patientId: "pat-1",
      answers: { q1: "yes" },
    });

    expect(status).toBe(403);
    expect(created()).toHaveLength(0);
  });

  it.each([{ not: "" }, ["pat-1"], undefined])(
    "returns 404 for a patientId that is not a plain id (%j) and records nothing",
    async (patientId) => {
      const { status } = await create("owner", {
        patientId,
        answers: { q1: "yes" },
      });

      expect(status).toBe(404);
      expect(created()).toHaveLength(0);
      expect(mockPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
    },
  );

  it("answers another companion's task like a missing task and records nothing", async () => {
    const hidden = await create("owner", {
      patientId: "pat-1",
      taskId: "task-2",
      answers: { q1: "yes" },
    });
    const missing = await create("owner", {
      patientId: "pat-1",
      taskId: "no-such-task",
      answers: { q1: "yes" },
    });

    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(missing.body);
    expect(created()).toHaveLength(0);
    expect(mockTaskService.changeStatus).not.toHaveBeenCalled();
  });
});
