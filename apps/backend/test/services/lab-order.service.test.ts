import { LabOrderService } from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
import { getLabOrderAdapter } from "src/labs";
import { InvoiceService } from "src/services/invoice.service";

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
});
