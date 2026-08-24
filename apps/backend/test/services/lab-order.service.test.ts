import { Prisma } from "@prisma/client";
import {
  LabOrderService,
  LabOrderServiceError,
} from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
import { getLabOrderAdapter } from "src/labs";
import { InvoiceService } from "src/services/invoice.service";
import logger from "src/utils/logger";

jest.mock("src/utils/logger");

jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    parentPatient: {
      findFirst: jest.fn(),
    },
    labOrder: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("src/labs", () => {
  const actual = jest.requireActual("src/labs");
  return {
    ...actual,
    getLabOrderAdapter: jest.fn(),
  };
});

jest.mock("src/services/invoice.service", () => ({
  InvoiceService: {
    addChargesToAppointment: jest.fn(),
    handleInvoiceCancellation: jest.fn(),
  },
}));

const prismaMock = prisma as unknown as {
  codeEntry: { count: jest.Mock; findMany: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  labOrder: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

const adapterMock = {
  createOrder: jest.fn(),
  getOrder: jest.fn(),
  updateOrder: jest.fn(),
  cancelOrder: jest.fn(),
};

const invoiceServiceMock = InvoiceService as unknown as {
  addChargesToAppointment: jest.Mock;
  handleInvoiceCancellation: jest.Mock;
};

const loggerMock = logger as unknown as {
  error: jest.Mock;
  warn: jest.Mock;
};

const storedOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  organisationId: "org-1",
  provider: "IDEXX",
  idexxOrderId: "ID-1",
  patientId: "patient-1",
  parentId: "parent-1",
  status: "CREATED",
  modality: "REFERENCE_LAB",
  tests: ["T1"],
  ivls: null,
  ...overrides,
});

