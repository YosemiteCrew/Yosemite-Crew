import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const orgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const appointmentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const permissionMiddleware = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissionsMiddleware);
const withAppointmentOrgPermissions = jest.fn(
  () => appointmentOrgPermissionsMiddleware,
);
const requirePermission = jest.fn(() => permissionMiddleware);

const AppointmentController = {
  createRequestedFromMobile: jest.fn(),
  rescheduleFromMobile: jest.fn(),
  getDocumentUplaodURL: jest.fn(),
  createFromPms: jest.fn(),
  previewWeeklySeries: jest.fn(),
  previewAppointmentSeriesReschedule: jest.fn(),
  createWeeklySeriesFromPms: jest.fn(),
  acceptRequested: jest.fn(),
  rejectRequested: jest.fn(),
  cancelFromMobile: jest.fn(),
  cancelFromPMS: jest.fn(),
  checkInAppointment: jest.fn(),
  checkInAppointmentForPMS: jest.fn(),
  admitFromPMS: jest.fn(),
  markReadyForBillingForPMS: jest.fn(),
  reverseReadyForBillingForPMS: jest.fn(),
  updateFromPms: jest.fn(),
  attachFormsToAppointment: jest.fn(),
  getById: jest.fn(),
  getByIdMobile: jest.fn(),
  listByCompanion: jest.fn(),
  listByCompanionForOrganisation: jest.fn(),
  listByParent: jest.fn(),
  listByOrganisation: jest.fn(),
  listByLead: jest.fn(),
  listBySupportStaff: jest.fn(),
  listByDateRange: jest.fn(),
  search: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/appointment.prisma.controller", () => ({
  AppointmentController,
}));

type Row = Record<string, unknown>;
let parentLinks: Row[] = [];
const findParentLink = jest.fn(
  async ({ where }: { where: Row }) =>
    parentLinks.find((row) =>
      Object.entries(where).every(([field, filter]) =>
        filter && typeof filter === "object" && "in" in filter
          ? (filter as { in: unknown[] }).in.includes(row[field])
          : row[field] === filter,
      ),
    ) ?? null,
);

jest.mock("../../src/config/prisma", () => ({
  prisma: { parentPatient: { findFirst: findParentLink } },
}));

jest.mock("../../src/services/shared/parent-identity", () => ({
  findParentIdForAuthUser: jest.fn(async () => "parent-caller"),
}));

const appointmentRouter = jest.requireActual(
  "../../src/routers/appointment.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (appointmentRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("appointment.router", () => {
  it("registers the series reschedule preview as an appointment-scoped route", () => {
    const route = findRoute(
      "/pms/:organisationId/:appointmentId/series/reschedule-preview",
      "post",
    );
    expect(route).toBeDefined();
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      appointmentOrgPermissionsMiddleware,
    );
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware,
    );
    expect(
      AppointmentController.previewAppointmentSeriesReschedule,
    ).toHaveBeenCalledTimes(0);
  });

  it("registers the inpatient admit PMS route with org permissions", () => {
    const admitRoute = findRoute(
      "/pms/:organisationId/:appointmentId/admit",
      "post",
    );

    expect(admitRoute).toBeDefined();
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      appointmentOrgPermissionsMiddleware,
    );
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware,
    );
    expect(AppointmentController.admitFromPMS).toHaveBeenCalledTimes(0);
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
  });

  // Every route addressed by :appointmentId must derive the organisation from
  // the appointment itself; withOrgPermissions() would trust the URL instead.
  it.each([
    ["/pms/:organisationId/:appointmentId/admit", "post"],
    ["/pms/:organisationId/:appointmentId/forms", "post"],
    ["/pms/:organisationId/:appointmentId/checkin", "patch"],
    ["/pms/:organisationId/:appointmentId", "patch"],
    ["/pms/:organisationId/:appointmentId", "get"],
  ])(
    "derives the organisation from the appointment for %s (%s)",
    (path, method) => {
      const route = findRoute(path, method);
      const handles = route?.stack.map((layer) => layer.handle);

      expect(route).toBeDefined();
      expect(handles).toContain(appointmentOrgPermissionsMiddleware);
      expect(handles).not.toContain(orgPermissionsMiddleware);
    },
  );

  it("registers the reverse PMS ready-for-billing route", () => {
    const reverseRoute = findRoute(
      "/pms/:organisationId/:appointmentId/ready-for-billing",
      "delete",
    );

    expect(reverseRoute).toBeDefined();
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      orgPermissionsMiddleware,
    );
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware,
    );
    expect(
      AppointmentController.reverseReadyForBillingForPMS,
    ).toHaveBeenCalledTimes(0);
  });

  it("binds appointment detail reads through appointment org permissions", () => {
    const detailRoute = findRoute("/pms/:organisationId/:appointmentId", "get");

    expect(detailRoute).toBeDefined();
    expect(detailRoute?.stack.map((layer) => layer.handle)).toContain(
      appointmentOrgPermissionsMiddleware,
    );
  });

  it("binds mobile appointment detail reads to the mobile controller", () => {
    const mobileRoute = findRoute("/mobile/:appointmentId", "get");

    expect(mobileRoute).toBeDefined();
    expect(mobileRoute?.stack.map((layer) => layer.handle)).toContain(
      requireMobileAuth,
    );
    expect(mobileRoute?.stack.map((layer) => layer.handle)).toContain(
      AppointmentController.getByIdMobile,
    );
  });
});

