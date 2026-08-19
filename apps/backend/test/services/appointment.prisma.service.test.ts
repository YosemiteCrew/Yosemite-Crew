import { beforeEach, describe, expect, jest, it } from "@jest/globals";
import { AppointmentPrismaService } from "../../src/services/appointment.prisma.service";
import { prisma } from "../../src/config/prisma";
import { InvoiceService } from "../../src/services/invoice.service";
import { CompanionOrganisationService } from "../../src/services/companion-organisation.service";

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

jest.mock("../../src/services/companion-organisation.service", () => ({
  CompanionOrganisationService: {
    linkByParent: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/payment", () => ({
  __esModule: true,
  FinancePaymentService: {
    createPaymentIntentForInvoice: jest.fn(),
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
    form: {
      findMany: jest.fn(),
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
    organization: {
      findUnique: jest.fn(),
    },
    patientOrganisation: {
      findFirst: jest.fn(),
      create: jest.fn(),
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
const mockedCompanionOrgService = CompanionOrganisationService as unknown as {
  linkByParent: jest.Mock;
};
const mockedFinancePaymentService = jest.requireMock(
  "../../src/services/finance/payment",
) as {
  FinancePaymentService: {
    createPaymentIntentForInvoice: jest.Mock;
  };
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
    mockedPrisma.organization.findUnique.mockResolvedValue({
      type: "HOSPITAL",
    });
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
    mockedPrisma.invoice.findMany.mockResolvedValue([]);
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

    const result = await AppointmentPrismaService.createRequestedFromMobile(
      {
        resourceType: "Appointment",
      } as any,
      "parent_1",
    );

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
    expect(mockedCompanionOrgService.linkByParent).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: "parent_1",
        patientId: "comp_1",
        organisationId: "org_1",
        organisationType: "HOSPITAL",
      }),
    );
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

    const result = await AppointmentPrismaService.createRequestedFromMobile(
      {
        resourceType: "Appointment",
      } as any,
      "parent_1",
    );

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

    const result = await AppointmentPrismaService.createRequestedFromMobile(
      {
        resourceType: "Appointment",
      } as any,
      "parent_1",
    );

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
    mockedPrisma.appointment.findFirst.mockResolvedValue(
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
    expect(mockedCompanionOrgService.linkByParent).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: "parent_1",
        patientId: "comp_1",
        organisationId: "org_1",
        organisationType: "HOSPITAL",
      }),
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
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      AppointmentPrismaService.getById("missing", { organisationId: "org_1" }),
    ).rejects.toMatchObject({
      message: "Appointment not found",
      statusCode: 404,
    });
  });

  describe("getById org-scoping and own-scope (IDOR)", () => {
    it("resolves a parent-scoped read without an organisation (mobile preserved)", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(makeRow());
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        parentId: "parent_1",
      });

      expect(mockedPrisma.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: "appt_1" },
      });
      expect(mockedPrisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(result.id).toBe("appt_1");
    });

    it("binds to organisationId via findFirst when org is supplied", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_1",
      });

      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: "appt_1", organisationId: "org_1" },
      });
      expect(mockedPrisma.appointment.findUnique).not.toHaveBeenCalled();
      expect(result.id).toBe("appt_1");
    });

    it("returns 404 for a cross-org id when org is supplied (no cross-tenant leak)", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.getById("appt_in_org_b", {
          organisationId: "org_a",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: "appt_in_org_b", organisationId: "org_a" },
      });
    });

    it("own-scope: returns the appointment when assigned to the actor", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1", lead: { id: "vet_1", name: "V" } }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_1",
        actorId: "vet_1",
      });

      expect(result.id).toBe("appt_1");
    });

    it("own-scope: returns 404 for an in-org appointment not assigned to the actor", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          organisationId: "org_1",
          lead: { id: "other_vet", name: "Other" },
        }),
      );

      await expect(
        AppointmentPrismaService.getById("appt_1", {
          organisationId: "org_1",
          actorId: "vet_1",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("allows the linked parent to read the appointment", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          organisationId: "org_2",
          patient: {
            id: "comp_1",
            name: "Buddy",
            species: "Dog",
            breed: "Labrador",
            parent: { id: "parent_1", name: "Parent One" },
          },
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_2",
        parentId: "parent_1",
      });

      expect(result).toMatchObject({ id: "appt_1" });
    });

    it("own-scope: returns the appointment when the actor is assigned support staff (not lead)", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          organisationId: "org_1",
          lead: { id: "other_vet", name: "Other" },
          supportStaff: [{ id: "staff_1", name: "Assistant" }],
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_1",
        actorId: "staff_1",
      });

      expect(result.id).toBe("appt_1");
    });
  });

  it("shows booking payment as paid while the final invoice remains unpaid", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(
      makeRow({
        organisationId: "org_2",
      }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([
      {
        appointmentId: "appt_1",
        status: "AWAITING_PAYMENT",
        depositCollectedAmount: 25,
        payments: [{ id: "pay_1" }],
      },
    ]);

    const result = await AppointmentPrismaService.getById("appt_1", {
      organisationId: "org_2",
    });

    expect((result as any).paymentStatus).toBe("UNPAID");
    expect((result as any).bookingPaymentStatus).toBe("PAID");
  });

  it("treats a succeeded payment attempt as a booking payment signal", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(
      makeRow({
        organisationId: "org_2",
      }),
    );
    mockedPrisma.invoice.findMany.mockResolvedValue([
      {
        appointmentId: "appt_1",
        status: "AWAITING_PAYMENT",
        depositCollectedAmount: 0,
        paymentAttempts: [{ id: "attempt_1" }],
        payments: [],
      },
    ]);

    const result = await AppointmentPrismaService.getById("appt_1", {
      organisationId: "org_2",
    });

    expect((result as any).paymentStatus).toBe("UNPAID");
    expect((result as any).bookingPaymentStatus).toBe("PAID");
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
    mockedPrisma.appointment.findFirst.mockResolvedValue(
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

    const result = await AppointmentPrismaService.checkInAppointment(
      "appt_1",
      "org_1",
    );

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
    expect(mockedPrisma.admission.upsert).not.toHaveBeenCalled();
    expect(
      mockedInvoiceService.markAppointmentReadyForBilling,
    ).not.toHaveBeenCalled();
    expect((result as any).encounterId).toBe("enc_1");
  });

  it("creates an outpatient case on check-in when one does not exist", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(
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

    const result = await AppointmentPrismaService.checkInAppointment(
      "appt_1",
      "org_1",
    );

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
    expect(
      mockedInvoiceService.markAppointmentReadyForBilling,
    ).not.toHaveBeenCalled();
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
      // Seeded at check-in with the booked slot (16:00, in the future relative to
      // the 12:00 admission). Admission must overwrite it with the real start.
      periodStart: new Date("2026-06-11T16:00:00.000Z"),
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
      "org_1",
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
          // The future booked slot (16:00) is replaced by the real admission time.
          periodStart: new Date("2026-06-11T12:00:00.000Z"),
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
      "org_1",
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
      "org_1",
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
      AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
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
    ).toHaveBeenCalledWith("appt_1", { organisationId: "org_1" });
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
      AppointmentPrismaService.createRequestedFromMobile(
        {
          resourceType: "Appointment",
        } as any,
        "parent_1",
      ),
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
      AppointmentPrismaService.createRequestedFromMobile(
        {
          resourceType: "Appointment",
        } as any,
        "parent_1",
      ),
    ).rejects.toMatchObject({
      message: "caseId is required when encounterId is provided.",
      statusCode: 400,
    });
  });
  describe("cross-tenant scoping (IDOR)", () => {
    it("checks in an appointment that belongs to the caller's organisation", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1", encounterId: "enc_1" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CHECKED_IN", encounterId: "enc_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.checkInAppointment(
        "appt_1",
        "org_1",
      );

      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: "appt_1", organisationId: "org_1" },
      });
      expect(result.id).toBe("appt_1");
    });

    it("returns 404 when checking in another tenant's appointment", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.checkInAppointment("appt_in_org_b", "org_a"),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: "appt_in_org_b", organisationId: "org_a" },
      });
      expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it("returns 404 when admitting another tenant's appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: "enc_1",
          organisationId: "org_b",
        }),
      );

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_in_org_b",
          "org_a",
        ),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
      expect(mockedPrisma.admission.upsert).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it("attaches forms owned by the caller's organisation", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ formIds: ["form_1"] }),
      );
      mockedPrisma.form.findMany.mockResolvedValue([{ id: "form_2" }] as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ formIds: ["form_1", "form_2"] }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.attachFormsToAppointment(
        "appt_1",
        "org_1",
        ["form_2"],
      );

      expect(mockedPrisma.form.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["form_2"] }, orgId: "org_1" },
        select: { id: true },
      });
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "appt_1" },
        data: expect.objectContaining({ formIds: ["form_1", "form_2"] }),
      });
    });

    it("returns 404 when attaching forms to another tenant's appointment", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.attachFormsToAppointment(
          "appt_in_org_b",
          "org_a",
          ["form_1"],
        ),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
      expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it("rejects forms that belong to another organisation", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ formIds: ["form_1"] }),
      );
      mockedPrisma.form.findMany.mockResolvedValue([{ id: "form_2" }] as any);

      await expect(
        AppointmentPrismaService.attachFormsToAppointment("appt_1", "org_1", [
          "form_2",
          "form_from_org_b",
        ]),
      ).rejects.toMatchObject({
        message: "Form not found",
        statusCode: 404,
      });
      expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it("does not query forms when none are supplied", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ formIds: ["form_1"] }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ formIds: ["form_1"] }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.attachFormsToAppointment(
        "appt_1",
        "org_1",
        [],
      );

      expect(mockedPrisma.form.findMany).not.toHaveBeenCalled();
    });

    it("rejects a mobile booking for a parent the caller is not", async () => {
      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "other_parent",
        ),
      ).rejects.toMatchObject({
        message: "You are not allowed to book appointments for this parent.",
        statusCode: 403,
      });
      expect(mockedPrisma.appointment.create).not.toHaveBeenCalled();
      expect(mockedCompanionOrgService.linkByParent).not.toHaveBeenCalled();
    });

    it("requires an authenticated parent for a mobile booking", async () => {
      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "",
        ),
      ).rejects.toMatchObject({
        message: "authParentId is required",
        statusCode: 400,
      });
      expect(mockedPrisma.appointment.create).not.toHaveBeenCalled();
    });
  });

  describe("createAppointment validation branches", () => {
    it("rejects an invalid start/end time (NaN)", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        startTime: new Date("not-a-date"),
        endTime: new Date("not-a-date"),
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Valid startTime and endTime are required.",
        statusCode: 400,
      });
      expect(mockedPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it("rejects when endTime is not after startTime", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        startTime: new Date("2026-06-10T11:00:00.000Z"),
        endTime: new Date("2026-06-10T10:00:00.000Z"),
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "endTime must be after startTime.",
        statusCode: 400,
      });
    });

    it("rejects when the appointment type id is missing", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        appointmentType: { id: "  " },
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment type is required.",
        statusCode: 400,
      });
    });

    it("wraps a CatalogServiceError into an AppointmentPrismaServiceError", async () => {
      const { CatalogServiceError } = jest.requireMock(
        "../../src/services/catalog.service",
      ) as { CatalogServiceError: new (m: string, s: number) => Error };
      mockedResolveSelection.mockImplementation(async () => {
        throw new CatalogServiceError("Product unavailable", 402);
      });

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Product unavailable",
        statusCode: 402,
      });
    });

    it("re-throws a non-catalog error from selection resolution", async () => {
      mockedResolveSelection.mockImplementation(async () => {
        throw new Error("network down");
      });

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toThrow("network down");
    });

    it("rejects a product that is not bookable", async () => {
      mockedResolveSelection.mockImplementation(async () => ({
        productItemId: "product_1",
        isBookable: false,
        appointmentKinds: ["INPATIENT"],
        templateKinds: [],
        templateBindings: [],
      }));

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Selected product is not bookable.",
        statusCode: 400,
      });
    });

    it("throws 404 when the organisation type cannot be resolved", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Unable to resolve organisation type for appointment booking.",
        statusCode: 404,
      });
      expect(mockedCompanionOrgService.linkByParent).not.toHaveBeenCalled();
    });
  });

  describe("resolveCaseContext branches", () => {
    it("throws 404 when the supplied case does not exist", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Case not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the case belongs to another organisation", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_other",
        patientId: "comp_1",
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment case organisation mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the case belongs to another companion", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_other",
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment case companion mismatch.",
        statusCode: 409,
      });
    });
  });

  describe("assertEncounterMatchesAppointmentContext branches", () => {
    const withEncounter = () =>
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        caseId: "case_1",
        encounterId: "enc_1",
      } as any);

    beforeEach(() => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
    });

    it("throws 404 when the encounter is not found", async () => {
      withEncounter();
      mockedPrisma.encounter.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Encounter not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the encounter belongs to another case", async () => {
      withEncounter();
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_other",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment encounter must belong to the selected case.",
        statusCode: 409,
      });
    });

    it("throws 409 when the encounter belongs to another organisation", async () => {
      withEncounter();
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_1",
        organisationId: "org_other",
        patientId: "comp_1",
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment encounter organisation mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the encounter belongs to another companion", async () => {
      withEncounter();
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_1",
        organisationId: "org_1",
        patientId: "comp_other",
      } as any);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment encounter companion mismatch.",
        statusCode: 409,
      });
    });
  });

  describe("resolveTemplateDefaultsForSelection branches", () => {
    beforeEach(() => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
      mockedPrisma.appointment.create.mockResolvedValue(
        makeRow({ status: "REQUESTED", caseId: "case_1" }),
      );
    });

    it("throws 404 when a bound template cannot be found", async () => {
      mockedResolveSelection.mockImplementation(async () => ({
        productItemId: "product_1",
        isBookable: true,
        appointmentKinds: ["OUTPATIENT", "INPATIENT"],
        templateKinds: ["SOAP_NOTE"],
        templateBindings: [
          { templateKind: "SOAP_NOTE", templateId: "tmpl_missing" },
        ],
      }));
      mockedPrisma.template.findFirst.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.createRequestedFromMobile(
          { resourceType: "Appointment" } as any,
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "Bound template tmpl_missing was not found.",
        statusCode: 404,
      });
    });

    it("falls back to a published YC library template as a LIBRARY_DEFAULT", async () => {
      mockedResolveSelection.mockImplementation(async () => ({
        productItemId: "product_1",
        isBookable: true,
        appointmentKinds: ["OUTPATIENT", "INPATIENT"],
        templateKinds: ["SOAP_NOTE"],
        templateBindings: [],
      }));
      mockedPrisma.template.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "tmpl_lib",
          kind: "SOAP_NOTE",
          organisationId: null,
          ownership: "YC_LIBRARY",
          status: "PUBLISHED",
          latestVersion: 2,
          publishedVersion: null,
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
                templateId: "tmpl_lib",
                templateVersion: 2,
                source: "LIBRARY_DEFAULT",
              },
            ],
          },
        }),
      );

      const result = await AppointmentPrismaService.createRequestedFromMobile(
        { resourceType: "Appointment" } as any,
        "parent_1",
      );

      expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentType: expect.objectContaining({
              templateDefaults: [
                expect.objectContaining({
                  templateId: "tmpl_lib",
                  templateVersion: 2,
                  source: "LIBRARY_DEFAULT",
                }),
              ],
            }),
          }),
        }),
      );
      expect((result as any).templateDefaults[0].source).toBe(
        "LIBRARY_DEFAULT",
      );
    });

    it("emits no template defaults when no template can be resolved", async () => {
      mockedResolveSelection.mockImplementation(async () => ({
        productItemId: "product_1",
        isBookable: true,
        appointmentKinds: ["OUTPATIENT", "INPATIENT"],
        templateKinds: ["SOAP_NOTE"],
        templateBindings: [],
      }));
      mockedPrisma.template.findFirst.mockResolvedValue(null);

      await AppointmentPrismaService.createRequestedFromMobile(
        { resourceType: "Appointment" } as any,
        "parent_1",
      );

      expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentType: expect.objectContaining({
              templateDefaults: [],
            }),
          }),
        }),
      );
    });
  });

  describe("createAppointmentFromPms payment branches", () => {
    beforeEach(() => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
      mockedPrisma.appointment.create.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1" }),
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1" }),
      );
    });

    it("rejects an invalid payment collection method", async () => {
      await expect(
        AppointmentPrismaService.createAppointmentFromPms(
          { resourceType: "Appointment" } as any,
          false,
          "TELEPATHY",
        ),
      ).rejects.toMatchObject({
        message: "Invalid payment collection method.",
        statusCode: 400,
      });
    });

    it("creates a payment intent for the PAYMENT_INTENT method", async () => {
      mockedInvoiceService.bootstrapForAppointment.mockResolvedValue({
        id: "inv_1",
        organisationId: "org_1",
      } as never);

      await AppointmentPrismaService.createAppointmentFromPms(
        { resourceType: "Appointment" } as any,
        true,
        "PAYMENT_INTENT",
      );

      expect(
        mockedFinancePaymentService.FinancePaymentService
          .createPaymentIntentForInvoice,
      ).toHaveBeenCalledWith("inv_1", { organisationId: "org_1" });
      expect(
        mockedInvoiceService.createCheckoutSessionAndEmailParent,
      ).not.toHaveBeenCalled();
    });

    it("bootstraps an invoice without creating payment when createPayment is false", async () => {
      mockedInvoiceService.bootstrapForAppointment.mockResolvedValue({
        id: "inv_1",
        organisationId: "org_1",
      } as never);

      await AppointmentPrismaService.createAppointmentFromPms(
        { resourceType: "Appointment" } as any,
        false,
        "PAYMENT_LINK",
      );

      expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
        "appt_1",
        "PAYMENT_LINK",
      );
      expect(
        mockedInvoiceService.createCheckoutSessionAndEmailParent,
      ).not.toHaveBeenCalled();
      expect(
        mockedFinancePaymentService.FinancePaymentService
          .createPaymentIntentForInvoice,
      ).not.toHaveBeenCalled();
    });

    it("throws 500 when the created appointment has no string id", async () => {
      mockedPrisma.appointment.create.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1", id: 123 as any }),
      );

      await expect(
        AppointmentPrismaService.createAppointmentFromPms(
          { resourceType: "Appointment" } as any,
          false,
          "PAYMENT_LINK",
        ),
      ).rejects.toMatchObject({
        message: "Appointment ID is required",
        statusCode: 500,
      });
    });
  });

  describe("approveRequestedFromPms", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.approveRequestedFromPms("", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("throws 404 when the appointment does not exist", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.approveRequestedFromPms("appt_1", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("rejects a transition from a terminal status", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "COMPLETED" }),
      );

      await expect(
        AppointmentPrismaService.approveRequestedFromPms("appt_1", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("requires a lead vet to approve", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "REQUESTED" }),
      );
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        lead: undefined,
      } as any);

      await expect(
        AppointmentPrismaService.approveRequestedFromPms("appt_1", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        message: "Lead vet is required to approve an appointment.",
        statusCode: 400,
      });
    });

    it("approves a requested appointment and books lead occupancy", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "REQUESTED", caseId: "case_1" }),
      );
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.approveRequestedFromPms(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(mockedPrisma.occupancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "lead_1",
            referenceId: "appt_1",
          }),
        }),
      );
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appt_1" },
          data: expect.objectContaining({ caseId: "case_1" }),
        }),
      );
      expect(result.status).toBe("UPCOMING");
    });
  });

  describe("rejectRequestedAppointment", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.rejectRequestedAppointment(""),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("throws 404 when the appointment does not exist", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.rejectRequestedAppointment("appt_1"),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("cancels a requested appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "REQUESTED" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CANCELLED" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result =
        await AppointmentPrismaService.rejectRequestedAppointment("appt_1");

      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "appt_1" },
        data: { status: "CANCELLED", updatedAt: expect.any(Date) },
      });
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("checkInAppointmentParent", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.checkInAppointmentParent("", "parent_1"),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires a parentId", async () => {
      await expect(
        AppointmentPrismaService.checkInAppointmentParent("appt_1", ""),
      ).rejects.toMatchObject({
        message: "parentId is required",
        statusCode: 400,
      });
    });

    it("blocks check-in when the parent does not own the appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          patient: {
            ...baseDomain.patient,
            parent: { id: "other_parent", name: "Other" },
          },
        }),
      );

      await expect(
        AppointmentPrismaService.checkInAppointmentParent("appt_1", "parent_1"),
      ).rejects.toMatchObject({
        message: "You are not allowed to modify this appointment.",
        statusCode: 403,
      });
    });

    it("checks in an appointment that already has an encounter", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.checkInAppointmentParent(
        "appt_1",
        "parent_1",
      );

      expect(mockedPrisma.encounter.create).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appt_1" },
          data: expect.objectContaining({
            status: "CHECKED_IN",
            encounterId: "enc_1",
          }),
        }),
      );
      expect(result.status).toBe("CHECKED_IN");
    });
  });

  describe("checkInAppointment guard clauses", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.checkInAppointment("", "org_1"),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires an organisationId", async () => {
      await expect(
        AppointmentPrismaService.checkInAppointment("appt_1", ""),
      ).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });
    });

    it("resolves a case via resolveCaseContext for an inpatient check-in without a case", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          appointmentKind: "INPATIENT",
          caseId: null,
          encounterId: null,
        }),
      );
      mockedPrisma.case.create.mockResolvedValue({ id: "case_ip" } as any);
      mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_ip" } as any);
      mockedPrisma.appointment.update
        .mockResolvedValueOnce({ id: "appt_1" } as any)
        .mockResolvedValueOnce(
          makeRow({
            status: "CHECKED_IN",
            appointmentKind: "INPATIENT",
            caseId: "case_ip",
            encounterId: "enc_ip",
          }),
        );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.checkInAppointment(
        "appt_1",
        "org_1",
      );

      expect(mockedPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentKind: "INPATIENT",
            title: "Inpatient case",
          }),
        }),
      );
      expect((result as any).caseId).toBe("case_ip");
    });

    it("throws 400 when a case cannot be resolved during check-in", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: null,
        }),
      );
      mockedPrisma.case.create.mockResolvedValue({ id: null } as any);

      await expect(
        AppointmentPrismaService.checkInAppointment("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "caseId could not be resolved for check-in.",
        statusCode: 400,
      });
    });
  });

  describe("admitAppointmentToInpatient guard clauses", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("", "org_1"),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires an organisationId", async () => {
      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", ""),
      ).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });
    });

    it("rejects an invalid admittedAt", async () => {
      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { admittedAt: new Date("nope") },
        ),
      ).rejects.toMatchObject({
        message: "Invalid admittedAt.",
        statusCode: 400,
      });
    });

    it("rejects a negative expectedStayDays", async () => {
      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { expectedStayDays: -1 },
        ),
      ).rejects.toMatchObject({
        message: "expectedStayDays must be a non-negative integer.",
        statusCode: 400,
      });
    });

    it("throws 404 when the appointment does not exist", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("throws 400 when the appointment has no encounter yet", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "CHECKED_IN", caseId: "case_1", encounterId: null }),
      );

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Appointment must be checked in before admitting.",
        statusCode: 400,
      });
    });
  });

  describe("admit encounter/admission validation", () => {
    const baseAdmitRow = () =>
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "OUTPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      });

    it("throws 404 when the encounter is not found", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
      mockedPrisma.encounter.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Encounter not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the encounter organisation mismatches", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_1",
        organisationId: "org_other",
        patientId: "comp_1",
        status: "arrived",
        encounterClass: "AMB",
        appointmentKind: "OUTPATIENT",
        periodStart: null,
        periodEnd: null,
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Appointment encounter organisation mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the encounter companion mismatches", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_1",
        organisationId: "org_1",
        patientId: "comp_other",
        status: "arrived",
        encounterClass: "AMB",
        appointmentKind: "OUTPATIENT",
        periodStart: null,
        periodEnd: null,
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Appointment encounter companion mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the encounter is not part of the appointment case", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: "case_other",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "arrived",
        encounterClass: "AMB",
        appointmentKind: "OUTPATIENT",
        periodStart: null,
        periodEnd: null,
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Appointment encounter must belong to the selected case.",
        statusCode: 409,
      });
    });

    it("throws 409 when the admission is already discharged", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
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
      mockedPrisma.admission.findUnique.mockResolvedValue({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:00:00.000Z"),
        dischargedAt: new Date("2026-06-12T10:00:00.000Z"),
        createdAt: new Date("2026-06-11T10:00:00.000Z"),
        updatedAt: new Date("2026-06-12T10:00:00.000Z"),
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Admission is already discharged.",
        statusCode: 409,
      });
    });

    it("throws 400 when no case id can be resolved for admission", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_1",
        caseId: null,
        organisationId: "org_1",
        patientId: "comp_1",
        status: "arrived",
        encounterClass: "AMB",
        appointmentKind: "OUTPATIENT",
        periodStart: null,
        periodEnd: null,
      } as any);
      mockedPrisma.admission.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Encounter caseId is required for inpatient admission.",
        statusCode: 400,
      });
    });

    it("throws 500 when the admission cannot be re-read after admit", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(baseAdmitRow());
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
      mockedPrisma.admission.findUnique.mockResolvedValue(null);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_1" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(baseAdmitRow());

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient("appt_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Admission could not be resolved after admit.",
        statusCode: 500,
      });
    });
  });

  describe("admitInpatientRoomUnit branches", () => {
    const admitRow = () =>
      makeRow({
        status: "CHECKED_IN",
        appointmentKind: "INPATIENT",
        caseId: "case_1",
        encounterId: "enc_1",
      });
    const inpatientEncounter = () => ({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "arrived",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      periodStart: null,
      periodEnd: null,
    });
    const activeUnit = (overrides: Record<string, unknown> = {}) => ({
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
      ...overrides,
    });

    beforeEach(() => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(admitRow());
      mockedPrisma.encounter.findUnique.mockResolvedValue(
        inpatientEncounter() as any,
      );
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_1" } as any);
      mockedPrisma.admission.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          encounterId: "enc_1",
          organisationId: "org_1",
          patientId: "comp_1",
          unitId: "unit_1",
          expectedStayDays: null,
          admittedAt: new Date("2026-06-11T12:00:00.000Z"),
          dischargedAt: null,
          createdAt: new Date("2026-06-11T12:00:00.000Z"),
          updatedAt: new Date("2026-06-11T12:00:00.000Z"),
        } as any);
      mockedPrisma.appointment.update.mockResolvedValue(admitRow());
    });

    it("requires a non-blank roomUnitId", async () => {
      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "   " },
        ),
      ).rejects.toMatchObject({
        message: "roomUnitId is required.",
        statusCode: 400,
      });
    });

    it("throws 404 when the room unit is not found", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Room unit not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the room unit belongs to another organisation", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ organisationId: "org_other" }) as any,
      );

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Unit organisation mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the room unit is inactive", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ isActive: false }) as any,
      );

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Selected unit is inactive.",
        statusCode: 409,
      });
    });

    it("throws 404 when the companion cannot be found", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit() as any);
      mockedPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Companion not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the room unit species constraints exclude the companion", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ speciesConstraints: ["equine"] }) as any,
      );

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Room unit is not compatible with this companion's species.",
        statusCode: 409,
      });
    });

    it("ignores empty species constraints (non-array)", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ speciesConstraints: null }) as any,
      );

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        { roomUnitId: "unit_1" },
      );

      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalled();
      expect(result.admission.unitId).toBe("unit_1");
    });

    it("throws 404 when the unit group cannot be found", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ unitGroupId: "group_1" }) as any,
      );
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Room unit group not found.",
        statusCode: 404,
      });
    });

    it("throws 409 when the unit group belongs to another organisation", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ unitGroupId: "group_1" }) as any,
      );
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_other",
        roomId: "room_1",
        name: "Group",
        size: "L",
        unitCount: 4,
        speciesConstraints: [],
        capabilities: [],
        isActive: true,
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Room unit group organisation mismatch.",
        statusCode: 409,
      });
    });

    it("throws 409 when the unit group species constraints exclude the companion", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ unitGroupId: "group_1" }) as any,
      );
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Group",
        size: "L",
        unitCount: 4,
        speciesConstraints: ["equine"],
        capabilities: [],
        isActive: true,
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message:
          "Room unit group is not compatible with this companion's species.",
        statusCode: 409,
      });
    });

    it("skips species checks for a unit group with no constraints", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ unitGroupId: "group_1" }) as any,
      );
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Group",
        size: "L",
        unitCount: 4,
        speciesConstraints: [],
        capabilities: [],
        isActive: true,
      } as any);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        { roomUnitId: "unit_1" },
      );

      expect(result.admission.unitId).toBe("unit_1");
    });

    it("admits through a compatible unit group", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(
        activeUnit({ unitGroupId: "group_1" }) as any,
      );
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Group",
        size: "L",
        unitCount: 4,
        speciesConstraints: ["dog"],
        capabilities: [],
        isActive: true,
      } as any);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        { roomUnitId: "unit_1" },
      );

      expect(mockedPrisma.roomUnitGroup.findUnique).toHaveBeenCalledWith({
        where: { id: "group_1" },
      });
      expect(result.admission.unitId).toBe("unit_1");
    });

    it("throws 409 when the unit is already occupied by another admission", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit() as any);
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValueOnce({
        id: "assign_conflict",
        encounterId: "enc_other",
        admissionId: "enc_other",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T09:00:00.000Z"),
        releasedAt: null,
        assignedBy: null,
        reason: null,
        createdAt: new Date("2026-06-11T09:00:00.000Z"),
        updatedAt: new Date("2026-06-11T09:00:00.000Z"),
      } as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1" },
        ),
      ).rejects.toMatchObject({
        message: "Room unit is already occupied.",
        statusCode: 409,
      });
    });

    it("rejects an invalid assignedAt during room assignment", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit() as any);

      await expect(
        AppointmentPrismaService.admitAppointmentToInpatient(
          "appt_1",
          "org_1",
          { roomUnitId: "unit_1", assignedAt: new Date("bad") },
        ),
      ).rejects.toMatchObject({
        message: "Invalid assignedAt.",
        statusCode: 400,
      });
    });

    it("releases an existing assignment before creating a new one", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit() as any);
      mockedPrisma.roomUnitAssignment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "assign_old",
          encounterId: "enc_1",
          admissionId: "enc_1",
          unitId: "unit_old",
          assignedAt: new Date("2026-06-10T09:00:00.000Z"),
          releasedAt: null,
          assignedBy: null,
          reason: null,
          createdAt: new Date("2026-06-10T09:00:00.000Z"),
          updatedAt: new Date("2026-06-10T09:00:00.000Z"),
        } as any);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        {
          roomUnitId: "unit_1",
          assignedBy: "user_1",
          assignmentReason: "move",
        },
      );

      expect(mockedPrisma.roomUnitAssignment.update).toHaveBeenCalledWith({
        where: { id: "assign_old" },
        data: { releasedAt: expect.any(Date) },
      });
      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitId: "unit_1",
            assignedBy: "user_1",
            reason: "move",
          }),
        }),
      );
      expect(result.admission.unitId).toBe("unit_1");
    });

    it("keeps the existing assignment when it already points at the same unit", async () => {
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit() as any);
      mockedPrisma.roomUnitAssignment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "assign_same",
          encounterId: "enc_1",
          admissionId: "enc_1",
          unitId: "unit_1",
          assignedAt: new Date("2026-06-10T09:00:00.000Z"),
          releasedAt: null,
          assignedBy: null,
          reason: null,
          createdAt: new Date("2026-06-10T09:00:00.000Z"),
          updatedAt: new Date("2026-06-10T09:00:00.000Z"),
        } as any);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        { roomUnitId: "unit_1" },
      );

      expect(mockedPrisma.roomUnitAssignment.update).not.toHaveBeenCalled();
      expect(mockedPrisma.roomUnitAssignment.create).not.toHaveBeenCalled();
      expect(result.unitAssignment?.unitId).toBe("unit_1");
    });
  });

  describe("rescheduleFromParent guard clauses", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.rescheduleFromParent("", "parent_1", {
          startTime: "2026-06-10T11:00:00.000Z",
          endTime: "2026-06-10T11:30:00.000Z",
        }),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires a parentId", async () => {
      await expect(
        AppointmentPrismaService.rescheduleFromParent("appt_1", "", {
          startTime: "2026-06-10T11:00:00.000Z",
          endTime: "2026-06-10T11:30:00.000Z",
        }),
      ).rejects.toMatchObject({
        message: "parentId is required",
        statusCode: 400,
      });
    });

    it("rejects rescheduling a completed appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "COMPLETED" }),
      );

      await expect(
        AppointmentPrismaService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: "2026-06-10T11:00:00.000Z",
          endTime: "2026-06-10T11:30:00.000Z",
        }),
      ).rejects.toMatchObject({
        message: "Completed or cancelled appointments cannot be rescheduled.",
        statusCode: 400,
      });
    });

    it("reschedules a checked-in appointment without resetting to requested", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "CHECKED_IN" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CHECKED_IN", durationMinutes: 45 }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.rescheduleFromParent(
        "appt_1",
        "parent_1",
        {
          startTime: new Date("2026-06-10T11:00:00.000Z"),
          endTime: new Date("2026-06-10T11:45:00.000Z"),
          durationMinutes: 45,
          concern: "Follow up",
          isEmergency: true,
        },
      );

      expect(mockedPrisma.occupancy.deleteMany).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CHECKED_IN",
            durationMinutes: 45,
            concern: "Follow up",
            isEmergency: true,
          }),
        }),
      );
      expect(result.status).toBe("CHECKED_IN");
    });
  });

  describe("updateAppointmentPMS", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.updateAppointmentPMS("", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("throws 404 when the appointment does not exist", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.updateAppointmentPMS("appt_1", {
          resourceType: "Appointment",
        } as any),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("books lead occupancy when the update keeps the appointment upcoming", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "UPCOMING",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1", encounterId: "enc_1" }),
      );
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
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1", encounterId: "enc_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.updateAppointmentPMS(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(mockedPrisma.occupancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "lead_1" }),
        }),
      );
      expect(
        mockedInvoiceService.markAppointmentReadyForBilling,
      ).not.toHaveBeenCalled();
      expect(result.status).toBe("UPCOMING");
    });

    const seedInProgressTransition = (encounter: Record<string, unknown>) => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
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
        ...encounter,
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_1" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);
    };

    it("stamps the encounter actual-start when the appointment goes IN_PROGRESS (bug #1903)", async () => {
      // periodStart was seeded at check-in with the booked slot; the transition
      // must overwrite it with the real start so the visit timer runs.
      seedInProgressTransition({
        status: "arrived",
        periodStart: new Date("2026-06-10T10:00:00.000Z"),
      });

      const before = Date.now();
      const result = await AppointmentPrismaService.updateAppointmentPMS(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enc_1" },
          data: expect.objectContaining({ status: "in-progress" }),
        }),
      );
      const stampCall = mockedPrisma.encounter.update.mock.calls.find(
        ([arg]: any[]) =>
          arg?.where?.id === "enc_1" && arg?.data?.status === "in-progress",
      );
      const stampedPeriodStart = stampCall?.[0]?.data?.periodStart as Date;
      expect(stampedPeriodStart).toBeInstanceOf(Date);
      // The stamped start is the real transition time, not the booked slot.
      expect(stampedPeriodStart.getTime()).toBeGreaterThanOrEqual(before);
      expect(stampedPeriodStart.getTime()).not.toBe(
        new Date("2026-06-10T10:00:00.000Z").getTime(),
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("creates and stamps an encounter when the appointment goes IN_PROGRESS without one (bug #1903)", async () => {
      // A checked-in appointment can lack an encounter (e.g. CHECKED_IN set from the edit form
      // rather than the encounter-creating check-in action). The transition must create one and
      // stamp its actual-start, otherwise the visit timer would stay "Not started" forever.
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "CHECKED_IN", caseId: "case_1", encounterId: null }),
      );
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
      mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_new" } as any);
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_new",
        status: "arrived",
        periodStart: new Date("2026-06-10T10:00:00.000Z"),
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_new" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_new",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const before = Date.now();
      const result = await AppointmentPrismaService.updateAppointmentPMS(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      // A new encounter is created for the checked-in appointment that had none...
      expect(mockedPrisma.encounter.create).toHaveBeenCalled();
      // ...and its actual-start is stamped to the transition time so the timer runs.
      const stampCall = mockedPrisma.encounter.update.mock.calls.find(
        ([arg]: any[]) =>
          arg?.where?.id === "enc_new" && arg?.data?.status === "in-progress",
      );
      const stampedPeriodStart = stampCall?.[0]?.data?.periodStart as Date;
      expect(stampedPeriodStart).toBeInstanceOf(Date);
      expect(stampedPeriodStart.getTime()).toBeGreaterThanOrEqual(before);
      // The freshly-linked encounter/case are persisted on the appointment, not nulled out.
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appt_1" },
          data: expect.objectContaining({
            encounterId: "enc_new",
            caseId: "case_1",
          }),
        }),
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("builds the ensured encounter from the patched patient, not the pre-update row", async () => {
      // A request that both starts the appointment AND changes the companion must create the new
      // encounter for the PATCHED patient, matching the appointment the update writes (Codex).
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
        patient: {
          id: "comp_new",
          name: "New Pet",
          parent: { id: "parent_new" },
        },
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: null,
          patient: {
            id: "comp_old",
            name: "Old Pet",
            parent: { id: "parent_old" },
          },
        }),
      );
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_new",
      } as any);
      mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_new" } as any);
      mockedPrisma.encounter.findUnique.mockResolvedValue({
        id: "enc_new",
        status: "arrived",
        periodStart: new Date("2026-06-10T10:00:00.000Z"),
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_new" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_new",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.encounter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: "comp_new",
            parentId: "parent_new",
          }),
        }),
      );
    });

    it("preserves a recorded start and status when the encounter is already under way", async () => {
      seedInProgressTransition({
        status: "onleave",
        periodStart: new Date("2026-06-10T09:15:00.000Z"),
      });

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enc_1" },
          data: {
            status: "onleave",
            periodStart: new Date("2026-06-10T09:15:00.000Z"),
          },
        }),
      );
    });

    it("leaves a closed encounter untouched on an IN_PROGRESS update", async () => {
      seedInProgressTransition({
        status: "finished",
        periodStart: new Date("2026-06-10T09:15:00.000Z"),
      });

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
    });

    it("does not re-stamp when the appointment is already IN_PROGRESS", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
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
        status: "in-progress",
        periodStart: new Date("2026-06-10T09:15:00.000Z"),
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
    });
  });

  describe("cancelAppointmentFromParent", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.cancelAppointmentFromParent("", "parent_1"),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires a parentId", async () => {
      await expect(
        AppointmentPrismaService.cancelAppointmentFromParent("appt_1", ""),
      ).rejects.toMatchObject({
        message: "parentId is required",
        statusCode: 400,
      });
    });

    it("blocks cancellation when the parent does not own the appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          patient: {
            ...baseDomain.patient,
            parent: { id: "other_parent", name: "Other" },
          },
        }),
      );

      await expect(
        AppointmentPrismaService.cancelAppointmentFromParent(
          "appt_1",
          "parent_1",
        ),
      ).rejects.toMatchObject({
        message: "You are not allowed to modify this appointment.",
        statusCode: 403,
      });
    });

    it("cancels an owned appointment and clears occupancy", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "UPCOMING" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CANCELLED" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.cancelAppointmentFromParent(
        "appt_1",
        "parent_1",
      );

      expect(mockedPrisma.occupancy.deleteMany).toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "appt_1" },
        data: { status: "CANCELLED", updatedAt: expect.any(Date) },
      });
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("cancelAppointment", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.cancelAppointment(""),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("throws 404 when the appointment does not exist", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        AppointmentPrismaService.cancelAppointment("appt_1"),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("cancels an upcoming appointment", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "UPCOMING" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CANCELLED" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.cancelAppointment("appt_1");

      expect(mockedPrisma.occupancy.deleteMany).toHaveBeenCalled();
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("getById guard clauses and payment states", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.getById("", { organisationId: "org_1" }),
      ).rejects.toMatchObject({
        message: "Appointment ID is required",
        statusCode: 400,
      });
    });

    it("reports a fully paid invoice as PAID", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([
        {
          appointmentId: "appt_1",
          status: "PAID",
          depositCollectedAmount: 0,
          paymentAttempts: [],
          payments: [{ id: "pay_1" }],
        },
      ]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_1",
      });

      expect((result as any).paymentStatus).toBe("PAID");
      expect((result as any).bookingPaymentStatus).toBe("PAID");
    });

    it("reports an unpaid invoice with no payment as UNPAID booking", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([
        {
          appointmentId: "appt_1",
          status: "PENDING",
          depositCollectedAmount: 0,
          paymentAttempts: [],
          payments: [],
        },
      ]);

      const result = await AppointmentPrismaService.getById("appt_1", {
        organisationId: "org_1",
      });

      expect((result as any).paymentStatus).toBe("UNPAID");
      expect((result as any).bookingPaymentStatus).toBe("UNPAID");
    });
  });

  describe("appointment list endpoints", () => {
    it("requires a patientId for companion appointments", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForCompanion(""),
      ).rejects.toMatchObject({
        message: "patientId is required",
        statusCode: 400,
      });
    });

    it("lists appointments for a companion", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result =
        await AppointmentPrismaService.getAppointmentsForCompanion("comp_1");

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startTime: "desc" } }),
      );
      expect(result).toHaveLength(1);
    });

    it("returns blank payment maps when every appointment id is empty", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([
        makeRow({ id: "" }),
      ]);

      const result =
        await AppointmentPrismaService.getAppointmentsForCompanion("comp_1");

      expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect((result[0] as any).paymentStatus).toBe("UNPAID");
    });

    it("requires a patientId for companion-by-organisation", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForCompanionByOrganisation(
          "",
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "patientId is required",
        statusCode: 400,
      });
    });

    it("requires an organisationId for companion-by-organisation", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForCompanionByOrganisation(
          "comp_1",
          "",
        ),
      ).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });
    });

    it("lists appointments for a companion within an organisation", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result =
        await AppointmentPrismaService.getAppointmentsForCompanionByOrganisation(
          "comp_1",
          "org_1",
        );

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org_1" }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it("requires a parentId for parent appointments", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForParent(""),
      ).rejects.toMatchObject({
        message: "parentId is required",
        statusCode: 400,
      });
    });

    it("lists appointments for a parent", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result =
        await AppointmentPrismaService.getAppointmentsForParent("parent_1");

      expect(result).toHaveLength(1);
    });

    it("requires an organisationId for organisation appointments", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForOrganisation(""),
      ).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });
    });

    it("lists organisation appointments with a date range filter", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.getAppointmentsForOrganisation("org_1", {
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      });

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org_1",
            startTime: expect.objectContaining({
              gte: new Date("2026-06-01T00:00:00.000Z"),
              lte: new Date("2026-06-30T00:00:00.000Z"),
            }),
          }),
        }),
      );
    });

    it("requires a leadId for lead appointments", async () => {
      await expect(
        AppointmentPrismaService.getAppointmentsForLead(""),
      ).rejects.toMatchObject({
        message: "leadId is required",
        statusCode: 400,
      });
    });

    it("lists appointments for a lead scoped by JSON lead id", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.getAppointmentsForLead(
        "lead_1",
        "org_1",
      );

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org_1",
            AND: expect.arrayContaining([
              expect.objectContaining({
                lead: expect.objectContaining({ equals: "lead_1" }),
              }),
            ]),
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("attachFormsToAppointment guard clauses", () => {
    it("requires an appointmentId", async () => {
      await expect(
        AppointmentPrismaService.attachFormsToAppointment("", "org_1", [
          "form_1",
        ]),
      ).rejects.toMatchObject({
        message: "appointmentId is required",
        statusCode: 400,
      });
    });

    it("requires an organisationId", async () => {
      await expect(
        AppointmentPrismaService.attachFormsToAppointment("appt_1", "", [
          "form_1",
        ]),
      ).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });
    });
  });

  describe("nullish and default branch coverage", () => {
    it("creates an appointment defaulting every omitted optional field", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        patient: { id: "comp_1", parent: { id: "parent_1" } },
        appointmentType: { id: "service_1", name: "Consultation" },
        appointmentKind: "OUTPATIENT",
        organisationId: "org_1",
        appointmentDate: new Date("2026-06-10T10:00:00.000Z"),
        startTime: new Date("2026-06-10T10:00:00.000Z"),
        endTime: new Date("2026-06-10T10:30:00.000Z"),
        timeSlot: "10:00",
        durationMinutes: 30,
      } as any);
      mockedPrisma.appointment.create.mockResolvedValue(
        makeRow({
          status: "REQUESTED",
          caseId: null,
          lead: null,
          supportStaff: null,
          room: null,
          appointmentType: null,
          attachments: null,
          concern: null,
          formIds: null,
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.createRequestedFromMobile(
        { resourceType: "Appointment" } as any,
        "parent_1",
      );

      expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supportStaff: [],
            isEmergency: false,
            concern: null,
            formIds: [],
            caseId: null,
          }),
        }),
      );
      // toDomain must fall back to undefined/[] for the null row fields.
      expect((result as any).lead).toBeUndefined();
      expect((result as any).room).toBeUndefined();
      expect((result as any).appointmentType).toBeUndefined();
      expect((result as any).concern).toBeUndefined();
      expect((result as any).formIds).toEqual([]);
    });

    it("resolves a bound template that omits an explicit version", async () => {
      mockedResolveSelection.mockImplementation(
        async () =>
          ({
            productItemId: "product_1",
            isBookable: true,
            appointmentKinds: ["OUTPATIENT", "INPATIENT"],
            templateKinds: ["SOAP_NOTE"],
            templateBindings: [
              { templateKind: "SOAP_NOTE", templateId: "tmpl_bound" },
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
        latestVersion: 3,
        publishedVersion: 2,
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
                templateVersion: 2,
                source: "CATALOG_BINDING",
              },
            ],
          },
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.createRequestedFromMobile(
        { resourceType: "Appointment" } as any,
        "parent_1",
      );

      expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentType: expect.objectContaining({
              templateDefaults: [
                expect.objectContaining({
                  templateId: "tmpl_bound",
                  templateVersion: 2,
                  source: "CATALOG_BINDING",
                }),
              ],
            }),
          }),
        }),
      );
      expect((result as any).templateDefaults?.[0]?.templateVersion).toBe(2);
    });

    it("defaults the payment collection method to PAYMENT_LINK when unspecified", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
      } as any);
      mockedPrisma.appointment.create.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1" }),
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: "case_1" }),
      );
      mockedInvoiceService.bootstrapForAppointment.mockResolvedValue({
        id: "inv_1",
        organisationId: "org_1",
      } as never);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.createAppointmentFromPms({
        resourceType: "Appointment",
      } as any);

      expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
        "appt_1",
        "PAYMENT_LINK",
      );
    });

    it("classifies invoices with missing payment collections and null appointment ids", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([
        makeRow({ id: "appt_1" }),
      ]);
      mockedPrisma.invoice.findMany.mockResolvedValue([
        { appointmentId: null, status: "PAID" },
        { appointmentId: "appt_1", status: "PENDING" },
      ] as any);

      const result =
        await AppointmentPrismaService.getAppointmentsForCompanion("comp_1");

      expect((result[0] as any).paymentStatus).toBe("UNPAID");
      expect((result[0] as any).bookingPaymentStatus).toBe("UNPAID");
    });

    it("returns an empty list without querying invoices when a parent has none", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      const result =
        await AppointmentPrismaService.getAppointmentsForParent("parent_1");

      expect(result).toEqual([]);
      expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it("getById own-scope: 404 when the lead is null and support staff lack ids", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          organisationId: "org_1",
          lead: null,
          supportStaff: [{ name: "no-id" }],
        }),
      );

      await expect(
        AppointmentPrismaService.getById("appt_1", {
          organisationId: "org_1",
          actorId: "vet_x",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("getById own-scope: 404 when support staff is not an array", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1", lead: null, supportStaff: null }),
      );

      await expect(
        AppointmentPrismaService.getById("appt_1", {
          organisationId: "org_1",
          actorId: "vet_x",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("getById parent-scope: 404 when the row patient has no parent", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ organisationId: "org_1", patient: { id: "comp_1" } }),
      );

      await expect(
        AppointmentPrismaService.getById("appt_1", {
          organisationId: "org_1",
          parentId: "parent_1",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("filters organisation appointments by start date only", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.getAppointmentsForOrganisation("org_1", {
        startDate: new Date("2026-06-01T00:00:00.000Z"),
      });

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: expect.any(Date), lte: undefined },
          }),
        }),
      );
    });

    it("filters organisation appointments by end date only", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([makeRow()]);
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.getAppointmentsForOrganisation("org_1", {
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      });

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: undefined, lte: expect.any(Date) },
          }),
        }),
      );
    });

    it("attaches no forms when the requested list is null and the row has none", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ formIds: null }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ formIds: [] }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.attachFormsToAppointment(
        "appt_1",
        "org_1",
        null as any,
      );

      expect(mockedPrisma.form.findMany).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ formIds: [] }),
        }),
      );
    });

    it("check-in creates an outpatient case and encounter with no parent, concern, or type", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: null,
          patient: {},
          concern: null,
          appointmentType: null,
        }),
      );
      mockedPrisma.case.create.mockResolvedValue({ id: "case_new" } as any);
      mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_new" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_new",
          encounterId: "enc_new",
          patient: {},
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.checkInAppointment("appt_1", "org_1");

      expect(mockedPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Outpatient case",
            parentId: null,
            description: null,
            patientId: "",
          }),
        }),
      );
      expect(mockedPrisma.encounter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: null,
            reason: null,
            title: null,
            encounterClass: "AMB",
          }),
        }),
      );
    });

    it("check-in resolves an inpatient case with no parent or concern", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          appointmentKind: "INPATIENT",
          caseId: null,
          encounterId: null,
          patient: { id: "comp_1" },
          concern: null,
        }),
      );
      mockedPrisma.case.create.mockResolvedValue({ id: "case_inp" } as any);
      mockedPrisma.encounter.create.mockResolvedValue({ id: "enc_inp" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_inp",
          encounterId: "enc_inp",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.checkInAppointment("appt_1", "org_1");

      expect(mockedPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Inpatient case",
            parentId: null,
            description: null,
          }),
        }),
      );
      expect(mockedPrisma.encounter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ encounterClass: "IMP" }),
        }),
      );
    });

    it("approves a requested appointment with no parent and no resolvable case", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        patient: { id: "comp_1" },
        lead: { id: "lead_9", name: "Dr Nine" },
        appointmentKind: "OUTPATIENT",
        startTime: new Date("2026-06-10T10:00:00.000Z"),
        endTime: new Date("2026-06-10T10:30:00.000Z"),
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({ status: "REQUESTED" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: null }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.approveRequestedFromPms(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseId: null }),
        }),
      );
      expect(mockedPrisma.occupancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "lead_9" }),
        }),
      );
      expect(result.status).toBe("UPCOMING");
    });

    it("updates a PMS appointment using row fallbacks for every optional field", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        patient: { id: "comp_1" },
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: null,
        }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CHECKED_IN" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.updateAppointmentPMS(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(
        mockedInvoiceService.markAppointmentReadyForBilling,
      ).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseId: null, encounterId: null }),
        }),
      );
      expect(mockedPrisma.occupancy.create).not.toHaveBeenCalled();
      expect(result.status).toBe("CHECKED_IN");
    });

    it("books lead occupancy from the row lead when the update omits a lead", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        patient: { id: "comp_1" },
        status: "UPCOMING",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "UPCOMING",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: null,
          lead: { id: "lead_row", name: "Row Lead" },
        }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "UPCOMING" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.occupancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "lead_row" }),
        }),
      );
    });

    it("normalizes blank case and encounter ids to null on update", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        patient: { id: "comp_1" },
        caseId: "   ",
        encounterId: "   ",
        status: "CHECKED_IN",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "OUTPATIENT",
          caseId: "case_old",
          encounterId: "enc_old",
        }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CHECKED_IN" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseId: null, encounterId: null }),
        }),
      );
    });

    it("admits using row json fields as-is when the input omits them", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
          lead: null,
          supportStaff: null,
          room: null,
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
      mockedPrisma.admission.findUnique.mockResolvedValue({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T11:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:30:00.000Z"),
        updatedAt: new Date("2026-06-11T11:30:00.000Z"),
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({} as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        {},
      );

      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentKind: "INPATIENT",
            caseId: "case_1",
          }),
        }),
      );
      expect((result as any).appointment.encounterId).toBe("enc_1");
    });

    it("admits an in-progress appointment with explicit null fields into a species-mixed unit", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
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
        status: "in-progress",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
        periodStart: new Date("2026-06-11T09:00:00.000Z"),
        periodEnd: null,
      } as any);
      mockedPrisma.admission.findUnique.mockResolvedValue({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T11:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:30:00.000Z"),
        updatedAt: new Date("2026-06-11T11:30:00.000Z"),
      } as any);
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        id: "unit_1",
        organisationId: "org_1",
        roomId: "room_1",
        unitGroupId: null,
        code: "U1",
        displayName: "Unit 1",
        size: "M",
        speciesConstraints: [123, "rabbit"],
        isActive: true,
        createdAt: new Date("2026-06-11T10:00:00.000Z"),
        updatedAt: new Date("2026-06-11T10:00:00.000Z"),
      } as any);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "rabbit",
        speciesCode: null,
      });
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null);
      mockedPrisma.encounter.update.mockResolvedValue({} as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        {
          lead: null as any,
          supportStaff: null as any,
          room: null as any,
          roomUnitId: "unit_1",
        },
      );

      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalled();
      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "in-progress" }),
        }),
      );
      expect((result as any).appointment.appointmentKind).toBe("INPATIENT");
    });
  });
  // -------------------------------------------------------------------------
  // Remaining conditional arms: the fallback halves of the encounter / case
  // resolution used by check-in, the IN_PROGRESS transition and admission.
  // -------------------------------------------------------------------------
  describe("encounter and case fallbacks", () => {
    it("reuses a linked encounter on check-in and reports a null case when the row has none", async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(
        makeRow({ status: "UPCOMING", caseId: null, encounterId: "enc_1" }),
      );
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({ status: "CHECKED_IN", caseId: null, encounterId: "enc_1" }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.checkInAppointment(
        "appt_1",
        "org_1",
      );

      // The already-linked encounter is reused: nothing new is created.
      expect(mockedPrisma.encounter.create).not.toHaveBeenCalled();
      expect(mockedPrisma.case.create).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "appt_1" },
          data: expect.objectContaining({
            status: "CHECKED_IN",
            encounterId: "enc_1",
          }),
        }),
      );
      expect((result as any).encounterId).toBe("enc_1");
    });

    it("creates an outpatient case and encounter on an IN_PROGRESS transition and tolerates an unreadable encounter", async () => {
      // No caseId, no encounterId and an OUTPATIENT kind: the case must be
      // created from the patched row, and a stamp against an encounter that can
      // no longer be read must be a no-op rather than a crash.
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
        appointmentKind: "OUTPATIENT",
        caseId: undefined,
        encounterId: undefined,
        concern: undefined,
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          appointmentKind: "OUTPATIENT",
          caseId: null,
          encounterId: null,
          concern: "Row concern",
        }),
      );
      mockedPrisma.case.create.mockResolvedValue({ id: "case_new" } as any);
      mockedPrisma.encounter.create.mockResolvedValue({
        id: "enc_new",
      } as any);
      mockedPrisma.encounter.findUnique.mockResolvedValue(null);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          appointmentKind: "OUTPATIENT",
          caseId: "case_new",
          encounterId: "enc_new",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await AppointmentPrismaService.updateAppointmentPMS(
        "appt_1",
        { resourceType: "Appointment" } as any,
      );

      expect(mockedPrisma.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appointmentKind: "OUTPATIENT",
          title: "Outpatient case",
          // The concern comes from the row because the payload omitted one.
          description: "Row concern",
        }),
        select: { id: true },
      });
      expect(mockedPrisma.encounter.create).toHaveBeenCalled();
      // The encounter vanished before the stamp, so no update is attempted.
      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: "case_new",
            encounterId: "enc_new",
          }),
        }),
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("stamps the transition time on an already-started encounter that never recorded one", async () => {
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        ...baseDomain,
        status: "IN_PROGRESS",
      } as any);
      mockedPrisma.appointment.findUnique.mockResolvedValue(
        makeRow({
          status: "CHECKED_IN",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
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
        status: "onleave",
        periodStart: null,
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_1" } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      const before = Date.now();
      await AppointmentPrismaService.updateAppointmentPMS("appt_1", {
        resourceType: "Appointment",
      } as any);

      const stampCall = mockedPrisma.encounter.update.mock.calls.find(
        ([arg]: any[]) => arg?.where?.id === "enc_1",
      );
      const data = stampCall?.[0]?.data as {
        status: string;
        periodStart: Date;
      };
      // The in-flight status is preserved, but the missing start is backfilled.
      expect(data.status).toBe("onleave");
      expect(data.periodStart).toBeInstanceOf(Date);
      expect(data.periodStart.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("preserves the admission time as the start of an encounter that is under way without one", async () => {
      const admittedAt = new Date("2026-06-11T12:00:00.000Z");
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
        status: "in-progress",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
        periodStart: null,
        periodEnd: null,
      } as any);
      mockedPrisma.encounter.update.mockResolvedValue({ id: "enc_1" } as any);
      mockedPrisma.admission.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          encounterId: "enc_1",
          organisationId: "org_1",
          patientId: "comp_1",
          unitId: null,
          expectedStayDays: null,
          admittedAt,
          dischargedAt: null,
          createdAt: admittedAt,
          updatedAt: admittedAt,
        } as any);
      mockedPrisma.admission.upsert.mockResolvedValue({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt,
        dischargedAt: null,
        createdAt: admittedAt,
        updatedAt: admittedAt,
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue(
        makeRow({
          status: "IN_PROGRESS",
          appointmentKind: "INPATIENT",
          caseId: "case_1",
          encounterId: "enc_1",
        }),
      );
      mockedPrisma.invoice.findMany.mockResolvedValue([]);

      await AppointmentPrismaService.admitAppointmentToInpatient(
        "appt_1",
        "org_1",
        { admittedAt } as any,
      );

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enc_1" },
          data: expect.objectContaining({
            // Already under way, so the status is kept and the admission time
            // backfills the missing start.
            status: "in-progress",
            periodStart: admittedAt,
          }),
        }),
      );
    });
  });
});
