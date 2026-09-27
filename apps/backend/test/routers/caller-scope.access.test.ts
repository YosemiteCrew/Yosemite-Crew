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
 * Who gets through to the adverse-event, expense, task and chat handlers.
 *
 * The real routers, permission middleware and companion access middleware run
 * over an in-memory database whose `where` matching follows Prisma's rules (an
 * `undefined` field is dropped). Handlers are stubs that answer 200, so every
 * case shows only whether the caller was let through.
 */

type Row = Record<string, unknown>;

const mockDb: Record<string, Row[]> = {};

const mockMatches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (key === "OR") {
      return (condition as Row[]).some((option) => mockMatches(row, option));
    }
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
    updateMany: jest.fn(async () => ({ count: 1 })),
  };
};

const mockPrisma = {
  authUserMobile: mockTable("authUserMobile"),
  parentPatient: mockTable("parentPatient"),
  userOrganization: mockTable("userOrganization"),
  appointment: mockTable("appointment"),
  adverseEventReport: mockTable("adverseEventReport"),
  taskTemplate: mockTable("taskTemplate"),
};

const mockReached = jest.fn((req: express.Request, res: express.Response) => {
  res.status(200).json({
    reached: true,
    organisationId: (req as express.Request & { organisationId?: string })
      .organisationId,
  });
});

/** A controller whose every handler is the 200 stub. */
const mockController = () => new Proxy({}, { get: () => mockReached });

jest.mock("src/config/prisma", () => ({ prisma: mockPrisma }));
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
    const roles = req.headers["x-test-roles"];
    Object.assign(req, {
      userId: user,
      authSession: {
        providerUserId: user,
        appUserId: user,
        roles: typeof roles === "string" ? roles.split(",") : [],
      },
    });
    next();
  };
  return {
    requireMobileAuth: signIn,
    requireWebAuth: signIn,
    requireAnyAuth: signIn,
    attachSessionIfPresent: signIn,
  };
});
jest.mock("@yosemite-crew/auth", () => ({
  ...jest.requireActual<Record<string, unknown>>("@yosemite-crew/auth"),
  getAuthService: () => ({ getUserRoles: async () => [] }),
}));
jest.mock("src/controllers/web/adverse-event.controller", () => ({
  AdverseEventController: mockController(),
}));
jest.mock("src/controllers/app/expense.controller", () => ({
  ExpenseController: mockController(),
}));
jest.mock("src/controllers/web/task.controller", () => ({
  TaskController: mockController(),
  TaskLibraryController: mockController(),
  TaskTemplateController: mockController(),
}));
jest.mock("src/controllers/app/task-recommendation.controller", () => ({
  TaskRecommendationController: mockController(),
}));
jest.mock("src/controllers/app/chat.controller", () => ({
  ChatController: mockController(),
}));

const ALL_OFF = {
  appointments: false,
  chatWithVet: false,
  companionProfile: false,
  documents: false,
  emergencyBasedPermissions: false,
  expenses: false,
  medicalRecords: false,
  tasks: false,
};

const ALL_ON = Object.fromEntries(
  Object.keys(ALL_OFF).map((key) => [key, true]),
);

// Mobile callers (session user -> parent). Every link is to companion pat-1
// unless stated.
const PARENTS = {
  owner: "par-owner",
  coParent: "par-co",
  coParentWithout: "par-co-none",
  pending: "par-pending",
  otherParent: "par-other",
} as const;
type Parent = keyof typeof PARENTS;

// Staff callers. `staffLimited` has had the permissions these routes need
// revoked; `staffOff` is a deactivated member.
type Staff = "staffA" | "staffB" | "staffOff" | "staffLimited";

const seed = () => {
  mockDb.authUserMobile = Object.entries(PARENTS).map(([user, parentId]) => ({
    providerUserId: user,
    parentId,
  }));
  const links: Row[] = [
    { parentId: PARENTS.owner, role: "PRIMARY", permissions: ALL_OFF },
    { parentId: PARENTS.coParent, role: "CO_PARENT", permissions: ALL_ON },
    {
      parentId: PARENTS.coParentWithout,
      role: "CO_PARENT",
      permissions: ALL_OFF,
    },
    {
      parentId: PARENTS.pending,
      role: "CO_PARENT",
      permissions: ALL_ON,
      status: "PENDING",
    },
  ];
  mockDb.parentPatient = [
    ...links.map((link) => ({ patientId: "pat-1", status: "ACTIVE", ...link })),
    {
      parentId: PARENTS.otherParent,
      patientId: "pat-2",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: ALL_OFF,
    },
  ];
  const membership = (user: Staff, org: string, extra: Row = {}) => ({
    id: `map-${user}`,
    practitionerReference: user,
    organizationReference: org,
    roleCode: "VETERINARIAN",
    active: true,
    effectivePermissions: [],
    extraPermissions: [],
    revokedPermissions: [],
    ...extra,
  });
  mockDb.userOrganization = [
    membership("staffA", "org-a"),
    membership("staffB", "org-b"),
    membership("staffOff", "org-a", { active: false }),
    membership("staffLimited", "org-a", {
      revokedPermissions: [
        "companions:view:any",
        "companions:edit:any",
        "tasks:view:any",
        "tasks:view:own",
        "tasks:edit:any",
        "appointments:view:any",
        "appointments:view:own",
      ],
    }),
  ];
  mockDb.appointment = [
    { id: "appt-a", organisationId: "org-a", patient: { id: "pat-1" } },
    { id: "appt-b", organisationId: "org-b", patient: { id: "pat-2" } },
  ];
  mockDb.adverseEventReport = [
    { id: "rep-a", organisationId: "org-a" },
    { id: "rep-b", organisationId: "org-b" },
    { id: "rep-none", organisationId: null },
  ];
  mockDb.taskTemplate = [
    { id: "tpl-a", organisationId: "org-a" },
    { id: "tpl-b", organisationId: "org-b" },
  ];
};

