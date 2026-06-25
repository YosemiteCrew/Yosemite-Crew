import { beforeEach, describe, expect, jest, it } from "@jest/globals";
import { AppointmentPrismaService } from "../../src/services/appointment.prisma.service";
import { prisma } from "../../src/config/prisma";
import { InvoiceService } from "../../src/services/invoice.service";

jest.mock("@yosemite-crew/types", () => ({
  ...(jest.requireActual("@yosemite-crew/types") as unknown as Record<
    string,
    unknown
  >),
  fromAppointmentRequestDTO: jest.fn(),
  toAppointmentResponseDTO: jest.fn((appointment) => appointment),
}));

jest.mock("../../src/services/catalog.service", () => ({
  CatalogServiceError: class CatalogServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "CatalogServiceError";
    }
  },
  CatalogService: {
    resolveSelection: jest.fn(),
  },
}));

jest.mock("../../src/services/invoice.service", () => ({
  __esModule: true,
  InvoiceService: {
    bootstrapForAppointment: jest.fn(),
    createCheckoutSessionAndEmailParent: jest.fn(),
    markAppointmentReadyForBilling: jest.fn(),
    setInvoiceDepositTarget: jest.fn(),
  },
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    appointment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    case: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    encounter: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      findUnique: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    roomUnitAssignment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    template: {
      findFirst: jest.fn(),
    },
    occupancy: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;
const mockedTypes = jest.requireMock("@yosemite-crew/types") as {
  fromAppointmentRequestDTO: jest.Mock;
  toAppointmentResponseDTO: jest.Mock;
};
const mockedCatalog = jest.requireMock(
  "../../src/services/catalog.service",
) as {
  CatalogService: {
    resolveSelection: jest.Mock;
  };
};
const mockedResolveSelection = mockedCatalog.CatalogService
  .resolveSelection as unknown as jest.Mock;
const mockedInvoiceService = InvoiceService as unknown as {
  bootstrapForAppointment: jest.Mock;
  createCheckoutSessionAndEmailParent: jest.Mock;
  markAppointmentReadyForBilling: jest.Mock;
  setInvoiceDepositTarget: jest.Mock;
};

const baseDomain = {
  caseId: "case_1",
  encounterId: undefined,
  companion: {
    id: "comp_1",
    name: "Buddy",
    species: "Dog",
    breed: "Labrador",
    parent: {
      id: "parent_1",
      name: "Parent One",
    },
  },
  patient: {
    id: "comp_1",
    name: "Buddy",
    species: "Dog",
    breed: "Labrador",
    parent: {
      id: "parent_1",
      name: "Parent One",
    },
  },
  lead: {
    id: "lead_1",
    name: "Dr Vet",
  },
  supportStaff: [{ id: "staff_1", name: "Assistant" }],
  room: { id: "room_1", name: "Room A" },
  appointmentType: {
    id: "service_1",
    name: "Consultation",
    speciality: { id: "spec_1", name: "Cardiology" },
  },
  appointmentKind: "INPATIENT",
  organisationId: "org_1",
  appointmentDate: new Date("2026-06-10T10:00:00.000Z"),
  startTime: new Date("2026-06-10T10:00:00.000Z"),
  endTime: new Date("2026-06-10T10:30:00.000Z"),
  timeSlot: "10:00",
  durationMinutes: 30,
  status: "REQUESTED",
  isEmergency: false,
  concern: "Checkup",
  attachments: [{ key: "file-1", name: "xray.png", contentType: "image/png" }],
  formIds: ["form_1"],
  idempotencyKey: null,
};

const makeRow = (overrides: Record<string, unknown> = {}): any => ({
  id: "appt_1",
  companion: baseDomain.companion,
  patient: baseDomain.patient,
  lead: baseDomain.lead,
  supportStaff: baseDomain.supportStaff,
  room: baseDomain.room,
  appointmentType: baseDomain.appointmentType,
  appointmentKind: "INPATIENT",
  caseId: null,
  encounterId: null,
  productItemId: null,
  organisationId: "org_1",
  appointmentDate: baseDomain.appointmentDate,
  startTime: baseDomain.startTime,
  endTime: baseDomain.endTime,
  timeSlot: baseDomain.timeSlot,
  durationMinutes: baseDomain.durationMinutes,
  status: baseDomain.status,
  isEmergency: baseDomain.isEmergency,
  concern: baseDomain.concern,
  attachments: baseDomain.attachments,
  formIds: baseDomain.formIds,
  expiresAt: null,
  createdAt: new Date("2026-06-10T09:55:00.000Z"),
  updatedAt: new Date("2026-06-10T09:55:00.000Z"),
  idempotencyKey: null,
  ...overrides,
});

describe("AppointmentPrismaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTypes.fromAppointmentRequestDTO.mockReturnValue(baseDomain as any);
    mockedResolveSelection.mockImplementation(async () => ({
      productItemId: "product_1",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT", "INPATIENT"],
      templateKinds: ["SOAP_NOTE"],
      templateBindings: [],
    }));
    mockedPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockedPrisma),
    );
    mockedPrisma.occupancy.findFirst.mockResolvedValue(null);
    mockedPrisma.occupancy.create.mockResolvedValue({} as any);
    mockedPrisma.occupancy.deleteMany.mockResolvedValue({ count: 1 } as any);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue(null);
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue(null);
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    });
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null);
    mockedPrisma.roomUnitAssignment.update.mockResolvedValue({} as any);
    mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
      id: "assign_1",
      encounterId: "enc_1",
      admissionId: "enc_1",
      unitId: "unit_1",
      assignedAt: new Date("2026-06-11T12:00:00.000Z"),
      releasedAt: null,
      assignedBy: "user_1",
      reason: "Initial inpatient placement",
      createdAt: new Date("2026-06-11T12:00:00.000Z"),
      updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    } as any);
    mockedPrisma.admission.findUnique.mockResolvedValue(null);
    mockedPrisma.admission.upsert.mockResolvedValue({} as any);
    mockedPrisma.template.findFirst.mockResolvedValue(null);
  });

  it("creates a requested appointment with product validation", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
    } as any);
    mockedPrisma.template.findFirst.mockResolvedValue({
      id: "tmpl_soap",
      kind: "SOAP_NOTE",
      organisationId: "org_1",
      ownership: "ORG_TEMPLATE",
      status: "PUBLISHED",
      latestVersion: 4,
      publishedVersion: 4,
      updatedAt: new Date("2026-06-10T09:50:00.000Z"),
    } as any);
    mockedPrisma.appointment.create.mockResolvedValue(
      makeRow({
        status: "REQUESTED",
        caseId: "case_1",
        appointmentType: {
          ...baseDomain.appointmentType,
          templateDefaults: [
            {
              templateKind: "SOAP_NOTE",
              templateId: "tmpl_soap",
              templateVersion: 4,
              source: "ORGANISATION_DEFAULT",
            },
          ],
        },
      }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.createRequestedFromMobile({
      resourceType: "Appointment",
    } as any);

    expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REQUESTED",
          appointmentKind: "INPATIENT",
          organisationId: "org_1",
          caseId: "case_1",
          productItemId: "product_1",
          appointmentType: expect.objectContaining({
            templateDefaults: [
              expect.objectContaining({
                templateKind: "SOAP_NOTE",
                templateId: "tmpl_soap",
                templateVersion: 4,
                source: "ORGANISATION_DEFAULT",
              }),
            ],
          }),
        }),
      }),
    );
    expect((result as any).paymentStatus).toBe("UNPAID");
    expect(result.id).toBe("appt_1");
    expect((result as any).templateDefaults).toEqual([
      expect.objectContaining({
        templateKind: "SOAP_NOTE",
        templateId: "tmpl_soap",
        templateVersion: 4,
        source: "ORGANISATION_DEFAULT",
      }),
    ]);
  });

  it("prefers explicit catalog template bindings over catalog kind defaults", async () => {
    mockedResolveSelection.mockImplementation(
      async () =>
        ({
          productItemId: "product_1",
          isBookable: true,
          appointmentKinds: ["OUTPATIENT", "INPATIENT"],
          templateKinds: ["SOAP_NOTE"],
          templateBindings: [
            {
              templateKind: "SOAP_NOTE",
              templateId: "tmpl_bound",
              templateVersion: 8,
            },
          ],
        }) as any,
    );
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
    } as any);
    mockedPrisma.template.findFirst.mockResolvedValue({
      id: "tmpl_bound",
      kind: "SOAP_NOTE",
      organisationId: "org_1",
      ownership: "ORG_TEMPLATE",
      status: "PUBLISHED",
      latestVersion: 9,
      publishedVersion: 9,
      updatedAt: new Date("2026-06-10T09:50:00.000Z"),
    } as any);
    mockedPrisma.appointment.create.mockResolvedValue(
      makeRow({
        status: "REQUESTED",
        caseId: "case_1",
        appointmentType: {
          ...baseDomain.appointmentType,
          templateDefaults: [
            {
              templateKind: "SOAP_NOTE",
              templateId: "tmpl_bound",
              templateVersion: 8,
              source: "CATALOG_BINDING",
            },
          ],
        },
      }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.createRequestedFromMobile({
      resourceType: "Appointment",
    } as any);

    expect(mockedPrisma.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "tmpl_bound",
          kind: "SOAP_NOTE",
        }),
      }),
    );
    expect((result as any).templateDefaults).toEqual([
      expect.objectContaining({
        templateKind: "SOAP_NOTE",
        templateId: "tmpl_bound",
        templateVersion: 8,
        source: "CATALOG_BINDING",
      }),
    ]);
  });

  it("auto-creates a case for inpatient appointments when frontend does not send one", async () => {
    mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
      ...baseDomain,
      caseId: undefined,
    } as any);
    mockedPrisma.case.create.mockResolvedValue({ id: "case_new" } as any);
    mockedPrisma.appointment.create.mockResolvedValue(
      makeRow({ status: "REQUESTED", caseId: "case_new" }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.createRequestedFromMobile({
      resourceType: "Appointment",
    } as any);

    expect(mockedPrisma.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org_1",
          patientId: "comp_1",
          appointmentKind: "INPATIENT",
          status: "active",
        }),
      }),
    );
    expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: "case_new",
        }),
      }),
    );
    expect((result as any).caseId).toBe("case_new");
  });

  it("creates a PMS appointment as upcoming", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
    } as any);
    mockedPrisma.appointment.create.mockResolvedValue(
      makeRow({ status: "UPCOMING", caseId: "case_1" }),
    );
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({ status: "UPCOMING", caseId: "case_1" }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);
    (
      mockedInvoiceService.bootstrapForAppointment as jest.Mock
    ).mockResolvedValue({ id: "inv_1" } as never);

    const result = await AppointmentPrismaService.createAppointmentFromPms(
      { resourceType: "Appointment" } as any,
      true,
      "PAYMENT_LINK",
    );

    expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UPCOMING",
        }),
      }),
    );
    expect(mockedPrisma.occupancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "lead_1",
          referenceId: "appt_1",
        }),
      }),
    );
    expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
      "appt_1",
      "PAYMENT_LINK",
    );
    expect(
      mockedInvoiceService.createCheckoutSessionAndEmailParent,
    ).toHaveBeenCalledWith("inv_1");
    expect(result.status).toBe("UPCOMING");
  });

  it("rejects PMS online payment creation for in-clinic collection", async () => {
    await expect(
      AppointmentPrismaService.createAppointmentFromPms(
        { resourceType: "Appointment" } as any,
        true,
        "PAYMENT_AT_CLINIC",
      ),
    ).rejects.toMatchObject({
      message: "Cannot create online payment for in-clinic collection.",
      statusCode: 400,
    });
  });

  it("returns 404 when appointment is missing", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(null);

    await expect(
      AppointmentPrismaService.getById("missing"),
    ).rejects.toMatchObject({
      message: "Appointment not found",
      statusCode: 404,
    });
  });

  it("respects organisation and actor scoping when loading an appointment", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(
      makeRow({
        organisationId: "org_2",
        lead: { id: "lead_1", name: "Dr Vet" },
        supportStaff: [{ id: "staff_1", name: "Assistant" }],
      }),
    );

    await expect(
      AppointmentPrismaService.getById("appt_1", "org_2", "actor_2"),
    ).rejects.toMatchObject({
      message: "Forbidden – insufficient permissions",
      statusCode: 403,
    });

    await expect(
      AppointmentPrismaService.getById("appt_1", "org_2", "lead_1"),
    ).resolves.toMatchObject({ id: "appt_1" });

    expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: "appt_1", organisationId: "org_2" },
    });
  });

  it("reschedules and resets UPCOMING appointments back to requested", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({ status: "UPCOMING" }),
    );
    mockedPrisma.appointment.update.mockResolvedValue(
      makeRow({
        status: "REQUESTED",
        timeSlot: "11:00",
      }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.rescheduleFromParent(
      "appt_1",
      "parent_1",
      {
        startTime: "2026-06-10T11:00:00.000Z",
        endTime: "2026-06-10T11:30:00.000Z",
      },
    );

    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt_1" },
        data: expect.objectContaining({
          status: "REQUESTED",
          timeSlot: expect.stringMatching(/^\d{2}:\d{2}$/),
        }),
      }),
    );
    expect(mockedPrisma.occupancy.deleteMany).toHaveBeenCalled();
    expect(result.status).toBe("REQUESTED");
  });

  it("blocks reschedule when parent does not own appointment", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        companion: {
          ...baseDomain.companion,
          parent: { id: "other_parent", name: "Other" },
        },
        patient: {
          ...baseDomain.patient,
          parent: { id: "other_parent", name: "Other" },
        },
      }),
    );

    await expect(
      AppointmentPrismaService.rescheduleFromParent("appt_1", "parent_1", {
        startTime: "2026-06-10T11:00:00.000Z",
        endTime: "2026-06-10T11:30:00.000Z",
      }),
    ).rejects.toMatchObject({
      message: "You are not allowed to modify this appointment.",
      statusCode: 403,
    });
  });

  it("creates an encounter on check-in when one does not exist", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({ status: "UPCOMING", caseId: "case_1", encounterId: null }),
    );
    mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_1" } as any);
    mockedPrisma.appointment.update
      .mockResolvedValueOnce({ id: "appt_1" } as any)
      .mockResolvedValueOnce(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.checkInAppointment("appt_1");

    expect(mockedPrisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: "case_1",
          organisationId: "org_1",
          patientId: "comp_1",
          status: "arrived",
          encounterClass: "IMP",
        }),
      }),
    );
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "appt_1" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "appt_1" },
        data: expect.objectContaining({
          status: "CHECKED_IN",
          encounterId: "enc_1",
        }),
      }),
    );
    expect(mockedPrisma.admission.upsert).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      update: {},
      create: {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        admittedAt: baseDomain.startTime,
      },
    });
    expect((result as any).encounterId).toBe("enc_1");
  });

  it("creates an outpatient case on check-in when one does not exist", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "UPCOMING",
        appointmentKind: "OUTPATIENT",
        caseId: null,
        encounterId: null,
      }),
    );
    mockedPrisma.case.create.mockResolvedValue({ id: "case_out_1" } as any);
    mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_out_1" } as any);
    mockedPrisma.appointment.update
      .mockResolvedValueOnce({ id: "appt_1" } as any)
      .mockResolvedValueOnce(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "OUTPATIENT",
          caseId: "case_out_1",
          encounterId: "enc_out_1",
        }),
      );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await AppointmentPrismaService.checkInAppointment("appt_1");

    expect(mockedPrisma.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org_1",
        patientId: "comp_1",
        status: "active",
        appointmentKind: "OUTPATIENT",
        title: "Outpatient case",
      }),
      select: { id: true },
    });
    expect(mockedPrisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: "case_out_1",
          organisationId: "org_1",
          patientId: "comp_1",
          status: "arrived",
          encounterClass: "AMB",
        }),
      }),
    );
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "appt_1" },
      data: {
        caseId: "case_out_1",
        encounterId: "enc_out_1",
      },
    });
    expect((result as any).caseId).toBe("case_out_1");
    expect((result as any).encounterId).toBe("enc_out_1");
  });

  it("admits a checked-in outpatient appointment into inpatient care", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "OUTPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "arrived",
      encounterClass: "AMB",
      appointmentKind: "OUTPATIENT",
      periodStart: null,
      periodEnd: null,
    } as any);
    mockedPrisma.admission.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: 5,
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T12:00:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      } as any);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "ICU-01",
      displayName: "ICU Unit 1",
      size: "L",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as any);
    mockedPrisma.encounter.update.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: new Date("2026-06-11T12:00:00.000Z"),
      periodEnd: null,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    } as any);
    mockedPrisma.appointment.update.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
        lead: {
          id: "lead_1",
          name: "Dr. Patel",
        },
        supportStaff: [
          {
            id: "staff_1",
            name: "Nurse One",
          },
        ],
        room: {
          id: "room_1",
          name: "ICU Room 1",
        },
      }),
    );

    const result = await AppointmentPrismaService.admitAppointmentToInpatient(
      "appt_1",
      {
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        expectedStayDays: 5,
        lead: {
          id: "lead_1",
          name: "Dr. Patel",
        },
        supportStaff: [
          {
            id: "staff_1",
            name: "Nurse One",
          },
        ],
        room: {
          id: "room_1",
          name: "ICU Room 1",
        },
        roomUnitId: "unit_1",
        assignedAt: new Date("2026-06-11T12:15:00.000Z"),
        assignedBy: "user_1",
        assignmentReason: "Initial inpatient placement",
      },
    );

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enc_1" },
        data: expect.objectContaining({
          appointmentKind: "INPATIENT",
          encounterClass: "IMP",
          status: "in-progress",
        }),
      }),
    );
    expect(mockedPrisma.admission.upsert).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      update: {},
      create: {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        expectedStayDays: 5,
      },
    });
    expect(mockedPrisma.admission.upsert).toHaveBeenNthCalledWith(2, {
      where: { encounterId: "enc_1" },
      update: {
        unitId: "unit_1",
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        expectedStayDays: 5,
      },
      create: {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        admittedBy: null,
        expectedStayDays: 5,
      },
    });
    expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalledWith({
      data: {
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T12:15:00.000Z"),
        assignedBy: "user_1",
        reason: "Initial inpatient placement",
      },
    });
    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt_1" },
        data: expect.objectContaining({
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
          lead: {
            id: "lead_1",
            name: "Dr. Patel",
          },
          supportStaff: [
            {
              id: "staff_1",
              name: "Nurse One",
            },
          ],
          room: {
            id: "room_1",
            name: "ICU Room 1",
          },
        }),
      }),
    );
    expect((result as any).appointment.appointmentKind).toBe("INPATIENT");
    expect((result as any).appointment.encounterId).toBe("enc_1");
    expect(result.admission.unitId).toBe("unit_1");
    expect(result.unitAssignment?.unitId).toBe("unit_1");
  });

  it("continues inpatient admission when the admission already exists", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "arrived",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: null,
      periodEnd: null,
    } as any);
    mockedPrisma.admission.findUnique
      .mockResolvedValueOnce({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T11:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:30:00.000Z"),
        updatedAt: new Date("2026-06-11T11:30:00.000Z"),
      } as any)
      .mockResolvedValueOnce({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: 5,
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:30:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      } as any);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "ICU-01",
      displayName: "ICU Unit 1",
      size: "L",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as any);
    mockedPrisma.encounter.update.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: new Date("2026-06-11T12:00:00.000Z"),
      periodEnd: null,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    } as any);
    mockedPrisma.appointment.update.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );

    const result = await AppointmentPrismaService.admitAppointmentToInpatient(
      "appt_1",
      {
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        expectedStayDays: 5,
        roomUnitId: "unit_1",
      },
    );

    expect(mockedPrisma.admission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { encounterId: "enc_1" },
        update: expect.objectContaining({
          unitId: "unit_1",
          admittedAt: new Date("2026-06-11T12:00:00.000Z"),
          expectedStayDays: 5,
        }),
      }),
    );
    expect(result.admission.unitId).toBe("unit_1");
  });

  it("admits a checked-in inpatient-marked appointment when admission is missing", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "arrived",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: null,
      periodEnd: null,
    } as any);
    mockedPrisma.admission.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T12:00:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      } as any);
    mockedPrisma.encounter.update.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: new Date("2026-06-11T12:00:00.000Z"),
      periodEnd: null,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    } as any);
    mockedPrisma.appointment.update.mockResolvedValue(
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );

    const result = await AppointmentPrismaService.admitAppointmentToInpatient(
      "appt_1",
      {
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    );

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enc_1" },
        data: expect.objectContaining({
          appointmentKind: "INPATIENT",
          encounterClass: "IMP",
          status: "in-progress",
        }),
      }),
    );
    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt_1" },
        data: expect.objectContaining({
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      }),
    );
    expect((result as any).appointment.appointmentKind).toBe("INPATIENT");
    expect((result as any).appointment.encounterId).toBe("enc_1");
    expect(result.admission.encounterId).toBe("enc_1");
  });

  it("rejects inpatient admission when the appointment is not checked in", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "UPCOMING",
        appointmentKind: "OUTPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );

    await expect(
      AppointmentPrismaService.admitAppointmentToInpatient("appt_1"),
    ).rejects.toMatchObject({
      message: "Only checked-in or in-progress appointments can be admitted.",
      statusCode: 409,
    });
  });

  it("marks visit billing ready when appointment completes", async () => {
    mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
      ...baseDomain,
      status: "COMPLETED",
    } as any);
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({
        status: "IN_PROGRESS",
        caseId: "case_1",
        encounterId: "enc_1",
      }),
    );
    mockedPrisma.appointment.update.mockResolvedValue(
      makeRow({ status: "COMPLETED", caseId: "case_1", encounterId: "enc_1" }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([]);
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
    } as any);
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
    } as any);

    await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
      resourceType: "Appointment",
    } as any);

    expect(
      mockedInvoiceService.markAppointmentReadyForBilling,
    ).toHaveBeenCalledWith("appt_1");
  });

  it("lists appointments for organisation with filters", async () => {
    mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    const result =
      await AppointmentPrismaService.getAppointmentsForOrganisation("org_1", {
        status: ["REQUESTED"],
        startDate: new Date("2026-06-10T00:00:00.000Z"),
      });

    expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          status: { in: ["REQUESTED"] },
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("rejects products that are not bookable for the selected appointment kind", async () => {
    mockedResolveSelection.mockImplementation(async () => ({
      productItemId: "product_1",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
    }));

    await expect(
      AppointmentPrismaService.createRequestedFromMobile({
        resourceType: "Appointment",
      } as any),
    ).rejects.toMatchObject({
      message: "Selected product is not bookable for inpatient appointments.",
      statusCode: 400,
    });
  });

  it("blocks PMS approval when the lead already has overlapping occupancy", async () => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      makeRow({ status: "REQUESTED" }),
    );
    mockedPrisma.occupancy.findFirst.mockResolvedValue({ id: "occ_1" } as any);

    await expect(
      AppointmentPrismaService.approveRequestedFromPms("appt_1", {
        resourceType: "Appointment",
      } as any),
    ).rejects.toMatchObject({
      message: "Selected vet is not available for this slot.",
      statusCode: 409,
    });
  });

  it("requires caseId when encounterId is provided", async () => {
    mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
      ...baseDomain,
      caseId: undefined,
      encounterId: "enc_1",
      appointmentKind: "OUTPATIENT",
    } as any);

    await expect(
      AppointmentPrismaService.createRequestedFromMobile({
        resourceType: "Appointment",
      } as any),
    ).rejects.toMatchObject({
      message: "caseId is required when encounterId is provided.",
      statusCode: 400,
    });
  });
});
