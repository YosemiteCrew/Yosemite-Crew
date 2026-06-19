import { Request, Response } from "express";
import { SearchController } from "../../src/controllers/web/search.controller";
import { prisma } from "../../src/config/prisma";
import { CatalogService } from "../../src/services/catalog.service";
import {
  InventoryService,
  InventoryServiceError,
} from "../../src/services/inventory.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    template: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
    patientOrganisation: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
  },
}));

jest.mock("../../src/services/catalog.service", () => ({
  CatalogService: {
    searchItems: jest.fn(),
  },
  CatalogServiceError: class CatalogServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "CatalogServiceError";
    }
  },
}));

jest.mock("../../src/services/inventory.service", () => ({
  InventoryService: {
    listItems: jest.fn(),
  },
  InventoryServiceError: class InventoryServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "InventoryServiceError";
    }
  },
}));

const mockedInventoryService = InventoryService as jest.Mocked<
  typeof InventoryService
>;
const mockedCatalogService = CatalogService as jest.Mocked<
  typeof CatalogService
>;
const mockedPrisma = prisma as unknown as {
  template: { findMany: jest.Mock };
  task: { findMany: jest.Mock };
  patientOrganisation: { findMany: jest.Mock };
  document: { findMany: jest.Mock };
};

describe("SearchController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const buildResponse = () => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.template.findMany.mockResolvedValue([]);
    mockedPrisma.task.findMany.mockResolvedValue([]);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValue([]);
    mockedPrisma.document.findMany.mockResolvedValue([]);
    req = {
      params: { organisationId: "org-1" },
      query: {},
      body: {},
    };
    buildResponse();
  });

  it("searches medications and filters non-medical inventory", async () => {
    mockedInventoryService.listItems.mockResolvedValueOnce([
      {
        id: "item-1",
        organisationId: "org-1",
        name: "Amoxicillin",
        sku: "AMX-1",
        itemType: "MEDICAL",
        prescriptionRequired: true,
        controlledItem: false,
        expiryTrackingRequired: true,
        onHand: 10,
        allocated: 2,
        batches: [
          {
            id: "batch-1",
            batchNumber: "B-1",
            lotNumber: "LOT-1",
            expiryDate: new Date("2026-12-31T00:00:00.000Z"),
            quantity: 8,
            allocated: 0,
          },
        ],
      },
      {
        id: "item-2",
        organisationId: "org-1",
        name: "Bandage",
        sku: "BAND-1",
        itemType: "NON_MEDICAL",
        prescriptionRequired: false,
      },
    ] as never);

    await SearchController.searchMedications(
      {
        ...req,
        query: { search: "amox", page: "1", pageSize: "10" },
      } as Request,
      res as Response,
    );

    expect(mockedInventoryService.listItems).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        search: "amox",
        status: "ACTIVE",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [
          expect.objectContaining({
            itemId: "item-1",
            batches: [expect.objectContaining({ id: "batch-1" })],
          }),
        ],
      }),
    );
  });

  it("searches inventory items without medical filtering", async () => {
    mockedInventoryService.listItems.mockResolvedValueOnce([
      {
        id: "item-3",
        organisationId: "org-1",
        name: "Scalpel",
        sku: "SCL-1",
        itemType: "NON_MEDICAL",
        prescriptionRequired: false,
      },
    ] as never);

    await SearchController.searchInventoryItems(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ itemId: "item-3" })],
      }),
    );
  });

  it("returns inventory errors as api errors", async () => {
    mockedInventoryService.listItems.mockRejectedValueOnce(
      new InventoryServiceError("Inventory unavailable", 503),
    );

    await SearchController.searchInventoryItems(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Inventory unavailable",
    });
  });

  it("searches templates, tasks, documents, services, and packages", async () => {
    mockedPrisma.template.findMany.mockResolvedValueOnce([
      {
        id: "tpl-1",
        name: "SOAP Template",
        description: "Desc",
        kind: "SOAP_NOTE",
        ownership: "ORG_TEMPLATE",
        status: "PUBLISHED",
        scope: "ORGANISATION",
        latestVersion: 3,
        updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.task.findMany.mockResolvedValueOnce([
      {
        id: "task-1",
        name: "Review labs",
        description: "Need review",
        additionalNotes: null,
        category: "LABS",
        subcategory: "REVIEW",
        status: "PENDING",
        audience: "EMPLOYEE_TASK",
        source: "CUSTOM",
        updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValueOnce([
      { patientId: "patient-1" },
    ]);
    mockedPrisma.document.findMany.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "Vaccination",
        category: "HEALTH",
        subcategory: "VACCINATION_AND_PARASITE_PREVENTION",
        visitType: "VISIT",
        appointmentId: "appt-1",
        patientId: "patient-1",
        pmsVisible: true,
        updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);
    mockedCatalogService.searchItems.mockResolvedValueOnce({
      items: [
        {
          id: "svc-1",
          name: "Consult",
          description: "Service",
          kind: "CONSULTATION",
          source: "CATALOG",
          status: "ACTIVE",
          totalAmount: 100,
          currency: "USD",
        },
      ],
    } as never);
    mockedCatalogService.searchItems.mockResolvedValueOnce({
      items: [
        {
          id: "pkg-1",
          name: "Bundle",
          description: "Package",
          kind: "PACKAGE",
          source: "CATALOG",
          status: "ACTIVE",
          totalAmount: 250,
          currency: "USD",
        },
      ],
    } as never);

    await SearchController.searchTemplates(
      { ...req, query: { q: "soap", page: "1", pageSize: "10" } } as Request,
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ scope: "TEMPLATE", id: "tpl-1" })],
      }),
    );

    await SearchController.searchTasks(
      { ...req, query: { q: "labs" } } as Request,
      res as Response,
    );
    expect(jsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ scope: "TASK", id: "task-1" })],
      }),
    );

    await SearchController.searchDocuments(
      { ...req, query: { q: "vacc" } } as Request,
      res as Response,
    );
    expect(jsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ scope: "DOCUMENT", id: "doc-1" })],
      }),
    );

    await SearchController.searchServices(req as Request, res as Response);
    expect(jsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ scope: "SERVICE", id: "svc-1" })],
      }),
    );

    await SearchController.searchPackages(req as Request, res as Response);
    expect(jsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ scope: "PACKAGE", id: "pkg-1" })],
      }),
    );
  });
});
