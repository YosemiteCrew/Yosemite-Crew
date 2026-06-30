import type { Request, Response } from "express";
import { DeveloperDataController } from "../../../src/controllers/web/developer-data.controller";
import { prisma } from "../../../src/config/prisma";

jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    patientOrganisation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  appointment: { findMany: jest.Mock; findFirst: jest.Mock };
  patientOrganisation: { findMany: jest.Mock; findFirst: jest.Mock };
};

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (
  organisationId?: string,
  query: Record<string, string> = {},
  params: Record<string, string> = {},
): Request =>
  ({
    organisationId,
    query,
    params,
  }) as unknown as Request;

const sampleAppointment = {
  id: "appt-1",
  organisationId: "org-1",
  patient: { id: "pat-1", name: "Buddy" },
  lead: null,
  appointmentType: null,
  room: null,
  appointmentDate: new Date("2026-07-01T10:00:00Z"),
  startTime: new Date("2026-07-01T10:00:00Z"),
  endTime: new Date("2026-07-01T10:30:00Z"),
  timeSlot: "10:00",
  durationMinutes: 30,
  status: "UPCOMING",
  isEmergency: false,
  concern: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const samplePatient = {
  id: "pat-1",
  name: "Buddy",
  type: "dog",
  breed: "Labrador",
  dateOfBirth: new Date("2020-01-01"),
  gender: "male",
  photoUrl: null,
  status: "active",
  isInsured: false,
  microchipNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- listAppointments ----

describe("DeveloperDataController.listAppointments", () => {
  it("400 when organisationId missing", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(buildReq(undefined), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it("400 when query params are invalid", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq("org-1", { limit: "not-a-number" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns appointment list scoped to org", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([sampleAppointment]);
    const res = buildRes();
    await DeveloperDataController.listAppointments(buildReq("org-1"), res);
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: "org-1" } }),
    );
    expect(res.json).toHaveBeenCalledWith({
      data: [sampleAppointment],
      total: 1,
    });
  });

  it("applies status filter", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([sampleAppointment]);
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq("org-1", { status: "UPCOMING" }),
      res,
    );
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", status: "UPCOMING" },
      }),
    );
  });

  it("applies dateFrom filter", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq("org-1", { dateFrom: "2026-07-01T00:00:00Z" }),
      res,
    );
    const call = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(call.where.appointmentDate).toMatchObject({ gte: expect.any(Date) });
  });

  it("applies dateTo filter", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq("org-1", { dateTo: "2026-07-31T23:59:59Z" }),
      res,
    );
    const call = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(call.where.appointmentDate).toMatchObject({ lte: expect.any(Date) });
  });

  it("applies both dateFrom and dateTo", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq("org-1", {
        dateFrom: "2026-07-01T00:00:00Z",
        dateTo: "2026-07-31T23:59:59Z",
      }),
      res,
    );
    const call = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(call.where.appointmentDate).toMatchObject({
      gte: expect.any(Date),
      lte: expect.any(Date),
    });
  });

  it("500 when prisma throws", async () => {
    mockPrisma.appointment.findMany.mockRejectedValue(new Error("db error"));
    const res = buildRes();
    await DeveloperDataController.listAppointments(buildReq("org-1"), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---- getAppointment ----

describe("DeveloperDataController.getAppointment", () => {
  it("400 when organisationId missing", async () => {
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq(undefined, {}, { id: "appt-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404 when appointment not found or not in org", async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq("org-1", {}, { id: "appt-999" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns appointment scoped to org", async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(sampleAppointment);
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq("org-1", {}, { id: "appt-1" }),
      res,
    );
    expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1", organisationId: "org-1" },
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ data: sampleAppointment });
  });

  it("500 when prisma throws", async () => {
    mockPrisma.appointment.findFirst.mockRejectedValue(new Error("db error"));
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq("org-1", {}, { id: "appt-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---- listPatients ----

describe("DeveloperDataController.listPatients", () => {
  it("400 when organisationId missing", async () => {
    const res = buildRes();
    await DeveloperDataController.listPatients(buildReq(undefined), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 when query params are invalid", async () => {
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq("org-1", { limit: "bad" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns patients linked to org", async () => {
    mockPrisma.patientOrganisation.findMany.mockResolvedValue([
      { patient: samplePatient },
    ]);
    const res = buildRes();
    await DeveloperDataController.listPatients(buildReq("org-1"), res);
    expect(mockPrisma.patientOrganisation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", status: "ACTIVE" },
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ data: [samplePatient], total: 1 });
  });

  it("filters by patient status after loading from DB", async () => {
    const activePatient = { ...samplePatient, status: "active" };
    const archivedPatient = {
      ...samplePatient,
      id: "pat-2",
      status: "archived",
    };
    mockPrisma.patientOrganisation.findMany.mockResolvedValue([
      { patient: activePatient },
      { patient: archivedPatient },
    ]);
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq("org-1", { status: "active" }),
      res,
    );
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe("active");
  });

  it("500 when prisma throws", async () => {
    mockPrisma.patientOrganisation.findMany.mockRejectedValue(
      new Error("db error"),
    );
    const res = buildRes();
    await DeveloperDataController.listPatients(buildReq("org-1"), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---- getPatient ----

describe("DeveloperDataController.getPatient", () => {
  it("400 when organisationId missing", async () => {
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq(undefined, {}, { id: "pat-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404 when patient not linked to org", async () => {
    mockPrisma.patientOrganisation.findFirst.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq("org-1", {}, { id: "pat-999" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns patient scoped to org", async () => {
    mockPrisma.patientOrganisation.findFirst.mockResolvedValue({
      patient: samplePatient,
    });
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq("org-1", {}, { id: "pat-1" }),
      res,
    );
    expect(mockPrisma.patientOrganisation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientId: "pat-1",
          organisationId: "org-1",
          status: "ACTIVE",
        },
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ data: samplePatient });
  });

  it("500 when prisma throws", async () => {
    mockPrisma.patientOrganisation.findFirst.mockRejectedValue(
      new Error("db error"),
    );
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq("org-1", {}, { id: "pat-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