describe("POST /mobile/documentUpload", () => {
  const link = (overrides: Row = {}): Row => ({
    parentId: "parent-caller",
    patientId: "pet-1",
    role: "PRIMARY",
    status: "ACTIVE",
    permissions: {},
    ...overrides,
  });

  // Runs the route's own middleware chain up to the handler.
  const post = async (body: Row) => {
    const route = findRoute("/mobile/documentUpload", "post");
    const res = {
      statusCode: 200,
      status: jest.fn(function (this: { statusCode: number }, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(),
    };
    const req = { body, userId: "provider-caller", params: {} };
    for (const { handle } of route?.stack ?? []) {
      let next = false;
      await (handle as (...args: unknown[]) => unknown)(req, res, () => {
        next = true;
      });
      if (!next) break;
    }
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    parentLinks = [link()];
  });

  it.each([
    ["the primary parent", link()],
    [
      "a co-parent with the documents permission",
      link({ role: "CO_PARENT", permissions: { documents: true } }),
    ],
  ])("issues an upload link for %s", async (_label, row) => {
    parentLinks = [row];

    await post({ patientId: "pet-1", mimeType: "application/pdf" });

    expect(AppointmentController.getDocumentUplaodURL).toHaveBeenCalledTimes(1);
  });

  it("returns 403 for a co-parent without the documents permission", async () => {
    parentLinks = [
      link({ role: "CO_PARENT", permissions: { documents: false } }),
    ];

    const res = await post({ patientId: "pet-1", mimeType: "application/pdf" });

    expect(res.statusCode).toBe(403);
    expect(AppointmentController.getDocumentUplaodURL).not.toHaveBeenCalled();
  });

  it.each([
    ["a PENDING link", { status: "PENDING" }],
    ["a REVOKED link", { status: "REVOKED" }],
    ["another parent's companion", { parentId: "parent-other" }],
  ])("returns 404 for %s", async (_label, overrides) => {
    parentLinks = [link(overrides)];

    const res = await post({ patientId: "pet-1", mimeType: "application/pdf" });

    expect(res.statusCode).toBe(404);
    expect(AppointmentController.getDocumentUplaodURL).not.toHaveBeenCalled();
  });

  it.each([{}, { patientId: "" }, { patientId: ["pet-1"] }])(
    "returns 404 without looking up a link for the body %j",
    async (body) => {
      const res = await post({ ...body, mimeType: "application/pdf" });

      expect(res.statusCode).toBe(404);
      expect(findParentLink).not.toHaveBeenCalled();
      expect(AppointmentController.getDocumentUplaodURL).not.toHaveBeenCalled();
    },
  );
});