describe("LabOrderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLabOrderAdapter as jest.Mock).mockReturnValue(adapterMock);
    adapterMock.createOrder.mockResolvedValue({
      idexxOrderId: "ID-1",
      requestPayload: {},
      responsePayload: {},
      status: "CREATED",
    });
    adapterMock.getOrder.mockResolvedValue({
      requestPayload: {},
      responsePayload: {},
      status: "CREATED",
    });
    adapterMock.updateOrder.mockResolvedValue({
      requestPayload: {},
      responsePayload: {},
      status: "CREATED",
    });
    adapterMock.cancelOrder.mockResolvedValue({
      requestPayload: {},
      responsePayload: {},
      status: "CANCELLED",
    });
    prismaMock.labOrder.create.mockResolvedValue({
      id: "order-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
      tests: ["T1"],
      billedAt: null,
      appointmentId: null,
      invoiceId: null,
    });
    prismaMock.labOrder.update.mockResolvedValue({
      id: "order-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
      tests: ["T1"],
    });
    prismaMock.labOrder.findFirst.mockResolvedValue({
      id: "order-1",
      organisationId: "org-1",
      provider: "IDEXX",
      idexxOrderId: "ID-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
      tests: ["T1"],
    });
  });

  it("lists provider tests using prisma", async () => {
    prismaMock.codeEntry.count.mockResolvedValue(1);
    prismaMock.codeEntry.findMany.mockResolvedValue([{ code: "T1" }]);

    const result = await LabOrderService.listProviderTests("IDEXX", {
      query: "chem",
      limit: 10,
      page: 1,
    });

    expect(result).toEqual({
      total: 1,
      page: 1,
      limit: 10,
      tests: [{ code: "T1" }],
    });
  });

  it("creates an order with a resolved primary parent", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({
      parentId: "parent-1",
    });

    const result = await LabOrderService.createOrder("IDEXX", {
      organisationId: "org-1",
      patientId: "patient-1",
      tests: ["T1"],
    });

    expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      },
    });
    expect(adapterMock.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: "parent-1",
      }),
    );
    expect(result).toMatchObject({
      id: "order-1",
      status: "CREATED",
    });
  });

  it("gets an order through prisma", async () => {
    await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

    expect(prismaMock.labOrder.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        provider: "IDEXX",
        idexxOrderId: "ID-1",
      },
    });
  });

  it("rejects unsupported provider for listOrders", async () => {
    await expect(
      LabOrderService.listOrders({
        organisationId: "org-1",
        provider: "BAD",
      }),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("rejects unsupported provider for createOrder", async () => {
    await expect(
      LabOrderService.createOrder("BAD", {
        organisationId: "org-1",
        patientId: "patient-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("cancels an order and forwards invoice cancellation when needed", async () => {
    prismaMock.labOrder.findFirst.mockResolvedValueOnce({
      id: "order-1",
      organisationId: "org-1",
      provider: "IDEXX",
      idexxOrderId: "ID-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
      tests: ["T1"],
      invoiceId: "invoice-1",
      ivls: null,
    });
    prismaMock.labOrder.update.mockResolvedValueOnce({
      id: "order-1",
      invoiceId: "invoice-1",
      status: "CANCELLED",
    });

    await LabOrderService.cancelOrder("IDEXX", "org-1", "ID-1");

    expect(invoiceServiceMock.handleInvoiceCancellation).toHaveBeenCalledWith(
      "invoice-1",
      "Lab order cancelled",
    );
  });

  const expectServiceError = async (
    promise: Promise<unknown>,
    message: string,
    statusCode: number,
  ) => {
    const error = await promise.then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(LabOrderServiceError);
    expect((error as LabOrderServiceError).message).toBe(message);
    expect((error as LabOrderServiceError).statusCode).toBe(statusCode);
  };

  describe("input validation", () => {
    it("rejects a blank organisationId before touching the database", async () => {
      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "   ",
          patientId: "patient-1",
          tests: ["T1"],
        }),
        "organisationId is required.",
        400,
      );

      expect(prismaMock.labOrder.create).not.toHaveBeenCalled();
    });

    it("rejects a missing patientId", async () => {
      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: undefined as unknown as string,
          tests: ["T1"],
        }),
        "patientId is required.",
        400,
      );
    });

    it("rejects an empty tests array", async () => {
      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: "patient-1",
          tests: [],
        }),
        "tests are required.",
        400,
      );

      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: "patient-1",
          tests: null as unknown as string[],
        }),
        "tests are required.",
        400,
      );
    });

    it("rejects a non-string organisationId on getOrder", async () => {
      await expectServiceError(
        LabOrderService.getOrder("IDEXX", 42 as unknown as string, "ID-1"),
        "organisationId is required.",
        400,
      );

      await expectServiceError(
        LabOrderService.getOrder("IDEXX", "org-1", "  "),
        "idexxOrderId is required.",
        400,
      );

      expect(prismaMock.labOrder.findFirst).not.toHaveBeenCalled();
    });

    it("rejects malformed optional filters on listOrders", async () => {
      await expectServiceError(
        LabOrderService.listOrders({
          organisationId: "org-1",
          appointmentId: 7 as unknown as string,
        }),
        "Invalid appointmentId.",
        400,
      );

      await expectServiceError(
        LabOrderService.listOrders({
          organisationId: "org-1",
          patientId: "   ",
        }),
        "Invalid patientId.",
        400,
      );

      await expectServiceError(
        LabOrderService.listOrders({
          organisationId: "org-1",
          status: "NOT_A_STATUS" as never,
        }),
        "Invalid status.",
        400,
      );

      expect(prismaMock.labOrder.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listProviderTests", () => {
    it("rejects an unsupported provider", async () => {
      await expectServiceError(
        LabOrderService.listProviderTests("LABCORP", {}),
        "Unsupported lab provider.",
        400,
      );

      expect(prismaMock.codeEntry.count).not.toHaveBeenCalled();
    });

    it("falls back to page 1 and a 50-item page when paging is absent", async () => {
      prismaMock.codeEntry.count.mockResolvedValue(0);
      prismaMock.codeEntry.findMany.mockResolvedValue([]);

      const result = await LabOrderService.listProviderTests("idexx", {
        query: "   ",
        limit: 0,
        page: -3,
      });

      expect(result).toEqual({ total: 0, page: 1, limit: 50, tests: [] });
      expect(prismaMock.codeEntry.count).toHaveBeenCalledWith({
        where: { system: "IDEXX", type: "TEST", active: true },
      });
      expect(prismaMock.codeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it("caps the page size at 200 and filters by explicit codes", async () => {
      prismaMock.codeEntry.count.mockResolvedValue(3);
      prismaMock.codeEntry.findMany.mockResolvedValue([{ code: "T1" }]);

      const result = await LabOrderService.listProviderTests("IDEXX", {
        query: "chem",
        limit: 900,
        page: 3,
        codes: ["T1", "T2"],
      });

      expect(result.limit).toBe(200);
      expect(result.page).toBe(3);
      expect(prismaMock.codeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 400, take: 200 }),
      );
      expect(prismaMock.codeEntry.count).toHaveBeenCalledWith({
        where: {
          system: "IDEXX",
          type: "TEST",
          active: true,
          code: { in: ["T1", "T2"] },
          OR: [
            { code: { contains: "chem", mode: "insensitive" } },
            { display: { contains: "chem", mode: "insensitive" } },
          ],
        },
      });
    });
  });

  describe("createOrder", () => {
    it("persists the breed substitution the adapter reports", async () => {
      const substitution = {
        requestedBreedCode: "YBREED:CANINE:SPINONE_ITALIANO",
        usedBreedCode: "YBREED:CANINE:CANINE_OTHER",
        usedTargetCode: "CANINE_OTHER",
        reason: "UNMAPPED_BREED",
      };
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "CREATED",
        breedSubstitution: substitution,
      });

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1"],
      });

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({ breedSubstitution: substitution }),
      });
    });

    it("rejects when the companion has no primary parent link", async () => {
      prismaMock.parentPatient.findFirst.mockResolvedValue(null);

      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: "patient-1",
          tests: ["T1"],
        }),
        "Primary parent not found for companion.",
        400,
      );

      expect(prismaMock.labOrder.create).not.toHaveBeenCalled();
    });

    it("marks the order ERROR and raises a 502 when the adapter fails", async () => {
      adapterMock.createOrder.mockRejectedValue(new Error("idexx down"));

      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: "patient-1",
          parentId: "parent-1",
          tests: ["T1"],
        }),
        "Lab order creation failed.",
        502,
      );

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: "ERROR", error: "idexx down" },
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Lab order creation failed",
        expect.any(Error),
      );
    });

    it("uses a generic error message when the adapter rejects a non-Error", async () => {
      adapterMock.createOrder.mockRejectedValue("exploded");

      await expectServiceError(
        LabOrderService.createOrder("IDEXX", {
          organisationId: "org-1",
          patientId: "patient-1",
          parentId: "parent-1",
          tests: ["T1"],
        }),
        "Lab order creation failed.",
        502,
      );

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: "ERROR", error: "Order creation failed." },
      });
    });

    it("bills the appointment when the adapter returns SUBMITTED", async () => {
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValueOnce({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: "appt-1",
        tests: ["T1", "T2"],
      });
      prismaMock.codeEntry.findMany.mockResolvedValue([
        { code: "T1", display: "CBC", meta: { listPrice: 25 } },
        { code: "T2", display: null, meta: { listPrice: "12.5" } },
      ]);
      invoiceServiceMock.addChargesToAppointment.mockResolvedValue({
        id: "invoice-9",
      });

      const result = await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1", "T2"],
      });

      expect(result).toMatchObject({ status: "SUBMITTED" });
      expect(invoiceServiceMock.addChargesToAppointment).toHaveBeenCalledWith(
        "appt-1",
        [
          {
            id: "laborder:test:T1",
            name: "CBC",
            description: "IDEXX test T1",
            quantity: 1,
            unitPrice: 25,
            total: 25,
          },
          {
            id: "laborder:test:T2",
            name: "IDEXX Test T2",
            description: "IDEXX test T2",
            quantity: 1,
            unitPrice: 12.5,
            total: 12.5,
          },
        ],
      );
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: {
          invoiceId: "invoice-9",
          billedAt: expect.any(Date),
          billingError: null,
        },
      });
    });

    it("records a billing error when a test has no list price", async () => {
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValueOnce({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: "appt-1",
        tests: ["T9"],
      });
      prismaMock.codeEntry.findMany.mockResolvedValue([
        { code: "T9", display: "Panel", meta: { listPrice: "not-a-number" } },
      ]);

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T9"],
      });

      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: { billingError: "Missing list price for IDEXX test T9." },
      });
    });

    it("records a billing error when the code entry carries no metadata", async () => {
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValueOnce({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: "appt-1",
        tests: ["T8"],
      });
      prismaMock.codeEntry.findMany.mockResolvedValue([{ code: "T8" }]);

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T8"],
      });

      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: { billingError: "Missing list price for IDEXX test T8." },
      });
    });

    it("falls back to a generic billing message for non-Error failures", async () => {
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValueOnce({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: "appt-1",
        tests: null,
      });
      prismaMock.codeEntry.findMany.mockResolvedValue([]);
      invoiceServiceMock.addChargesToAppointment.mockRejectedValue("nope");

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1"],
      });

      expect(prismaMock.codeEntry.findMany).not.toHaveBeenCalled();
      expect(invoiceServiceMock.addChargesToAppointment).toHaveBeenCalledWith(
        "appt-1",
        [],
      );
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: { billingError: "Lab order billing failed." },
      });
    });

    it("persists nulls when the adapter returns a bare result", async () => {
      adapterMock.createOrder.mockResolvedValue({
        requestPayload: { req: 1 },
        responsePayload: { res: 2 },
      });

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1"],
        modality: undefined,
      });

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          idexxOrderId: null,
          uiUrl: null,
          pdfUrl: null,
          status: "CREATED",
          externalStatus: null,
          requestPayload: { req: 1 },
          responsePayload: { res: 2 },
          modality: "REFERENCE_LAB",
          ivls: undefined,
        },
      });
    });

    it("skips billing when the submitted order has no appointment", async () => {
      adapterMock.createOrder.mockResolvedValue({
        idexxOrderId: "ID-1",
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValueOnce({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: null,
        tests: ["T1"],
      });

      await LabOrderService.createOrder("IDEXX", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1"],
      });

      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
      expect(prismaMock.labOrder.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOrder", () => {
    it("rejects an unsupported provider and a missing order", async () => {
      await expectServiceError(
        LabOrderService.getOrder("LABCORP", "org-1", "ID-1"),
        "Unsupported lab provider.",
        400,
      );

      prismaMock.labOrder.findFirst.mockResolvedValue(null);

      await expectServiceError(
        LabOrderService.getOrder("IDEXX", "org-1", "ID-1"),
        "Lab order not found.",
        404,
      );
    });

    it("passes stored tests and ivls to the adapter and keeps existing values", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({
          tests: ["T1", "T2"],
          ivls: [{ serialNumber: "S1" }],
          externalStatus: "ext-old",
          uiUrl: "ui-old",
          pdfUrl: "pdf-old",
          modality: "IN_HOUSE",
        }),
      );
      adapterMock.getOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: { ok: true },
      });
      prismaMock.labOrder.update.mockResolvedValue({
        id: "order-1",
        status: "CREATED",
      });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(adapterMock.getOrder).toHaveBeenCalledWith("ID-1", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1", "T2"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S1" }],
      });
      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          status: "CREATED",
          externalStatus: "ext-old",
          uiUrl: "ui-old",
          pdfUrl: "pdf-old",
          responsePayload: { ok: true },
        },
      });
    });

    it("normalizes non-array tests and ivls to empty inputs", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({ tests: null, ivls: { bad: true }, modality: null }),
      );
      prismaMock.labOrder.update.mockResolvedValue({
        id: "order-1",
        status: "CREATED",
      });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(adapterMock.getOrder).toHaveBeenCalledWith("ID-1", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: [],
        modality: undefined,
        ivls: undefined,
      });
    });
  });

  describe("maybeBillSubmittedOrder", () => {
    const submitOrder = (overrides: Record<string, unknown> = {}) => {
      adapterMock.getOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
        status: "SUBMITTED",
      });
      prismaMock.labOrder.update.mockResolvedValue({
        id: "order-1",
        status: "SUBMITTED",
        billedAt: null,
        appointmentId: "appt-1",
        tests: ["T1"],
        ...overrides,
      });
    };

    it("does not bill an order that is already billed", async () => {
      submitOrder({ billedAt: new Date("2026-01-01") });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(prismaMock.codeEntry.findMany).not.toHaveBeenCalled();
      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
    });

    it("warns and skips billing when the order has no appointment", async () => {
      submitOrder({ appointmentId: null });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(loggerMock.warn).toHaveBeenCalledWith(
        "Lab order billing skipped: missing appointmentId.",
        { labOrderId: "order-1" },
      );
      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
    });

    it("stores the invoice id after a successful billing run", async () => {
      submitOrder();
      prismaMock.codeEntry.findMany.mockResolvedValue([
        { code: "T1", display: "CBC", meta: { listPrice: 40 } },
      ]);
      invoiceServiceMock.addChargesToAppointment.mockResolvedValue({
        id: "invoice-3",
      });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(invoiceServiceMock.addChargesToAppointment).toHaveBeenCalledWith(
        "appt-1",
        [
          {
            id: "laborder:test:T1",
            name: "CBC",
            description: "IDEXX test T1",
            quantity: 1,
            unitPrice: 40,
            total: 40,
          },
        ],
      );
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: {
          invoiceId: "invoice-3",
          billedAt: expect.any(Date),
          billingError: null,
        },
      });
    });

    it("stores a null invoice id when the invoice has none", async () => {
      submitOrder();
      prismaMock.codeEntry.findMany.mockResolvedValue([
        { code: "T1", display: "CBC", meta: { listPrice: 40 } },
      ]);
      invoiceServiceMock.addChargesToAppointment.mockResolvedValue({});

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: {
          invoiceId: null,
          billedAt: expect.any(Date),
          billingError: null,
        },
      });
    });

    it("records a billing error when the order has no billable tests", async () => {
      submitOrder({ tests: null });

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(invoiceServiceMock.addChargesToAppointment).not.toHaveBeenCalled();
      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: { billingError: "No billable lab tests found for this order." },
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Lab order billing failed",
        expect.any(LabOrderServiceError),
      );
    });

    it("falls back to a generic message when billing rejects a non-Error", async () => {
      submitOrder();
      prismaMock.codeEntry.findMany.mockResolvedValue([
        { code: "T1", display: "CBC", meta: { listPrice: 40 } },
      ]);
      invoiceServiceMock.addChargesToAppointment.mockRejectedValue("kaboom");

      await LabOrderService.getOrder("IDEXX", "org-1", "ID-1");

      expect(prismaMock.labOrder.update).toHaveBeenLastCalledWith({
        where: { id: "order-1" },
        data: { billingError: "Lab order billing failed." },
      });
    });
  });

  describe("updateOrder", () => {
    it("rejects unsupported providers, blank ids and missing orders", async () => {
      await expectServiceError(
        LabOrderService.updateOrder("LABCORP", "org-1", "ID-1", {}),
        "Unsupported lab provider.",
        400,
      );

      await expectServiceError(
        LabOrderService.updateOrder("IDEXX", "", "ID-1", {}),
        "organisationId is required.",
        400,
      );

      await expectServiceError(
        LabOrderService.updateOrder("IDEXX", "org-1", "", {}),
        "idexxOrderId is required.",
        400,
      );

      prismaMock.labOrder.findFirst.mockResolvedValue(null);

      await expectServiceError(
        LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {}),
        "Lab order not found.",
        404,
      );

      expect(adapterMock.updateOrder).not.toHaveBeenCalled();
    });

    it("refuses to update an order that has left the CREATED state", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({ status: "SUBMITTED" }),
      );

      await expectServiceError(
        LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {}),
        "Only CREATED orders can be updated.",
        400,
      );

      expect(adapterMock.updateOrder).not.toHaveBeenCalled();
    });

    it("refuses an explicitly empty tests array", async () => {
      await expectServiceError(
        LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", { tests: [] }),
        "tests are required.",
        400,
      );

      expect(adapterMock.updateOrder).not.toHaveBeenCalled();
    });

    it("persists the substitution the update reports, and clears one it does not", async () => {
      // An order can be updated after its companion's breed is corrected, or after it
      // becomes unmapped. The create path persisted the substitution; the update path
      // silently dropped it, so the stored order kept whatever create wrote - a
      // substitution that no longer happened, or none where one now did.
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
        breedSubstitution: {
          requestedBreedCode: "YBREED:CANINE:SPINONE_ITALIANO",
          usedBreedCode: "YBREED:CANINE:CANINE_OTHER",
          usedTargetCode: "CANINE_OTHER",
          reason: "UNMAPPED_BREED",
        },
      });
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {
        tests: ["T1"],
      });

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            breedSubstitution: expect.objectContaining({
              reason: "UNMAPPED_BREED",
            }),
          }),
        }),
      );

      // And the clearing direction: no substitution reported means none stored.
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
        breedSubstitution: null,
      });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {
        tests: ["T1"],
      });

      // toJsonInput maps null to Prisma's JsonNull sentinel - that is how a JSON
      // column is actually cleared, so that is what must reach the write.
      const lastData = prismaMock.labOrder.update.mock.calls.at(-1)[0].data;
      expect(lastData.breedSubstitution).toBe(Prisma.JsonNull);
    });

    it("forwards the supplied payload and persists the adapter response", async () => {
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: { req: 1 },
        responsePayload: { res: 2 },
        status: "SUBMITTED",
        externalStatus: "ext-new",
        uiUrl: "ui-new",
        pdfUrl: "pdf-new",
      });
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {
        tests: ["T1", "T2"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S1" }],
        veterinarian: "vet-1",
        technician: "tech-1",
        notes: "note",
        specimenCollectionDate: "2026-01-02",
      });

      expect(adapterMock.updateOrder).toHaveBeenCalledWith("ID-1", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T1", "T2"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S1" }],
        veterinarian: "vet-1",
        technician: "tech-1",
        notes: "note",
        specimenCollectionDate: "2026-01-02",
      });
      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          status: "SUBMITTED",
          externalStatus: "ext-new",
          uiUrl: "ui-new",
          pdfUrl: "pdf-new",
          requestPayload: { req: 1 },
          responsePayload: { res: 2 },
          breedSubstitution: Prisma.JsonNull,
          tests: ["T1", "T2"],
          modality: "IN_HOUSE",
          ivls: [{ serialNumber: "S1" }],
          veterinarian: "vet-1",
          technician: "tech-1",
          notes: "note",
          specimenCollectionDate: "2026-01-02",
        },
      });
    });

    it("persists a breed substitution reported by the update", async () => {
      // The update re-sends the whole patient block, so a breed that became
      // unmappable between create and update is substituted here too - and the
      // clinic reading the order has to be able to see that.
      const substitution = {
        requestedBreedCode: "YBREED:FELINE:BURMESE",
        usedBreedCode: "YBREED:FELINE:MIXED_BREED_FELINE",
        usedTargetCode: "MIXED_BREED_FELINE",
        reason: "UNMAPPED_BREED",
      };
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
        status: "CREATED",
        breedSubstitution: substitution,
      });
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {});

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({ breedSubstitution: substitution }),
      });
    });

    it("clears a stale breed substitution when the update needs none", async () => {
      // The recorded breed was corrected, so IDEXX now holds the real one. Leaving
      // the old note on the row would keep claiming a substitute was sent.
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({
          breedSubstitution: {
            requestedBreedCode: "YBREED:FELINE:BURMESE",
            usedBreedCode: "YBREED:FELINE:MIXED_BREED_FELINE",
            usedTargetCode: "MIXED_BREED_FELINE",
            reason: "UNMAPPED_BREED",
          },
        }),
      );
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
        status: "CREATED",
        breedSubstitution: null,
      });
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {});

      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          breedSubstitution: Prisma.JsonNull,
        }),
      });
    });

    it("falls back to the stored order for every omitted field", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({
          tests: ["T-existing"],
          ivls: [{ serialNumber: "S-existing" }],
          modality: "IN_HOUSE",
          veterinarian: "vet-existing",
          technician: "tech-existing",
          notes: "note-existing",
          specimenCollectionDate: "2025-12-31",
          externalStatus: "ext-existing",
          uiUrl: "ui-existing",
          pdfUrl: "pdf-existing",
        }),
      );
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {});

      expect(adapterMock.updateOrder).toHaveBeenCalledWith("ID-1", {
        organisationId: "org-1",
        patientId: "patient-1",
        parentId: "parent-1",
        tests: ["T-existing"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S-existing" }],
        veterinarian: "vet-existing",
        technician: "tech-existing",
        notes: "note-existing",
        specimenCollectionDate: "2025-12-31",
      });
      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "CREATED",
          externalStatus: "ext-existing",
          uiUrl: "ui-existing",
          pdfUrl: "pdf-existing",
          tests: ["T-existing"],
          modality: "IN_HOUSE",
          ivls: [{ serialNumber: "S-existing" }],
          veterinarian: "vet-existing",
        }),
      });
    });

    it("nulls out modality and ivls when neither input nor stored order has them", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({ modality: null, ivls: null }),
      );
      adapterMock.updateOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: {},
      });
      prismaMock.labOrder.update.mockResolvedValue({ id: "order-1" });

      await LabOrderService.updateOrder("IDEXX", "org-1", "ID-1", {});

      expect(adapterMock.updateOrder).toHaveBeenCalledWith(
        "ID-1",
        expect.objectContaining({ modality: undefined, ivls: undefined }),
      );
      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          modality: null,
          externalStatus: null,
          uiUrl: null,
          pdfUrl: null,
        }),
      });
    });
  });

  describe("cancelOrder", () => {
    it("rejects unsupported providers, blank ids and missing orders", async () => {
      await expectServiceError(
        LabOrderService.cancelOrder("LABCORP", "org-1", "ID-1"),
        "Unsupported lab provider.",
        400,
      );

      await expectServiceError(
        LabOrderService.cancelOrder("IDEXX", "  ", "ID-1"),
        "organisationId is required.",
        400,
      );

      await expectServiceError(
        LabOrderService.cancelOrder("IDEXX", "org-1", ""),
        "idexxOrderId is required.",
        400,
      );

      prismaMock.labOrder.findFirst.mockResolvedValue(null);

      await expectServiceError(
        LabOrderService.cancelOrder("IDEXX", "org-1", "ID-1"),
        "Lab order not found.",
        404,
      );
    });

    it("defaults to CANCELLED when the adapter returns no status", async () => {
      prismaMock.labOrder.findFirst.mockResolvedValue(
        storedOrder({ modality: null, ivls: undefined }),
      );
      adapterMock.cancelOrder.mockResolvedValue({
        requestPayload: {},
        responsePayload: { done: true },
      });
      prismaMock.labOrder.update.mockResolvedValue({
        id: "order-1",
        invoiceId: null,
      });

      await LabOrderService.cancelOrder("IDEXX", "org-1", "ID-1");

      expect(adapterMock.cancelOrder).toHaveBeenCalledWith(
        "ID-1",
        expect.objectContaining({ modality: undefined, ivls: undefined }),
      );
      expect(prismaMock.labOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          status: "CANCELLED",
          externalStatus: null,
          responsePayload: { done: true },
        },
      });
      expect(
        invoiceServiceMock.handleInvoiceCancellation,
      ).not.toHaveBeenCalled();
    });

    it("logs but does not rethrow when the invoice cancellation fails", async () => {
      prismaMock.labOrder.update.mockResolvedValue({
        id: "order-1",
        invoiceId: "invoice-1",
        status: "CANCELLED",
      });
      invoiceServiceMock.handleInvoiceCancellation.mockRejectedValue(
        new Error("refund failed"),
      );

      const result = await LabOrderService.cancelOrder(
        "IDEXX",
        "org-1",
        "ID-1",
      );

      expect(result).toMatchObject({ status: "CANCELLED" });
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Failed to cancel/refund invoice for lab order",
        expect.any(Error),
      );
    });
  });

  describe("listOrders", () => {
    it("builds a fully filtered query and floors the limit", async () => {
      prismaMock.labOrder.findMany.mockResolvedValue([{ id: "order-1" }]);

      const result = await LabOrderService.listOrders({
        organisationId: "org-1",
        appointmentId: "appt-1",
        patientId: "patient-1",
        provider: "idexx",
        status: "SUBMITTED",
        limit: 7.9,
      });

      expect(result).toEqual([{ id: "order-1" }]);
      expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          appointmentId: "appt-1",
          patientId: "patient-1",
          provider: "IDEXX",
          status: "SUBMITTED",
        },
        orderBy: { createdAt: "desc" },
        take: 7,
      });
    });

    it("omits absent filters and falls back to the default page on an unusable limit", async () => {
      prismaMock.labOrder.findMany.mockResolvedValue([]);

      await LabOrderService.listOrders({
        organisationId: "org-1",
        appointmentId: null as unknown as string,
        limit: Number.NaN,
      });

      // An unusable limit must not mean "no limit". Lab orders carry patient
      // names, test names, notes and result URLs, so an unfiltered search
      // returns a page rather than the organisation's entire history.
      expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("caps an oversized caller-supplied limit", async () => {
      prismaMock.labOrder.findMany.mockResolvedValue([]);

      await LabOrderService.listOrders({
        organisationId: "org-1",
        limit: 100_000,
      });

      expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it("honours a small caller-supplied limit", async () => {
      prismaMock.labOrder.findMany.mockResolvedValue([]);

      await LabOrderService.listOrders({ organisationId: "org-1", limit: 3 });

      expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });
  });
});