let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  const load = (path: string) =>
    jest.requireActual<{ default: Router }>(path).default;
  const app = express();
  app.use(express.json());
  app.use("/ae", load("src/routers/adverse-event.router"));
  app.use("/expense", load("src/routers/expense.router"));
  app.use("/task", load("src/routers/task.router"));
  app.use("/chat", load("src/routers/chat.router"));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

const call = async (
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  caller: Parent | Staff,
  body?: unknown,
  roles?: string,
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-user": caller,
      ...(roles ? { "x-test-roles": roles } : {}),
    },
    body:
      body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Row | null,
  };
};

/** Asserts the caller was stopped with `status` before any handler ran. */
const expectStopped = (result: { status: number }, status: number) => {
  expect(result.status).toBe(status);
  expect(mockReached).not.toHaveBeenCalled();
};

describe("adverse-event reports: practice routes", () => {
  it.each([
    ["GET", "/ae/rep-a"],
    ["PATCH", "/ae/rep-a/status"],
  ] as const)(
    "%s %s lets a member of the report's organisation through",
    async (method, path) => {
      const { status, body } = await call(method, path, "staffA", {
        status: "REVIEWING",
      });

      expect(status).toBe(200);
      expect(body?.organisationId).toBe("org-a");
    },
  );

  it.each([
    ["a member of another organisation", "staffB", "/ae/rep-a"],
    ["a deactivated member", "staffOff", "/ae/rep-a"],
    ["anyone, for a report sent to no practice", "staffA", "/ae/rep-none"],
    ["anyone, for a report that does not exist", "staffA", "/ae/rep-missing"],
  ] as const)("answers %s as not found", async (_label, caller, path) => {
    expectStopped(await call("GET", path, caller), 404);
    expectStopped(
      await call("PATCH", `${path}/status`, caller, { status: "CLOSED" }),
      404,
    );
  });

  it("refuses a member without the companion permissions", async () => {
    expectStopped(await call("GET", "/ae/rep-a", "staffLimited"), 403);
    expectStopped(
      await call("PATCH", "/ae/rep-a/status", "staffLimited", {
        status: "CLOSED",
      }),
      403,
    );
  });
});

describe("adverse-event reports: mobile submission", () => {
  const submit = (caller: Parent, patient: Row) =>
    call("POST", "/ae", caller, { patient, organisationId: "org-a" });

  it.each<Parent>(["owner", "coParent"])(
    "lets a parent who may use emergency actions report (%s)",
    async (caller) => {
      expect((await submit(caller, { companionId: "pat-1" })).status).toBe(200);
    },
  );

  it("refuses a co-parent without emergency actions", async () => {
    expectStopped(
      await submit("coParentWithout", { companionId: "pat-1" }),
      403,
    );
  });

  it.each([
    ["another parent's companion", "otherParent", { companionId: "pat-1" }],
    ["a pending co-parent", "pending", { companionId: "pat-1" }],
    ["a report naming no companion", "owner", { name: "Poppy" }],
    [
      "a patientId that is not theirs, whatever companionId says",
      "owner",
      { patientId: "pat-2", companionId: "pat-1" },
    ],
  ] as const)("answers %s as not found", async (_label, caller, patient) => {
    expectStopped(await submit(caller, patient), 404);
  });
});

describe("expenses: mobile create", () => {
  it.each([
    ["patientId", { patientId: "pat-1" }],
    ["companionId", { companionId: "pat-1" }],
  ])("lets the owner record an expense named by %s", async (_label, body) => {
    expect((await call("POST", "/expense", "owner", body)).status).toBe(200);
  });

  it("refuses a co-parent without the expenses permission", async () => {
    expectStopped(
      await call("POST", "/expense", "coParentWithout", { patientId: "pat-1" }),
      403,
    );
  });

  it.each([
    ["another parent's companion", "otherParent", { patientId: "pat-1" }],
    ["no companion at all", "owner", {}],
  ] as const)("answers %s as not found", async (_label, caller, body) => {
    expectStopped(await call("POST", "/expense", caller, body), 404);
  });
});

