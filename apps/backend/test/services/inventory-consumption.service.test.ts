import { prisma } from "src/config/prisma";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "../../src/services/inventory-consumption.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    inventoryConsumptionRule: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryConsumptionEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    encounter: {
      findFirst: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryStockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    productItem: {
      findFirst: jest.fn(),
    },
    prescriptionDispenseRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

type MockedPrisma = typeof prisma & {
  $transaction: jest.Mock;
  inventoryConsumptionRule: {
    upsert: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  inventoryConsumptionEvent: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  inventoryItem: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  appointment: {
    findFirst: jest.Mock;
  };
  encounter: {
    findFirst: jest.Mock;
  };
  patient: {
    findFirst: jest.Mock;
  };
  inventoryBatch: {
    findMany: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  inventoryStockMovement: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  productItem: {
    findFirst: jest.Mock;
  };
  prescriptionDispenseRequest: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe("InventoryConsumptionService", () => {
  const mockedPrisma = prisma as unknown as MockedPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
    mockedPrisma.inventoryConsumptionEvent.findUnique.mockResolvedValue(null);
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValue([]);
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValue(null);
    mockedPrisma.prescriptionDispenseRequest.findMany.mockResolvedValue([]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(null);
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);
    mockedPrisma.encounter.findFirst.mockResolvedValue(null);
    mockedPrisma.patient.findFirst.mockResolvedValue(null);
  });

  it("upserts normalized mapping rules", async () => {
    mockedPrisma.inventoryConsumptionRule.upsert.mockResolvedValue({
      id: "rule-1",
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceKey: "amoxicillin",
      inventoryItemId: "item-1",
      quantityMultiplier: 1.5,
      active: true,
    });

    await InventoryConsumptionService.upsertRule({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceKey: " Amoxicillin ",
      inventoryItemId: "item-1",
      quantityMultiplier: 1.5,
      notes: "Antibiotic",
    });

    expect(mockedPrisma.inventoryConsumptionRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId_sourceType_sourceKey_inventoryItemId: {
            organisationId: "org-1",
            sourceType: "PRESCRIPTION",
            sourceKey: "amoxicillin",
            inventoryItemId: "item-1",
          },
        },
        create: expect.objectContaining({
          sourceKey: "amoxicillin",
          quantityMultiplier: 1.5,
          notes: "Antibiotic",
          active: true,
        }),
      }),
    );
  });

  it("rejects invalid rule input", async () => {
    await expect(
      InventoryConsumptionService.upsertRule({
        organisationId: " ",
        sourceType: "PRESCRIPTION",
        sourceKey: "amoxicillin",
        inventoryItemId: "item-1",
      }),
    ).rejects.toThrow(InventoryConsumptionServiceError);
  });

  it("consumes inventory from a direct line and stock batches", async () => {
    mockedPrisma.inventoryItem.findFirst
      .mockResolvedValueOnce({ id: "item-1" })
      .mockResolvedValueOnce({
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 0,
      });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-1", quantity: 2, allocated: 0 },
        { id: "batch-2", quantity: 4, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-1", quantity: 0, allocated: 0 },
        { id: "batch-2", quantity: 3, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-1",
    });

    const events = await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-1",
      lines: [
        {
          sourceLineKey: "line-1",
          inventoryItemSku: "sku-1",
          quantity: 3,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 3 },
      }),
    );
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledTimes(2);
  });

  it("rejects direct consumption when quantity is invalid", async () => {
    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-1",
        lines: [
          {
            sourceLineKey: "line-1",
            inventoryItemId: "item-1",
            quantity: 0,
          },
        ],
      }),
    ).rejects.toThrow("quantity must be a positive integer");
  });

  it("consumes prescription lines through a mapping rule", async () => {
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "item-1",
      quantityMultiplier: 2,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 10,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 10, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 6, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-2",
    });

    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [
        {
          name: "Amoxicillin",
          quantity: 2,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(
      mockedPrisma.inventoryConsumptionRule.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceKey: "amoxicillin",
        }),
      }),
    );
  });

  it("creates a prescription dispense request and reuses an existing pending request", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "request-1",
        prescriptionId: "rx-1",
        organisationId: "org-1",
        status: "PENDING",
      });
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-1",
      prescriptionId: "rx-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [{ inventoryItemId: "item-1", quantity: 1 }],
      metadata: { source: "finalize" },
      requestedBy: "user-1",
      reviewedBy: null,
      reviewedAt: null,
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-1",
      prescriptionId: "rx-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [{ inventoryItemId: "item-1", quantity: 2 }],
      metadata: { source: "reopen" },
      requestedBy: "user-2",
      reviewedBy: null,
      reviewedAt: null,
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [{ inventoryItemId: "item-1", quantity: 1 }],
      metadata: { source: "finalize" },
      requestedBy: "user-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [{ inventoryItemId: "item-1", quantity: 2 }],
      metadata: { source: "reopen" },
      requestedBy: "user-2",
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org-1",
          prescriptionId: "rx-1",
          status: "PENDING",
          requestedBy: "user-1",
        }),
      }),
    );
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request-1" },
        data: expect.objectContaining({
          status: "PENDING",
          requestedBy: "user-2",
          reviewedBy: null,
        }),
      }),
    );
  });

  it("enriches dispense requests with pet and stock snapshots", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        type: "dog",
        dateOfBirth: new Date("2022-01-15T00:00:00.000Z"),
        gender: "male",
        isNeutered: true,
        currentWeight: 12.5,
        photoUrl: "https://cdn.example/patient.png",
      },
      appointmentKind: "INPATIENT",
    });
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        sku: "sku-1",
        name: "Amoxicillin",
        stockUnitType: "bottle",
        unitOfMeasure: "tablet",
        packageQuantity: 30,
        sellingPrice: 12.34,
        unitCost: 8.5,
        prescriptionRequired: true,
        controlledItem: false,
      },
    ]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-enriched-1",
      prescriptionId: "rx-enriched-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [],
      metadata: null,
      requestedBy: "user-1",
      reviewedBy: null,
      reviewedAt: null,
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-enriched-1",
      medications: [
        {
          inventoryItemId: "item-1",
          frequency: "BID",
          duration: "12 days",
          dosage: "1 Tablet",
          refill: "2",
          sourceLineKey: "line-1",
        },
      ],
      metadata: { source: "finalize" },
      requestedBy: "user-1",
      context: {
        appointmentId: "appt-1",
      },
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medications: [
            expect.objectContaining({
              inventoryItemId: "item-1",
              inventoryItemName: "Amoxicillin",
              quantity: 24,
              sourceLineKey: "line-1",
              frequency: "BID",
              frequencyPerDay: 2,
              durationDays: 12,
              doseQty: 1,
              doseUnit: "Tablet",
              refillsRemaining: 2,
              isRx: true,
              isControlled: false,
              stockUnitType: "bottle",
              stockUnitQuantity: 30,
              stockUnitQty: 30,
              unitQuantity: 30,
              priceCents: 1234,
            }),
          ],
          metadata: expect.objectContaining({
            source: "finalize",
            appointmentKind: "INPATIENT",
            dispenseStockSource: "ALLOCATED",
            petAge: expect.any(String),
            petSpecies: "Canine",
            petSex: "Male",
            petReproductiveStatus: "Neutered",
            patientImageUrl: "https://cdn.example/patient.png",
            petWeight: 12.5,
            petWeightUnit: "kg",
          }),
        }),
      }),
    );
  });

  it("parses compact dosage strings without whitespace", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-compact-1",
        sku: "liq-1",
        name: "Liquid Medicine",
        stockUnitType: "bottle",
        unitOfMeasure: "ml",
        packageQuantity: 30,
        sellingPrice: 12.34,
        unitCost: 8.5,
        prescriptionRequired: true,
        controlledItem: false,
      },
    ]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-compact-1",
      prescriptionId: "rx-compact-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [],
      metadata: null,
      requestedBy: "user-1",
      reviewedBy: null,
      reviewedAt: null,
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-compact-1",
      medications: [
        {
          inventoryItemId: "item-compact-1",
          frequency: "QD",
          duration: "1 day",
          dosage: "5ml",
          sourceLineKey: "line-compact-1",
        },
      ],
      requestedBy: "user-1",
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medications: [
            expect.objectContaining({
              doseQty: 5,
              doseUnit: "ml",
            }),
          ],
        }),
      }),
    );
  });

  it("approves an outpatient dispense request from normal stock", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-approve-1",
      prescriptionId: "rx-approve-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [
        {
          inventoryItemId: "item-approve-1",
          quantity: 24,
          stockUnitQuantity: 10,
          stockUnitQty: 10,
          sourceLineKey: "line-1",
        },
      ],
      metadata: {
        appointmentKind: "OUTPATIENT",
        dispenseStockSource: "NORMAL",
      },
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-approve-1",
      organisationId: "org-1",
      onHand: 10,
      allocated: 4,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-approve-1", quantity: 10, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-approve-1", quantity: 7, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-approve-1",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-approve-1",
      prescriptionId: "rx-approve-1",
      organisationId: "org-1",
      status: "DISPENSED",
      reviewedBy: "user-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-approve-1",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request-approve-1" },
        data: expect.objectContaining({
          status: "DISPENSED",
          reviewedBy: "user-1",
        }),
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 7 },
      }),
    );
  });

  it("approves an inpatient dispense request from allocated stock", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-approve-2",
      prescriptionId: "rx-approve-2",
      organisationId: "org-1",
      status: "PENDING",
      medications: [
        {
          inventoryItemId: "item-approve-2",
          quantity: 200,
          stockUnitQuantity: 100,
          stockUnitQty: 100,
          frequency: "BID",
          frequencyPerDay: 2,
          durationDays: 20,
          doseQty: 5,
          doseUnit: "ml",
          sourceLineKey: "line-1",
        },
      ],
      metadata: {
        appointmentKind: "INPATIENT",
        dispenseStockSource: "ALLOCATED",
      },
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-approve-2",
      organisationId: "org-1",
      onHand: 5,
      allocated: 5,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-approve-2", quantity: 5, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-approve-2", quantity: 3, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-approve-2",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-approve-2",
      prescriptionId: "rx-approve-2",
      organisationId: "org-1",
      status: "DISPENSED",
      reviewedBy: "user-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-approve-2",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 3, allocated: 3 },
      }),
    );
  });

  it("returns null when a dispense request is not found for not-dispensed", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );

    const result =
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: "org-1",
          prescriptionId: "rx-missing",
          reviewedBy: "user-1",
        },
      );

    expect(result).toBeNull();
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).not.toHaveBeenCalled();
  });

  it("marks a dispense request as not dispensed", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-not-dispensed-1",
      prescriptionId: "rx-not-dispensed-1",
      organisationId: "org-1",
      status: "PENDING",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-not-dispensed-1",
      prescriptionId: "rx-not-dispensed-1",
      organisationId: "org-1",
      status: "NOT_DISPENSED",
      reviewedBy: "user-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result =
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: "org-1",
          prescriptionId: "rx-not-dispensed-1",
          metadata: { reason: "patient unavailable" },
          reviewedBy: "user-1",
        },
      );

    expect(result).toMatchObject({
      status: "NOT_DISPENSED",
      reviewedBy: "user-1",
    });
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request-not-dispensed-1" },
        data: expect.objectContaining({
          status: "NOT_DISPENSED",
          reviewedBy: "user-1",
        }),
      }),
    );
  });

  it("lists dispense requests for an organisation", async () => {
    mockedPrisma.prescriptionDispenseRequest.findMany.mockResolvedValueOnce([
      {
        id: "request-list-1",
        prescriptionId: "rx-list-1",
        organisationId: "org-1",
        status: "PENDING",
        medications: [{ inventoryItemId: "item-1", quantity: 1 }],
        metadata: null,
        requestedBy: "user-1",
        reviewedBy: null,
        requestedAt: new Date("2026-01-01T00:00:00.000Z"),
        reviewedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        prescription: {
          id: "rx-list-1",
          artifactId: "artifact-1",
          artifact: {
            id: "artifact-1",
            organisationId: "org-1",
            appointmentId: null,
            caseId: null,
            encounterId: null,
            kind: "PRESCRIPTION",
            status: "DRAFT",
            templateId: null,
            templateVersion: null,
            templateVersionId: null,
            authorId: null,
            signedBy: null,
            signedAt: null,
            summary: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        },
      },
    ]);

    const result =
      await InventoryConsumptionService.listPrescriptionDispenseRequests({
        organisationId: "org-1",
      });

    expect(result).toHaveLength(1);
    expect(
      mockedPrisma.prescriptionDispenseRequest.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
        }),
        include: expect.objectContaining({
          prescription: expect.objectContaining({
            include: expect.objectContaining({
              artifact: true,
            }),
          }),
        }),
      }),
    );
  });

  it("gets a single dispense request by id", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-get-1",
      prescriptionId: "rx-get-1",
      organisationId: "org-1",
      status: "PENDING",
      medications: [],
      metadata: null,
      requestedBy: null,
      reviewedBy: null,
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      prescription: {
        id: "rx-get-1",
        artifactId: "artifact-1",
        artifact: {
          id: "artifact-1",
          organisationId: "org-1",
          appointmentId: null,
          caseId: null,
          encounterId: null,
          kind: "PRESCRIPTION",
          status: "DRAFT",
          templateId: null,
          templateVersion: null,
          templateVersionId: null,
          authorId: null,
          signedBy: null,
          signedAt: null,
          summary: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    });

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-get-1",
      });

    expect(result.id).toBe("request-get-1");
    expect(
      mockedPrisma.prescriptionDispenseRequest.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "request-get-1",
          organisationId: "org-1",
        },
      }),
    );
  });

  it("throws when a dispense request is missing", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );

    await expect(
      InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-missing",
      }),
    ).rejects.toThrow("Dispense request not found");
  });

  it("resolves prescription batch selectors before consuming", async () => {
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce({
      id: "batch-7",
      itemId: "item-7",
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-7",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-7", quantity: 5, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-7", quantity: 3, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-7",
    });

    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-7",
      medications: [
        {
          sourceLineKey: "line-batch",
          batchId: "batch-7",
          quantity: 2,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "batch-7",
          organisationId: "org-1",
        }),
      }),
    );
  });

  it("reserves prescription inventory without decrementing stock", async () => {
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce({
      id: "batch-8",
      itemId: "item-8",
    });
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-reserve-1",
    });

    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-8",
      medications: [
        {
          inventoryItemId: "item-8",
          batchId: "batch-8",
          quantity: 1,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "RESERVE",
          status: "APPLIED",
        }),
      }),
    );
  });

  it("voids a dispense with audit metadata preserved", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-void-1",
        itemId: "item-9",
        batchId: "batch-9",
        change: -1,
        reason: "PRESCRIPTION_DISPENSE",
        referenceId: "rx-9",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-9",
      organisationId: "org-1",
      onHand: 4,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-9", quantity: 4, allocated: 0 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-void-1",
    });

    const events = await InventoryConsumptionService.voidDispensePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-9",
      medications: [
        {
          inventoryItemId: "item-9",
          batchId: "batch-9",
          quantity: 1,
        },
      ],
      metadata: { voidedBy: "user-1" },
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "PRESCRIPTION_VOID_DISPENSE",
          referenceId: "rx-9",
        }),
      }),
    );
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            voided: true,
            originalMetadata: { voidedBy: "user-1" },
          }),
        }),
      }),
    );
  });

  it("releases prescription lines back into inventory", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-1",
        itemId: "item-1",
        batchId: "batch-1",
        change: -2,
        reason: "MANUAL_ADJUSTMENT",
        referenceId: "rx-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 8,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-1", quantity: 8, allocated: 0 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-release-1",
    });

    const events = await InventoryConsumptionService.releasePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [
        {
          inventoryItemId: "item-1",
          quantity: 2,
          sourceLineKey: "line-1",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: { quantity: { increment: 2 } },
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 8 },
      }),
    );
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-1",
        }),
      }),
    );
  });

  it("loads package mappings before consuming package inventory", async () => {
    mockedPrisma.productItem.findFirst.mockResolvedValueOnce({
      id: "pkg-1",
      package: {
        items: [
          {
            childProductItemId: "component-1",
            quantity: 2,
            sortOrder: 0,
          },
        ],
      },
    });
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "item-1",
      quantityMultiplier: 1,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 4,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 4, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 2, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-3",
    });

    const events = await InventoryConsumptionService.consumePackageProduct({
      organisationId: "org-1",
      packageProductItemId: "pkg-1",
      sourceId: "visit-1",
      quantity: 1,
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.productItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "pkg-1",
          kind: "PACKAGE",
        }),
      }),
    );
  });

  it("rejects procedure consumption when no mapping exists", async () => {
    mockedPrisma.inventoryConsumptionRule.findMany.mockResolvedValueOnce([]);

    await expect(
      InventoryConsumptionService.consumeProcedureProduct({
        organisationId: "org-1",
        procedureProductItemId: "proc-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow("Missing inventory mapping for procedure proc-1.");
  });
});