describe("tasks: mobile create", () => {
  it.each<Parent>(["owner", "coParent"])(
    "lets a parent who may work on tasks add one (%s)",
    async (caller) => {
      expect(
        (await call("POST", "/task/mobile", caller, { companionId: "pat-1" }))
          .status,
      ).toBe(200);
    },
  );

  it("refuses a co-parent without the tasks permission", async () => {
    expectStopped(
      await call("POST", "/task/mobile", "coParentWithout", {
        companionId: "pat-1",
      }),
      403,
    );
  });

  it("answers another parent's companion as not found", async () => {
    expectStopped(
      await call("POST", "/task/mobile", "otherParent", {
        companionId: "pat-1",
      }),
      404,
    );
  });
});

describe("task templates", () => {
  it.each([
    ["GET", "/task/pms/templates/tpl-a"],
    ["PATCH", "/task/pms/templates/tpl-a"],
    ["DELETE", "/task/pms/templates/tpl-a"],
    ["GET", "/task/pms/templates/organisation/org-a"],
  ] as const)(
    "%s %s lets a member of the template's organisation through",
    async (method, path) => {
      const { status, body } = await call(method, path, "staffA", {});

      expect(status).toBe(200);
      expect(body?.organisationId).toBe("org-a");
    },
  );

  it("creates a template only in an organisation the caller belongs to", async () => {
    const own = await call("POST", "/task/pms/templates", "staffA", {
      organisationId: "org-a",
    });
    expect(own.status).toBe(200);
    expect(own.body?.organisationId).toBe("org-a");

    mockReached.mockClear();
    expectStopped(
      await call("POST", "/task/pms/templates", "staffB", {
        organisationId: "org-a",
      }),
      403,
    );
  });

  it.each([
    ["another organisation's template", "staffA", "tpl-b"],
    ["a template seen by a member elsewhere", "staffB", "tpl-a"],
    ["a template seen by a deactivated member", "staffOff", "tpl-a"],
    ["a template that does not exist", "staffA", "tpl-missing"],
  ] as const)("answers %s as not found", async (_label, caller, id) => {
    for (const method of ["GET", "PATCH", "DELETE"] as const) {
      expectStopped(
        await call(method, `/task/pms/templates/${id}`, caller, {}),
        404,
      );
    }
  });

  it("refuses to list another organisation's templates", async () => {
    expectStopped(
      await call("GET", "/task/pms/templates/organisation/org-b", "staffA"),
      403,
    );
  });

  it("refuses a member without the tasks permissions", async () => {
    expectStopped(
      await call("GET", "/task/pms/templates/tpl-a", "staffLimited"),
      403,
    );
    expectStopped(
      await call("PATCH", "/task/pms/templates/tpl-a", "staffLimited", {}),
      403,
    );
    expectStopped(
      await call("POST", "/task/pms/templates", "staffLimited", {
        organisationId: "org-a",
      }),
      403,
    );
  });
});

describe("shared task library", () => {
  it("is readable by any signed-in member", async () => {
    expect((await call("GET", "/task/pms/library", "staffA")).status).toBe(200);
  });

  it.each([
    ["POST", "/task/pms/library"],
    ["PUT", "/task/pms/library/lib-1"],
  ] as const)(
    "%s %s is limited to platform administrators",
    async (method, path) => {
      expectStopped(await call(method, path, "staffA", {}), 403);
      expect(
        (await call(method, path, "staffA", {}, "superadmin")).status,
      ).toBe(200);
    },
  );
});

describe("appointment chat sessions", () => {
  const mobile = (caller: Parent, appointmentId = "appt-a") =>
    call("POST", `/chat/mobile/appointments/${appointmentId}`, caller);
  const pms = (caller: Staff, appointmentId = "appt-a") =>
    call("POST", `/chat/pms/appointments/${appointmentId}`, caller);

  it.each<Parent>(["owner", "coParent"])(
    "lets a parent who may chat with the vet open it (%s)",
    async (caller) => {
      expect((await mobile(caller)).status).toBe(200);
    },
  );

  it("refuses a co-parent without chat with vet", async () => {
    expectStopped(await mobile("coParentWithout"), 403);
  });

  it.each([
    ["another parent's appointment", "otherParent", "appt-a"],
    ["a pending co-parent", "pending", "appt-a"],
    ["an appointment that does not exist", "owner", "appt-missing"],
  ] as const)(
    "answers a parent asking for %s as not found",
    async (_label, caller, appointmentId) => {
      expectStopped(await mobile(caller, appointmentId), 404);
    },
  );

  it("lets staff of the appointment's organisation open it", async () => {
    const { status, body } = await pms("staffA");
    expect(status).toBe(200);
    expect(body?.organisationId).toBe("org-a");
  });

  it.each([
    ["a member of another organisation", "staffB", "appt-a"],
    ["a deactivated member", "staffOff", "appt-a"],
    ["an appointment that does not exist", "staffA", "appt-missing"],
  ] as const)(
    "answers %s as not found",
    async (_label, caller, appointmentId) => {
      expectStopped(await pms(caller, appointmentId), 404);
    },
  );

  it("refuses a member without the appointment permissions", async () => {
    expectStopped(await pms("staffLimited"), 403);
  });
});
