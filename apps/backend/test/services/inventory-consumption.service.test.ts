import type { InventoryConsumptionAction } from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "../../src/services/inventory-consumption.service";

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    // The release path takes an advisory lock before it reads the balances
    // that authorise the release, so every release test needs this.
    $executeRaw: jest.fn(),
    inventoryConsumptionRule: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryConsumptionEvent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    controlledSubstanceLog: {
      findFirst: jest.fn(),
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
  $executeRaw: jest.Mock;
  inventoryConsumptionRule: {
    upsert: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  inventoryConsumptionEvent: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  controlledSubstanceLog: {
    findFirst: jest.Mock;
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
    jest.resetAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
    mockedPrisma.inventoryConsumptionEvent.findUnique.mockResolvedValue(null);
    mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValue(null);
    mockedPrisma.controlledSubstanceLog.findFirst.mockResolvedValue(null);
    mockedPrisma.controlledSubstanceLog.create.mockResolvedValue({
      id: "cs-log-created",
    });
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
    // Batch decrements must be atomic Prisma `decrement` writes, not a
    // literal computed value - otherwise a concurrent consumption of the same
    // batch produces a lost update even inside this transaction.
    expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: { quantity: { decrement: 2 } },
      }),
    );
    expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-2" },
        data: { quantity: { decrement: 1 } },
      }),
    );
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

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])(
    "rejects direct consumption when quantity is %s",
    async (_label, quantity) => {
      await expect(
        InventoryConsumptionService.consume({
          organisationId: "org-1",
          sourceType: "PRESCRIPTION",
          sourceId: "rx-1",
          lines: [
            {
              sourceLineKey: "line-1",
              inventoryItemId: "item-1",
              quantity,
            },
          ],
        }),
      ).rejects.toThrow("quantity must be a positive integer");

      expect(
        mockedPrisma.inventoryConsumptionEvent.create,
      ).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    },
  );

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
    expect(mockedPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    const [lockSql, lockKey] = mockedPrisma.$executeRaw.mock.calls[0];
    expect(lockSql.join("")).toContain("pg_advisory_xact_lock");
    expect(lockKey).toBe("prescription-dispense-request:org-1:rx-1");
    expect(mockedPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPrisma.prescriptionDispenseRequest.findFirst.mock
        .invocationCallOrder[0],
    );
  });

  /**
   * #3503: the cancel path branches on this request's status, so approve and
   * cancel have to serialise. Approve used to read and flip it holding no lock
   * at all, which let it draw stock inside the window a concurrent cancel had
   * already read as PENDING.
   */
  it("locks the dispense request before approve reads it", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(null);

    await expect(
      InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-lock-1",
        medications: [],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    const [lockSql, lockKey] = mockedPrisma.$executeRaw.mock.calls[0];
    expect(lockSql.join("")).toContain("pg_advisory_xact_lock");
    expect(lockKey).toBe("prescription-dispense-request:org-1:rx-lock-1");
    expect(mockedPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPrisma.prescriptionDispenseRequest.findFirst.mock
        .invocationCallOrder[0],
    );
  });

  describe("loadDispenseRequestForRetirementInTx", () => {
    const txClient = () => ({
      $executeRaw: jest.fn(),
      prescriptionDispenseRequest: { findFirst: jest.fn() },
    });

    it("takes the dispense-request lock on the caller's client before reading", async () => {
      const tx = txClient();
      tx.prescriptionDispenseRequest.findFirst.mockResolvedValue({
        id: "request-retire-1",
        status: "DISPENSED",
      });

      const request =
        await InventoryConsumptionService.loadDispenseRequestForRetirementInTx(
          tx as never,
          { organisationId: "org-1", prescriptionId: "rx-retire-1" },
        );

      expect(request).toMatchObject({ id: "request-retire-1" });
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      const [lockSql, lockKey] = tx.$executeRaw.mock.calls[0];
      expect(lockSql.join("")).toContain("pg_advisory_xact_lock");
      expect(lockKey).toBe("prescription-dispense-request:org-1:rx-retire-1");
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.prescriptionDispenseRequest.findFirst.mock.invocationCallOrder[0],
      );
      // On the caller's client: a lock taken on the service's own client is
      // released by that client's own transaction and guards nothing here.
      expect(mockedPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it("reads the newest PENDING or DISPENSED request for the prescription", async () => {
      const tx = txClient();
      tx.prescriptionDispenseRequest.findFirst.mockResolvedValue(null);

      await InventoryConsumptionService.loadDispenseRequestForRetirementInTx(
        tx as never,
        { organisationId: "org-1", prescriptionId: "rx-retire-2" },
      );

      expect(tx.prescriptionDispenseRequest.findFirst).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          prescriptionId: "rx-retire-2",
          status: { in: ["PENDING", "DISPENSED"] },
        },
        orderBy: { requestedAt: "desc" },
      });
    });

    it("rejects a blank prescription id without taking the lock", async () => {
      const tx = txClient();

      await expect(
        InventoryConsumptionService.loadDispenseRequestForRetirementInTx(
          tx as never,
          { organisationId: "org-1", prescriptionId: "  " },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });
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
        parent: {
          name: "Jane Doe",
        },
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
            petParentName: "Jane Doe",
            patientImageUrl: "https://cdn.example/patient.png",
            petWeight: 12.5,
            petWeightUnit: "kg",
          }),
        }),
      }),
    );
  });

  it("enriches dispense requests by medication name when ids are missing", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-name-1",
        sku: "calpol-strip-10",
        name: "Calpol",
        stockUnitType: "strip",
        unitOfMeasure: "mg",
        packageQuantity: 10,
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
      id: "request-name-1",
      prescriptionId: "rx-name-1",
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
      prescriptionId: "rx-name-1",
      medications: [
        {
          name: "Calpol",
          quantity: 24,
          frequency: "BID",
          duration: "12 days",
          dosage: "1 Tablet",
          sourceLineKey: "line-name-1",
        },
      ],
      requestedBy: "user-1",
    });

    expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({
                in: ["Calpol"],
              }),
            }),
          ]),
        }),
      }),
    );
    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medications: [
            expect.objectContaining({
              inventoryItemName: "Calpol",
              inventoryItemCode: "Calpol",
              stockUnitType: "strip",
              packageQuantity: 10,
              unitQuantity: 10,
              stockUnitQty: 10,
              stockUnitQuantity: 10,
            }),
          ],
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

  it.each([
    ["2 weeks", undefined, 28],
    ["1 month", undefined, 60],
    ["2", "weeks", 28],
    ["2", "WEEKS", 28],
    ["14", undefined, 28],
    ["14 days", undefined, 28],
  ])(
    "converts a duration of %s (unit %s) into a full course quantity",
    async (duration, durationUnit, expectedQuantity) => {
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        {
          id: "item-duration-1",
          sku: "tab-1",
          name: "Course Medicine",
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
        id: "request-duration-1",
        prescriptionId: "rx-duration-1",
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
        prescriptionId: "rx-duration-1",
        medications: [
          {
            inventoryItemId: "item-duration-1",
            frequency: "BID",
            duration,
            ...(durationUnit ? { durationUnit } : {}),
            dosage: "1 Tablet",
            sourceLineKey: "line-duration-1",
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
              expect.objectContaining({ quantity: expectedQuantity }),
            ],
          }),
        }),
      );
    },
  );

  it("derives frequency from hourly and times-per-day strings", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-hourly-1",
        sku: "hourly-1",
        name: "Hourly Medicine",
        stockUnitType: "bottle",
        unitOfMeasure: "ml",
        packageQuantity: 30,
        sellingPrice: 12.34,
        unitCost: 8.5,
        prescriptionRequired: true,
        controlledItem: false,
      },
      {
        id: "item-times-1",
        sku: "times-1",
        name: "Times Medicine",
        stockUnitType: "bottle",
        unitOfMeasure: "tablet",
        packageQuantity: 30,
        sellingPrice: 8.5,
        unitCost: 8.5,
        prescriptionRequired: true,
        controlledItem: false,
      },
    ]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-frequency-1",
      prescriptionId: "rx-frequency-1",
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
      prescriptionId: "rx-frequency-1",
      medications: [
        {
          inventoryItemId: "item-hourly-1",
          frequency: "Q8H",
          duration: "1 day",
          dosage: "2.5ml",
          sourceLineKey: "line-hourly-1",
        },
        {
          inventoryItemId: "item-times-1",
          frequency: "3 x daily",
          duration: "1 day",
          dosage: "1 Tablet",
          sourceLineKey: "line-times-1",
        },
      ],
      requestedBy: "user-1",
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medications: expect.arrayContaining([
            expect.objectContaining({
              inventoryItemId: "item-hourly-1",
              frequencyPerDay: 3,
              doseQty: 2.5,
              doseUnit: "ml",
            }),
            expect.objectContaining({
              inventoryItemId: "item-times-1",
              frequencyPerDay: 3,
            }),
          ]),
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
          // No frequency/duration: quantity is dispensed as a direct total, so
          // this case exercises the allocated-stock path without the course
          // (perDose x frequency x duration) computation.
          inventoryItemId: "item-approve-2",
          quantity: 200,
          stockUnitQuantity: 100,
          stockUnitQty: 100,
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

  it("deducts the full multi-week course, not the per-dose quantity (#1880)", async () => {
    // Real dispense request: Paracetamol, Qnt 3, BID (2/day), Duration 2 weeks,
    // 15 capsules per strip. The modal quotes 3 x 2/day x 14 days = 84 capsules
    // => 6 strips. Stock must drop by 6 strips, not by 1 (the raw per-dose 3
    // rounded up over a 15-capsule strip).
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-1880",
      prescriptionId: "rx-1880",
      organisationId: "org-1",
      status: "PENDING",
      medications: [
        {
          inventoryItemId: "item-1880",
          quantity: 3,
          frequency: "BID",
          frequencyPerDay: 2,
          durationDays: 14,
          stockUnitQuantity: 15,
          stockUnitQty: 15,
          sourceLineKey: "line-1",
        },
      ],
      metadata: {
        appointmentKind: "OUTPATIENT",
        dispenseStockSource: "NORMAL",
      },
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1880",
      organisationId: "org-1",
      onHand: 20,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1880", quantity: 20, allocated: 0 }])
      .mockResolvedValueOnce([
        { id: "batch-1880", quantity: 14, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-1880",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-1880",
      prescriptionId: "rx-1880",
      organisationId: "org-1",
      status: "DISPENSED",
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-1880",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    // 84 capsules / 15 per strip = ceil(5.6) = 6 strips; 20 - 6 = 14.
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 14 },
      }),
    );
  });

  it("honors durationUnit stored in prescription metadata when approving a dispense request", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-metadata-duration",
      prescriptionId: "rx-metadata-duration",
      organisationId: "org-1",
      status: "PENDING",
      medications: [
        {
          inventoryItemId: "item-metadata-duration",
          quantity: 2,
          frequency: "BID",
          duration: "3",
          metadata: {
            durationUnit: "weeks",
          },
          stockUnitQuantity: 15,
          stockUnitQty: 15,
          sourceLineKey: "line-1",
        },
      ],
      metadata: {
        appointmentKind: "INPATIENT",
        dispenseStockSource: "ALLOCATED",
      },
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-metadata-duration",
      organisationId: "org-1",
      onHand: 20,
      allocated: 20,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-metadata-duration", quantity: 20, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-metadata-duration", quantity: 14, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-metadata-duration",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-metadata-duration",
      prescriptionId: "rx-metadata-duration",
      organisationId: "org-1",
      status: "DISPENSED",
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-metadata-duration",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 14, allocated: 14 },
      }),
    );
  });

  // Enrichment derives the whole course when a line carries no quantity of its
  // own, and writes it to `quantity`. `resolveDispenseTotalUnits` reads
  // `quantity` as a PER-DOSE amount, so without the `totalUnits` marker the
  // course was multiplied by frequency and duration a second time.
  it("marks a derived course total so it is not multiplied out again", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-derived",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-derived",
      medications: [
        {
          inventoryItemId: "item-derived",
          // No quantity: the course has to be derived. 1 x BID x 3 days = 6.
          dose: "1",
          frequency: "BID",
          duration: "3",
          sourceLineKey: "line-derived",
        },
        {
          inventoryItemId: "item-explicit",
          // Carries its own per-dose quantity, so it stays multiplied later.
          quantity: 2,
          frequency: "BID",
          duration: "3",
          sourceLineKey: "line-explicit",
        },
      ],
    });

    const created = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { medications: Array<Record<string, unknown>> };
    };
    const byItem = new Map(
      created.data.medications.map((med) => [med.inventoryItemId, med]),
    );

    expect(byItem.get("item-derived")?.totalUnits).toBe(6);
    expect(byItem.get("item-explicit")?.totalUnits).toBeUndefined();
  });

  it("matches the dispensary modal duration calculation when approving a created request", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-created-duration",
        sku: "created-duration",
        name: "Created Duration Medicine",
        stockUnitType: "strip",
        unitOfMeasure: "tablet",
        packageQuantity: 15,
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
      id: "request-created-duration",
      prescriptionId: "rx-created-duration",
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
      prescriptionId: "rx-created-duration",
      medications: [
        {
          inventoryItemId: "item-created-duration",
          quantity: 2,
          frequency: "BID",
          duration: "3 weeks",
          sourceLineKey: "line-created-duration",
        },
      ],
      requestedBy: "user-1",
    });

    const createdRequest = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: {
        medications: Record<string, unknown>[];
        metadata: Record<string, unknown>;
      };
    };

    expect(createdRequest.data.medications[0]).toEqual(
      expect.objectContaining({
        quantity: 2,
        durationDays: 3,
        metadata: { durationUnit: "weeks" },
      }),
    );

    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-created-duration",
      prescriptionId: "rx-created-duration",
      organisationId: "org-1",
      status: "PENDING",
      medications: createdRequest.data.medications,
      metadata: createdRequest.data.metadata,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-created-duration",
      organisationId: "org-1",
      onHand: 50,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-created-duration", quantity: 50, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-created-duration", quantity: 44, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-created-duration",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-created-duration",
      prescriptionId: "rx-created-duration",
      organisationId: "org-1",
      status: "DISPENSED",
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-created-duration",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ change: -6 }),
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { onHand: 44 },
      }),
    );
  });

  it("matches the dispensary modal calculation for descriptive frequency labels", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-modal-frequency",
      prescriptionId: "rx-modal-frequency",
      organisationId: "org-1",
      status: "PENDING",
      medications: [
        {
          inventoryItemId: "item-modal-frequency",
          inventoryItemName: "Enterogermina",
          quantity: 1,
          frequency: "TID (three times daily)",
          durationDays: 6,
          metadata: {
            durationUnit: "days",
          },
          stockUnitQuantity: 4,
          stockUnitQty: 4,
          sourceLineKey: "line-modal-frequency",
        },
      ],
      metadata: {
        appointmentKind: "INPATIENT",
        dispenseStockSource: "ALLOCATED",
      },
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-modal-frequency",
      organisationId: "org-1",
      onHand: 20,
      allocated: 20,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-modal-frequency", quantity: 20, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-modal-frequency", quantity: 15, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-modal-frequency",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-modal-frequency",
      prescriptionId: "rx-modal-frequency",
      organisationId: "org-1",
      status: "DISPENSED",
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-modal-frequency",
        medications: [],
        reviewedBy: "user-1",
      });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ change: -5 }),
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 15, allocated: 15 },
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
      prescription: {
        id: "rx-not-dispensed-1",
        artifactId: "artifact-not-dispensed-1",
        artifact: {
          appointmentId: "appt-not-dispensed-1",
        },
      },
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-not-dispensed-1",
      prescriptionId: "rx-not-dispensed-1",
      organisationId: "org-1",
      status: "NOT_DISPENSED",
      reviewedBy: "user-1",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-not-dispensed-1",
      prescriptionId: "rx-not-dispensed-1",
      organisationId: "org-1",
      status: "NOT_DISPENSED",
      medications: [],
      metadata: null,
      requestedBy: null,
      reviewedBy: "user-1",
      requestedAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      prescription: {
        id: "rx-not-dispensed-1",
        artifactId: "artifact-not-dispensed-1",
        artifact: {
          appointmentId: "appt-not-dispensed-1",
        },
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        name: "Bella",
        parent: {
          name: "Sarah Bella",
        },
      },
      lead: {
        name: "Dr. Rao",
      },
      room: {
        name: "Ward A",
      },
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
      patientName: "Bella",
      parentName: "Sarah Bella",
      leadName: "Dr. Rao",
      location: "Ward A",
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
          appointmentId: "appt-1",
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
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        name: "Milo",
      },
      lead: {
        name: "Dr. Patel",
      },
      room: {
        name: "Room 2",
      },
    });

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-get-1",
      });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("request-get-1");
    expect(result).toEqual(
      expect.objectContaining({
        patientName: "Milo",
        leadName: "Dr. Patel",
        location: "Room 2",
      }),
    );
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

  it("lists mapping rules for an organisation and rejects a blank id", async () => {
    mockedPrisma.inventoryConsumptionRule.findMany.mockResolvedValueOnce([
      { id: "rule-1", organisationId: "org-1", sourceType: "PRESCRIPTION" },
    ]);

    const rules = await InventoryConsumptionService.listRules("org-1");

    expect(rules).toHaveLength(1);
    expect(mockedPrisma.inventoryConsumptionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1" },
        orderBy: [{ sourceType: "asc" }, { sourceKey: "asc" }],
      }),
    );

    await expect(InventoryConsumptionService.listRules(" ")).rejects.toThrow(
      "organisationId is required",
    );
  });

  it("rejects list/get/create/approve/not-dispensed calls with a blank organisationId", async () => {
    await expect(
      InventoryConsumptionService.listPrescriptionDispenseRequests({
        organisationId: " ",
      }),
    ).rejects.toThrow("organisationId is required");

    await expect(
      InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: " ",
        dispenseRequestId: "req-1",
      }),
    ).rejects.toThrow("organisationId and dispenseRequestId are required");

    await expect(
      InventoryConsumptionService.createPrescriptionDispenseRequest({
        organisationId: " ",
        prescriptionId: "rx-1",
        medications: [],
      }),
    ).rejects.toThrow("organisationId and prescriptionId are required");

    await expect(
      InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: " ",
        prescriptionId: "rx-1",
        medications: [],
      }),
    ).rejects.toThrow("organisationId and prescriptionId are required");

    await expect(
      InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed({
        organisationId: " ",
        prescriptionId: "rx-1",
      }),
    ).rejects.toThrow("organisationId and prescriptionId are required");
  });

  it("throws when approving with no pending dispense request", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );

    await expect(
      InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-none",
        medications: [],
      }),
    ).rejects.toThrow("Dispense request not found");
  });

  it("returns an empty list when consume is given no lines", async () => {
    const events = await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-1",
      lines: [],
    });

    expect(events).toEqual([]);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects direct consumption with a blank organisationId", async () => {
    await expect(
      InventoryConsumptionService.consume({
        organisationId: " ",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-1",
        lines: [
          { sourceLineKey: "line-1", inventoryItemId: "item-1", quantity: 1 },
        ],
      }),
    ).rejects.toThrow("organisationId and sourceId are required");
  });

  it("rejects direct consumption when a line cannot resolve an inventory item", async () => {
    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-1",
        lines: [{ sourceLineKey: "line-unresolved", quantity: 1 }],
      }),
    ).rejects.toThrow("Unable to resolve inventory item for line-unresolved.");

    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-1",
        lines: [
          {
            sourceLineKey: "line-missing-sku",
            inventoryItemSku: "missing-sku",
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow("Unable to resolve inventory item for line-missing-sku.");
  });

  it("returns an existing event when the idempotency key already applied", async () => {
    mockedPrisma.inventoryConsumptionEvent.findUnique.mockResolvedValueOnce({
      id: "existing-event",
      status: "APPLIED",
    });

    const events = await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-1",
      lines: [
        { sourceLineKey: "line-1", inventoryItemId: "item-1", quantity: 1 },
      ],
    });

    expect(events).toEqual([{ id: "existing-event", status: "APPLIED" }]);
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(
      mockedPrisma.inventoryConsumptionEvent.create,
    ).not.toHaveBeenCalled();
  });

  it("records a skipped event for an action outside the consume/reserve/release set", async () => {
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "skipped-event",
      status: "SKIPPED",
    });

    const events = await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-1",
      action: "ADJUST" as unknown as InventoryConsumptionAction,
      lines: [
        { sourceLineKey: "line-1", inventoryItemId: "item-1", quantity: 1 },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ADJUST",
          status: "SKIPPED",
          inventoryItemId: "item-1",
        }),
      }),
    );
  });

  it("resolves ALLOCATED stock source from an inpatient appointmentKind", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 5,
      allocated: 4,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 5 }])
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 4 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-inpatient",
    });

    await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-inpatient",
      metadata: { appointmentKind: "INPATIENT" },
      lines: [
        { sourceLineKey: "line-1", inventoryItemId: "item-1", quantity: 1 },
      ],
    });

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 4, allocated: 3 },
      }),
    );
  });

  it("resolves NORMAL stock source from an outpatient appointmentKind", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-2",
      organisationId: "org-1",
      onHand: 5,
      allocated: 4,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-2", quantity: 5 }])
      .mockResolvedValueOnce([{ id: "batch-2", quantity: 4 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-outpatient",
    });

    await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-outpatient",
      metadata: { appointmentKind: "OUTPATIENT" },
      lines: [
        { sourceLineKey: "line-1", inventoryItemId: "item-2", quantity: 1 },
      ],
    });

    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 4 },
      }),
    );
  });

  it("parses dosage, frequency and duration helper edge cases", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-edge-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-edge-1",
      medications: [
        {
          inventoryItemId: "p1",
          doseQty: 3,
          dosage: "Tablet",
          frequency: "PRN",
          sourceLineKey: "p1",
        },
        {
          inventoryItemId: "p2",
          doseQty: "2.5",
          dosage: "5.mg",
          frequency: "Q5H",
          durationDays: 10,
          sourceLineKey: "p2",
        },
        {
          inventoryItemId: "p3",
          doseQty: "abc",
          dosage: "   ",
          sourceLineKey: "p3",
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
              doseQty: 3,
              doseUnit: "Tablet",
              frequencyPerDay: undefined,
            }),
            expect.objectContaining({
              doseQty: 2.5,
              doseUnit: "5.mg",
              frequencyPerDay: 5,
              durationDays: 10,
            }),
            expect.objectContaining({
              doseQty: undefined,
              doseUnit: undefined,
            }),
          ],
        }),
      }),
    );
  });

  it("returns medications unchanged when the payload is not an array", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-nonarray-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-nonarray-1",
      medications: null,
      requestedBy: "user-1",
    });

    expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ medications: null }),
      }),
    );
  });

  it("returns medications unchanged when no identifiers are present", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-noids-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-noids-1",
      medications: [{ quantity: 1 }],
      requestedBy: "user-1",
    });

    expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ medications: [{ quantity: 1 }] }),
      }),
    );
  });

  it("builds a feline/spayed snapshot from an appointment with a string date of birth", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        type: "cat",
        gender: "female",
        isNeutered: true,
        dateOfBirth: "2020-03-25",
        currentWeight: 5,
        parent: { firstName: "Foo", lastName: "Bar" },
      },
      appointmentKind: "OUTPATIENT",
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-cat-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-cat-1",
      medications: [],
      context: { appointmentId: "appt-cat-1" },
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            petSpecies: "Feline",
            petSex: "Female",
            petReproductiveStatus: "Spayed",
            petParentName: "Foo Bar",
            petWeight: 5,
            petWeightUnit: "kg",
            appointmentKind: "OUTPATIENT",
            dispenseStockSource: "NORMAL",
          }),
        }),
      }),
    );
  });

  it("builds an equine/intact snapshot and drops an invalid date of birth", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        type: "horse",
        gender: "unknown",
        isNeutered: false,
        dateOfBirth: "not-a-real-date",
      },
      appointmentKind: "OUTPATIENT",
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-horse-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-horse-1",
      medications: [],
      context: { appointmentId: "appt-horse-1" },
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(createArgs.data.metadata).toMatchObject({
      petSpecies: "Equine",
      petSex: "Unknown",
      petReproductiveStatus: "Intact",
    });
    expect(createArgs.data.metadata).not.toHaveProperty("petAge");
    expect(createArgs.data.metadata).not.toHaveProperty("petWeightUnit");
  });

  it("omits pet fields when species and gender are absent and the birth date is in the future", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        isNeutered: "maybe",
        dateOfBirth: "2999-01-01",
      },
      appointmentKind: "OUTPATIENT",
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-empty-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-empty-1",
      medications: [],
      context: { appointmentId: "appt-empty-1" },
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(createArgs.data.metadata).not.toHaveProperty("petSpecies");
    expect(createArgs.data.metadata).not.toHaveProperty("petSex");
    expect(createArgs.data.metadata).not.toHaveProperty(
      "petReproductiveStatus",
    );
    expect(createArgs.data.metadata).not.toHaveProperty("petAge");
  });

  it("loads a pet snapshot from the encounter path with a parent name", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValueOnce({
      patientId: "patient-enc-1",
    });
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({
      type: "dog",
      gender: "male",
      currentWeight: 10,
      parent: { name: "Encounter Owner" },
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-enc-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-enc-1",
      medications: [],
      context: { encounterId: "enc-1" },
    });

    expect(mockedPrisma.encounter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enc-1", organisationId: "org-1" },
      }),
    );
    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            petSpecies: "Canine",
            petSex: "Male",
            petParentName: "Encounter Owner",
          }),
        }),
      }),
    );
  });

  it("loads a pet snapshot from the encounter path without a parent name", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValueOnce({
      patientId: "patient-enc-2",
    });
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({
      type: "cat",
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-enc-2",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-enc-2",
      medications: [],
      context: { encounterId: "enc-2" },
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(createArgs.data.metadata).toMatchObject({ petSpecies: "Feline" });
    expect(createArgs.data.metadata).not.toHaveProperty("petParentName");
  });

  it("returns an empty snapshot when the encounter has no patient", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValueOnce({ patientId: null });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-enc-3",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-enc-3",
      medications: [],
      context: { encounterId: "enc-3" },
    });

    expect(mockedPrisma.patient.findFirst).not.toHaveBeenCalled();
    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(createArgs.data.metadata).not.toHaveProperty("petSpecies");
    expect(createArgs.data.metadata).toMatchObject({
      appointmentKind: "OUTPATIENT",
    });
  });

  it("returns an empty snapshot when the encounter patient row is missing", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValueOnce({
      patientId: "patient-enc-4",
    });
    mockedPrisma.patient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-enc-4",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-enc-4",
      medications: [],
      context: { encounterId: "enc-4" },
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(createArgs.data.metadata).not.toHaveProperty("petSpecies");
  });

  it("rejects prescription actions with a blank organisationId", async () => {
    await expect(
      InventoryConsumptionService.consumePrescription({
        organisationId: " ",
        prescriptionId: "rx-1",
        medications: [],
      }),
    ).rejects.toThrow("organisationId and prescriptionId are required");
  });

  it("skips prescription lines without a resolvable quantity", async () => {
    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-noqty",
      medications: [{ medicationCode: "MED-1" }],
    });

    expect(events).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Prescription line skipped: no resolvable quantity",
      expect.objectContaining({ medicationCode: "MED-1" }),
    );
  });

  it("resolves prescription lines by sku and by batch/lot/expiry selectors", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-by-sku",
    });
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce({
      id: "batch-bn",
      itemId: "item-by-batch",
    });
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "reserve-event",
    });

    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-selectors",
      medications: [
        { inventoryItemSku: "sku-9", quantity: 1, sourceLineKey: "line-sku" },
        { batchNumber: "BN-9", quantity: 1, sourceLineKey: "line-bn" },
        {
          inventoryItemId: "item-lot",
          lotNumber: "LOT-9",
          quantity: 1,
          sourceLineKey: "line-lot",
        },
        {
          inventoryItemId: "item-exp",
          expiryDate: "2027-06-01",
          quantity: 1,
          sourceLineKey: "line-exp",
        },
      ],
    });

    expect(events).toHaveLength(4);
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ batchNumber: "BN-9" }),
      }),
    );
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lotNumber: "LOT-9" }),
      }),
    );
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiryDate: expect.any(Date) }),
      }),
    );
  });

  it("throws when releasing an inventory item that does not exist", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-release-missing",
        medications: [
          { inventoryItemId: "item-x", quantity: 1, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow("Inventory item not found");
  });

  it("throws when releasing with no prior consumption to reverse", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-x",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });

    await expect(
      InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-release-empty",
        medications: [
          { inventoryItemId: "item-x", quantity: 1, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow("No prior consumption found to release");
  });

  // Refused on the way in rather than part-applied and then unwound: the guard
  // reads what the consumption still has out (one unit) and rejects the request
  // for five before a single batch row moves.
  it("throws when a release asks for more than the consumption still has out", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-x",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-1",
        itemId: "item-x",
        batchId: "batch-x",
        change: -1,
        referenceId: "rx-release-partial",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});

    await expect(
      InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-release-partial",
        medications: [
          { inventoryItemId: "item-x", quantity: 5, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow(
      "Release exceeds the quantity still outstanding for this consumption",
    );

    expect(mockedPrisma.inventoryBatch.update).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryStockMovement.create).not.toHaveBeenCalled();
  });

  it("returns prescription stock with a dedicated return movement reason", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-return-1",
        itemId: "item-return",
        batchId: "batch-return",
        change: -2,
        referenceId: "rx-return",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-return",
      organisationId: "org-1",
      onHand: 8,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-return", quantity: 8 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-return",
    });

    const events = await InventoryConsumptionService.returnPrescription({
      organisationId: "org-1",
      prescriptionId: "rx-return",
      medications: [
        {
          inventoryItemId: "item-return",
          quantity: 2,
          sourceLineKey: "line-1",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "PRESCRIPTION_RETURN" }),
      }),
    );
  });

  it("throws when consuming an inventory item that does not exist", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      InventoryConsumptionService.consumePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-consume-missing",
        medications: [
          { inventoryItemId: "item-x", quantity: 1, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow("Inventory item not found");
  });

  it("throws when consumption exceeds available stock on hand", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-x",
      organisationId: "org-1",
      onHand: 1,
      allocated: 0,
    });

    await expect(
      InventoryConsumptionService.consumePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-insufficient",
        medications: [
          { inventoryItemId: "item-x", quantity: 5, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow("Insufficient stock");
  });

  // onHand(10) alone would pass a quantity of 8, but 5 of that onHand is
  // already reserved via InventoryAllocationService.allocateStock for a
  // different patient/encounter - a NORMAL-source consumption must respect
  // that reservation the same way allocateStock's own guard does.
  it("refuses a NORMAL-source consumption that would dispense allocated (reserved) stock", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-reserved",
      organisationId: "org-1",
      onHand: 10,
      allocated: 5,
    });

    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-reserved",
        metadata: { dispenseStockSource: "NORMAL" },
        lines: [
          {
            sourceLineKey: "line-1",
            inventoryItemId: "item-reserved",
            quantity: 8,
          },
        ],
      }),
    ).rejects.toThrow("Insufficient stock");
    expect(mockedPrisma.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it("throws when batches cannot cover the full requested consumption", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-x",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-x", quantity: 2 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});

    await expect(
      InventoryConsumptionService.consumePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-partial",
        medications: [
          { inventoryItemId: "item-x", quantity: 3, sourceLineKey: "line-1" },
        ],
      }),
    ).rejects.toThrow("Failed to consume full requested quantity");
  });

  it("hydrates a dispense request with no display fields when the appointment is missing", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-no-appt",
      prescriptionId: "rx-no-appt",
      organisationId: "org-1",
      status: "PENDING",
      prescription: {
        artifact: { appointmentId: "appt-missing" },
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce(null);

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-no-appt",
      });

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("patientName");
    expect(mockedPrisma.appointment.findFirst).toHaveBeenCalled();
  });

  it("derives location and patient name from room unit and companion fallbacks", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-room-unit",
      prescriptionId: "rx-room-unit",
      organisationId: "org-1",
      status: "PENDING",
      prescription: {
        artifact: { appointmentId: "appt-room-unit" },
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: { companionName: "Buddy" },
      lead: {},
      room: { unit: { displayName: "Kennel 3" } },
    });

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-room-unit",
      });

    expect(result).toEqual(
      expect.objectContaining({
        patientName: "Buddy",
        location: "Kennel 3",
        leadName: null,
        parentName: null,
      }),
    );
  });

  it("falls back to room unit name and patient display name", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-unit-name",
      prescriptionId: "rx-unit-name",
      organisationId: "org-1",
      status: "PENDING",
      prescription: {
        artifact: { appointmentId: "appt-unit-name" },
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: { displayName: "Rex" },
      lead: { name: "Dr. Vet" },
      room: { unit: { name: "Bay 5" } },
    });

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-unit-name",
      });

    expect(result).toEqual(
      expect.objectContaining({
        patientName: "Rex",
        location: "Bay 5",
        leadName: "Dr. Vet",
      }),
    );
  });

  it("rejects package consumption with missing required identifiers", async () => {
    await expect(
      InventoryConsumptionService.consumePackageProduct({
        organisationId: " ",
        packageProductItemId: "pkg-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow(
      "organisationId, packageProductItemId and sourceId are required",
    );
  });

  it("throws when the package product cannot be found", async () => {
    mockedPrisma.productItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      InventoryConsumptionService.consumePackageProduct({
        organisationId: "org-1",
        packageProductItemId: "pkg-missing",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow("Package product not found");
  });

  it("throws when a package component has no source reference", async () => {
    mockedPrisma.productItem.findFirst.mockResolvedValueOnce({
      id: "pkg-1",
      package: {
        items: [{ quantity: 1, sortOrder: 0 }],
      },
    });

    await expect(
      InventoryConsumptionService.consumePackageProduct({
        organisationId: "org-1",
        packageProductItemId: "pkg-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow("Package component is missing a source reference");
  });

  it("throws when a package component has no inventory mapping", async () => {
    mockedPrisma.productItem.findFirst.mockResolvedValueOnce({
      id: "pkg-1",
      package: {
        items: [
          { childProductItemId: "component-1", quantity: 1, sortOrder: 0 },
        ],
      },
    });
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce(null);

    await expect(
      InventoryConsumptionService.consumePackageProduct({
        organisationId: "org-1",
        packageProductItemId: "pkg-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow(
      "Missing inventory mapping for package component component-1.",
    );
  });

  it("rejects procedure consumption with missing required identifiers", async () => {
    await expect(
      InventoryConsumptionService.consumeProcedureProduct({
        organisationId: " ",
        procedureProductItemId: "proc-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow(
      "organisationId, procedureProductItemId and sourceId are required",
    );
  });

  it("consumes procedure inventory from mapping rules", async () => {
    mockedPrisma.inventoryConsumptionRule.findMany.mockResolvedValueOnce([
      { inventoryItemId: "item-proc", quantityMultiplier: 2 },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-proc",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-proc", quantity: 5 }])
      .mockResolvedValueOnce([{ id: "batch-proc", quantity: 3 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-proc",
    });

    const events = await InventoryConsumptionService.consumeProcedureProduct({
      organisationId: "org-1",
      procedureProductItemId: "proc-1",
      sourceId: "visit-1",
      quantity: 1,
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryConsumptionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: "PROCEDURE",
          sourceKey: "proc-1",
          active: true,
        }),
      }),
    );
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ change: -2 }),
      }),
    );
  });

  it("enriches by matched sku and honours explicit rx/controlled flags", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {
        type: "rabbit",
        gender: "unknown",
        isNeutered: true,
        currentWeight: 3,
        currentWeightUnit: "lb",
        dateOfBirth: new Date("2021-01-01T00:00:00.000Z"),
        parent: { firstName: "Alex", lastName: "Stone" },
      },
      appointmentKind: "OUTPATIENT",
    });
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
      {
        id: "item-sku-match",
        sku: "SKU-X",
        name: "Widget",
        stockUnitType: "box",
        unitOfMeasure: "unit",
        packageQuantity: 5,
        sellingPrice: 0,
        unitCost: 0,
        prescriptionRequired: true,
        controlledItem: false,
      },
    ]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-sku-flags-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-sku-flags-1",
      medications: [
        {
          inventoryItemSku: "SKU-X",
          isRx: false,
          isControlled: true,
          quantity: 2,
          sourceLineKey: "line-sku-flags",
        },
      ],
      requestedBy: "user-1",
      context: { appointmentId: "appt-sku-flags-1" },
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: {
        medications: Record<string, unknown>[];
        metadata: Record<string, unknown>;
      };
    };
    expect(createArgs.data.medications[0]).toEqual(
      expect.objectContaining({
        inventoryItemName: "Widget",
        isRx: false,
        isControlled: true,
        stockUnitType: "box",
        priceCents: undefined,
      }),
    );
    expect(createArgs.data.metadata).toMatchObject({
      petSpecies: "Rabbit",
      petWeightUnit: "lb",
    });
  });

  it("normalises non-positive and string numeric medication fields", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-numeric-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-numeric-1",
      medications: [
        {
          inventoryItemId: "m1",
          doseQty: 0,
          dosage: "0mg",
          refillsRemaining: 0,
          sourceLineKey: "m1",
        },
        {
          inventoryItemId: "m2",
          doseQty: "0",
          dosage: "5",
          refillsRemaining: "0",
          sourceLineKey: "m2",
        },
        {
          inventoryItemId: "m3",
          duration: "5",
          durationUnit: "fortnights",
          dosage: "1 tab",
          sourceLineKey: "m3",
        },
      ],
      requestedBy: "user-1",
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: { medications: Record<string, unknown>[] };
    };
    expect(createArgs.data.medications[0]).toEqual(
      expect.objectContaining({
        doseQty: undefined,
        doseUnit: "mg",
        refillsRemaining: undefined,
      }),
    );
    expect(createArgs.data.medications[1]).toEqual(
      expect.objectContaining({
        doseQty: 5,
        doseUnit: undefined,
        refillsRemaining: undefined,
      }),
    );
    expect(createArgs.data.medications[2]).toEqual(
      expect.objectContaining({ durationDays: undefined }),
    );
  });

  it("treats a zero pack quantity as no pack when consuming a prescription", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-pack-0",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-pack-0", quantity: 5 }])
      .mockResolvedValueOnce([{ id: "batch-pack-0", quantity: 4 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-pack-0",
    });

    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-pack-0",
      medications: [
        {
          inventoryItemId: "item-pack-0",
          quantity: 1,
          stockUnitQuantity: 0,
          sourceLineKey: "line-pack-0",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ change: -1 }),
      }),
    );
  });

  it("consumes allocated stock across a null-quantity batch and stops once satisfied", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-ab",
      organisationId: "org-1",
      onHand: 10,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "b0", quantity: null },
        { id: "b1", quantity: 5 },
        { id: "b2", quantity: 5 },
      ])
      .mockResolvedValueOnce([
        { id: "b1", quantity: 3 },
        { id: "b2", quantity: 5 },
        { id: "b0", quantity: null },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-ab",
    });

    await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-alloc-batch",
      metadata: { appointmentKind: "INPATIENT" },
      lines: [
        { sourceLineKey: "line-ab", inventoryItemId: "item-ab", quantity: 2 },
      ],
    });

    expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onHand: 8, allocated: 0 } }),
    );
  });

  it("treats a null onHand as empty stock when consuming", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-oh",
      organisationId: "org-1",
      onHand: null,
    });

    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-null-onhand",
        lines: [
          { sourceLineKey: "line-oh", inventoryItemId: "item-oh", quantity: 1 },
        ],
      }),
    ).rejects.toThrow("Insufficient stock");
  });

  it("releases allocated stock across skipped and batchless movements", async () => {
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-r",
      organisationId: "org-1",
      onHand: 8,
    });
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "m0",
        itemId: "item-r",
        batchId: null,
        change: null,
        referenceId: "rx-rel-alloc",
      },
      {
        id: "m1",
        itemId: "item-r",
        batchId: null,
        change: -2,
        referenceId: "rx-rel-alloc",
      },
      {
        id: "m2",
        itemId: "item-r",
        batchId: "b2",
        change: -3,
        referenceId: "rx-rel-alloc",
      },
    ]);
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "b2", quantity: 6 },
    ]);
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-rel-alloc",
    });

    await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-rel-alloc",
      action: "RELEASE",
      metadata: { appointmentKind: "INPATIENT" },
      lines: [
        { sourceLineKey: "line-r", inventoryItemId: "item-r", quantity: 2 },
      ],
    });

    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          batchId: undefined,
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
        }),
      }),
    );
    expect(mockedPrisma.inventoryBatch.update).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onHand: 6, allocated: 2 } }),
    );
  });

  it("releases normal stock when the item has no allocated balance", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-norm-rel",
        itemId: "item-norm-rel",
        batchId: "batch-norm-rel",
        change: -2,
        referenceId: "rx-norm-rel",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-norm-rel",
      organisationId: "org-1",
      onHand: 8,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-norm-rel", quantity: 8 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-norm-rel",
    });

    const events = await InventoryConsumptionService.releasePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-norm-rel",
      medications: [
        {
          inventoryItemId: "item-norm-rel",
          quantity: 2,
          sourceLineKey: "line-norm-rel",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onHand: 8 } }),
    );
  });

  it("resolves a Date expiry batch selector while reserving", async () => {
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-expiry-date",
    });

    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-expiry-date",
      medications: [
        {
          inventoryItemId: "item-expiry",
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          quantity: 1,
          sourceLineKey: "line-expiry",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiryDate: expect.any(Date) }),
      }),
    );
  });

  it("prefers a matched batch id over the raw batch for sku and rule lines", async () => {
    mockedPrisma.inventoryBatch.findFirst
      .mockResolvedValueOnce({ id: "batch-sku", itemId: "item-sku-batch" })
      .mockResolvedValueOnce({ id: "batch-rule", itemId: null });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "resolved-sku-item",
    });
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "item-rule-batch",
      quantityMultiplier: 1,
    });
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-batch-preference",
    });

    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-batch-preference",
      medications: [
        {
          inventoryItemSku: "sku-batch",
          batchNumber: "BN-SKU",
          quantity: 1,
          sourceLineKey: "line-sku-batch",
        },
        {
          name: "RuleMed",
          batchNumber: "BN-RULE",
          quantity: 1,
          sourceLineKey: "line-rule-batch",
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inventoryItemId: "resolved-sku-item" }),
      }),
    );
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inventoryItemId: "item-rule-batch" }),
      }),
    );
  });

  it("throws when a mapping rule resolves to a blank inventory item id", async () => {
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "",
      quantityMultiplier: 1,
    });

    await expect(
      InventoryConsumptionService.consumePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-blank-rule",
        medications: [{ name: "Ghost", quantity: 1 }],
      }),
    ).rejects.toThrow("Unable to resolve inventory item for Ghost.");
  });

  it("returns no lines when prescription medications are not an array", async () => {
    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-not-array",
      medications: null,
    });

    expect(events).toEqual([]);
    expect(
      mockedPrisma.inventoryConsumptionEvent.create,
    ).not.toHaveBeenCalled();
  });

  it("skips non-object entries and logs skipped lines without a code", async () => {
    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-skip",
      medications: [null, "string-entry", {}, { drugCode: "DRUG-1" }],
    });

    expect(events).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Prescription line skipped: no resolvable quantity",
      expect.objectContaining({ medicationCode: null }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Prescription line skipped: no resolvable quantity",
      expect.objectContaining({ medicationCode: "DRUG-1" }),
    );
  });

  it("falls back to an existing pending request's blank requester", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-fallback-requester",
      prescriptionId: "rx-fallback-requester",
      organisationId: "org-1",
      status: "PENDING",
      requestedBy: null,
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-fallback-requester",
      status: "PENDING",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-fallback-requester",
      medications: [],
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedBy: undefined }),
      }),
    );
  });

  it("hydrates display fields to null when the appointment has no data", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-null-fields",
      prescriptionId: "rx-null-fields",
      organisationId: "org-1",
      status: "PENDING",
      prescription: {
        artifact: { appointmentId: "appt-null-fields" },
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      patient: {},
      lead: {},
      room: {},
    });

    const result =
      await InventoryConsumptionService.getPrescriptionDispenseRequest({
        organisationId: "org-1",
        dispenseRequestId: "request-null-fields",
      });

    expect(result).toEqual(
      expect.objectContaining({
        patientName: null,
        parentName: null,
        leadName: null,
        location: null,
      }),
    );
  });

  it("returns null when the not-dispensed refetch finds nothing", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst
      .mockResolvedValueOnce({
        id: "request-refetch-null",
        prescriptionId: "rx-refetch-null",
        organisationId: "org-1",
        status: "PENDING",
      })
      .mockResolvedValueOnce(null);
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-refetch-null",
      status: "NOT_DISPENSED",
    });

    const result =
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: "org-1",
          prescriptionId: "rx-refetch-null",
        },
      );

    expect(result).toBeNull();
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewedBy: undefined }),
      }),
    );
  });

  it("defaults rule multiplier, notes and active when upserting minimal input", async () => {
    mockedPrisma.inventoryConsumptionRule.upsert.mockResolvedValueOnce({
      id: "rule-minimal",
    });

    await InventoryConsumptionService.upsertRule({
      organisationId: "org-1",
      sourceType: "PROCEDURE",
      sourceKey: "Dental",
      inventoryItemId: "item-minimal",
    });

    expect(mockedPrisma.inventoryConsumptionRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          quantityMultiplier: 1,
          notes: undefined,
          active: true,
        }),
        update: expect.objectContaining({
          quantityMultiplier: 1,
          notes: undefined,
          active: true,
        }),
      }),
    );
  });

  it("filters dispense requests by status and prescription id", async () => {
    mockedPrisma.prescriptionDispenseRequest.findMany.mockResolvedValueOnce([]);

    await InventoryConsumptionService.listPrescriptionDispenseRequests({
      organisationId: "org-1",
      status: "PENDING",
      prescriptionId: "rx-filter",
    });

    expect(
      mockedPrisma.prescriptionDispenseRequest.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          status: "PENDING",
          prescriptionId: "rx-filter",
        }),
      }),
    );
  });

  it("approves using request payload fallbacks and a default stock source", async () => {
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "request-approve-fallback",
      prescriptionId: "rx-approve-fallback",
      organisationId: "org-1",
      status: "PENDING",
      medications: null,
      metadata: null,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-approve-fallback",
      organisationId: "org-1",
      onHand: 5,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-approve-fallback", quantity: 5 }])
      .mockResolvedValueOnce([{ id: "batch-approve-fallback", quantity: 4 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-approve-fallback",
    });
    mockedPrisma.prescriptionDispenseRequest.update.mockResolvedValueOnce({
      id: "request-approve-fallback",
      status: "DISPENSED",
    });

    const events =
      await InventoryConsumptionService.approvePrescriptionDispenseRequest({
        organisationId: "org-1",
        prescriptionId: "rx-approve-fallback",
        medications: [
          {
            inventoryItemId: "item-approve-fallback",
            quantity: 1,
            sourceLineKey: "line-approve-fallback",
          },
        ],
      });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onHand: 4 } }),
    );
    expect(
      mockedPrisma.prescriptionDispenseRequest.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DISPENSED",
          reviewedBy: undefined,
        }),
      }),
    );
  });

  it("voids a dispense with a null original metadata when none is supplied", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-void-null",
        itemId: "item-void-null",
        batchId: "batch-void-null",
        change: -1,
        referenceId: "rx-void-null",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-void-null",
      organisationId: "org-1",
      onHand: 4,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-void-null", quantity: 4 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-void-null",
    });

    await InventoryConsumptionService.voidDispensePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-void-null",
      medications: [
        {
          inventoryItemId: "item-void-null",
          batchId: "batch-void-null",
          quantity: 1,
          sourceLineKey: "line-void-null",
        },
      ],
    });

    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            voided: true,
            originalMetadata: null,
          }),
        }),
      }),
    );
  });

  it("derives frequency from keyword and interval descriptions", async () => {
    mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([]);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-keyword-freq",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-keyword-freq",
      medications: [
        {
          inventoryItemId: "item-freq-sid",
          frequency: "SID WITH FOOD",
          sourceLineKey: "line-freq-sid",
        },
        {
          inventoryItemId: "item-freq-twice",
          frequency: "TWICE DAILY",
          sourceLineKey: "line-freq-twice",
        },
        {
          inventoryItemId: "item-freq-four",
          frequency: "FOUR TIMES DAILY",
          sourceLineKey: "line-freq-four",
        },
        {
          inventoryItemId: "item-freq-weekly",
          frequency: "ONCE WEEKLY",
          sourceLineKey: "line-freq-weekly",
        },
        {
          inventoryItemId: "item-freq-meals",
          frequency: "AFTER MEALS",
          sourceLineKey: "line-freq-meals",
        },
        {
          inventoryItemId: "item-freq-hours",
          frequency: "EVERY 6 HOURS",
          sourceLineKey: "line-freq-hours",
        },
        {
          inventoryItemId: "item-freq-invalid",
          frequency: "EVERY 0 HOURS",
          sourceLineKey: "line-freq-invalid",
        },
        // Sub-daily schedules the keyword pass does not cover. Without these a
        // course on one of them resolves to NO frequency and falls back to a
        // single dose, so stock consumption issues a fraction of the course.
        {
          inventoryItemId: "item-freq-three-a-week",
          frequency: "3 TIMES A WEEK",
          sourceLineKey: "line-freq-three-a-week",
        },
        {
          inventoryItemId: "item-freq-every-3-days",
          frequency: "EVERY 3 DAYS",
          sourceLineKey: "line-freq-every-3-days",
        },
        {
          inventoryItemId: "item-freq-fortnightly",
          frequency: "FORTNIGHTLY",
          sourceLineKey: "line-freq-fortnightly",
        },
        {
          inventoryItemId: "item-freq-monthly",
          frequency: "MONTHLY",
          sourceLineKey: "line-freq-monthly",
        },
      ],
    });

    const createArgs = mockedPrisma.prescriptionDispenseRequest.create.mock
      .calls[0][0] as {
      data: {
        medications: Array<{
          inventoryItemId: string;
          frequencyPerDay?: number;
        }>;
      };
    };
    const byItemId = new Map(
      createArgs.data.medications.map((med) => [med.inventoryItemId, med]),
    );
    expect(byItemId.get("item-freq-sid")?.frequencyPerDay).toBe(1);
    expect(byItemId.get("item-freq-twice")?.frequencyPerDay).toBe(2);
    expect(byItemId.get("item-freq-four")?.frequencyPerDay).toBe(4);
    expect(byItemId.get("item-freq-weekly")?.frequencyPerDay).toBeCloseTo(
      1 / 7,
    );
    expect(byItemId.get("item-freq-meals")?.frequencyPerDay).toBe(3);
    expect(byItemId.get("item-freq-hours")?.frequencyPerDay).toBe(4);
    expect(byItemId.get("item-freq-invalid")?.frequencyPerDay).toBeUndefined();
    expect(byItemId.get("item-freq-three-a-week")?.frequencyPerDay).toBeCloseTo(
      3 / 7,
    );
    expect(byItemId.get("item-freq-every-3-days")?.frequencyPerDay).toBeCloseTo(
      1 / 3,
    );
    expect(byItemId.get("item-freq-fortnightly")?.frequencyPerDay).toBeCloseTo(
      1 / 14,
    );
    expect(byItemId.get("item-freq-monthly")?.frequencyPerDay).toBeCloseTo(
      1 / 30,
    );
  });

  it("falls back to the encounter snapshot when the appointment is missing", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.encounter.findFirst.mockResolvedValueOnce({
      patientId: "patient-fallback-1",
    });
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({
      type: "horse",
    });
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce(
      null,
    );
    mockedPrisma.prescriptionDispenseRequest.create.mockResolvedValueOnce({
      id: "request-fallback-1",
    });

    await InventoryConsumptionService.createPrescriptionDispenseRequest({
      organisationId: "org-1",
      prescriptionId: "rx-fallback-1",
      medications: [],
      context: { appointmentId: "appt-missing-1", encounterId: "enc-fb-1" },
    });

    expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-missing-1", organisationId: "org-1" },
      }),
    );
    expect(
      mockedPrisma.prescriptionDispenseRequest.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            petSpecies: "Equine",
            appointmentKind: "OUTPATIENT",
          }),
        }),
      }),
    );
  });

  // #3142 bug 4: approving a dispense and voiding one moved controlled stock
  // without ever writing the controlled substance register. These run the stock
  // paths with a transaction client that is a DIFFERENT object from the module
  // client, which is the production shape - the register write has to ride the
  // caller's transaction rather than open its own connection.
  describe("controlled substance register", () => {
    const controlledItem = {
      id: "item-cs-1",
      organisationId: "org-1",
      name: "Ketamine 100mg/ml",
      onHand: 10,
      allocated: 0,
      controlledItem: true,
      attributes: { drugSchedule: "Schedule III", species: ["DOG"] },
      stockUnitType: "ml",
      unitOfMeasure: null,
    };

    // The register mocks on the TRANSACTION client are separate jest.fn()s from
    // the ones on the module client, so asserting on these proves the entry was
    // written through the caller's transaction. Writing it through the module
    // client instead would leave a register entry behind when the dispense
    // rolls back, and these assertions would see nothing.
    let txCsCreate: jest.Mock;
    let txCsFindFirst: jest.Mock;
    // A release also reads the reversals that already exist for the entry it is
    // cancelling, so that lookup has to be on the transaction client too - the
    // amount it may still restore depends on it.
    let txCsFindMany: jest.Mock;
    // Same reasoning for the release lock: an advisory lock taken on a second
    // connection serialises nothing that this transaction's writes depend on,
    // so the test has to see it arrive on the caller's client.
    let txExecuteRaw: jest.Mock;

    const useDistinctTransactionClient = () => {
      txCsCreate = jest.fn().mockResolvedValue({ id: "cs-log-created" });
      txCsFindFirst = jest.fn().mockResolvedValue(null);
      txCsFindMany = jest.fn().mockResolvedValue([]);
      txExecuteRaw = jest.fn().mockResolvedValue(1);
      mockedPrisma.$transaction.mockImplementation(
        async (callback: unknown) => {
          if (typeof callback === "function") {
            return callback({
              ...prisma,
              $executeRaw: txExecuteRaw,
              controlledSubstanceLog: {
                create: txCsCreate,
                findFirst: txCsFindFirst,
                findMany: txCsFindMany,
              },
            });
          }
          return undefined;
        },
      );
    };

    const consumeControlledLine = (quantity: number) =>
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-cs-1",
        lines: [
          {
            sourceLineKey: "line-1",
            inventoryItemId: "item-cs-1",
            quantity,
          },
        ],
      });

    beforeEach(() => {
      useDistinctTransactionClient();
      mockedPrisma.inventoryBatch.update.mockResolvedValue({});
      mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
      mockedPrisma.inventoryItem.update.mockResolvedValue({});
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-1",
      });
    });

    it("writes one register entry per batch a controlled dispense draws from", async () => {
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue(controlledItem);
      mockedPrisma.inventoryBatch.findMany
        .mockResolvedValueOnce([
          { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
          { id: "batch-cs-2", quantity: 10, allocated: 0, lotNumber: "LOT-2" },
        ])
        .mockResolvedValueOnce([
          { id: "batch-cs-1", quantity: 0, allocated: 0, lotNumber: "LOT-1" },
          { id: "batch-cs-2", quantity: 8, allocated: 0, lotNumber: "LOT-2" },
        ]);

      await consumeControlledLine(8);

      expect(txCsCreate).toHaveBeenCalledTimes(2);
      // The running balance is per entry, so the two rows reconcile against each
      // other the way an inspector reads the register down the page.
      expect(txCsCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            organisationId: "org-1",
            drug: "Ketamine 100mg/ml",
            deaSchedule: "III",
            unit: "ML",
            lotNumber: "LOT-1",
            amountDrawn: 6,
            amountAdministered: 6,
            amountWasted: 0,
            balanceBefore: 10,
            balanceAfter: 4,
            sourceEventId: "event-cs-1",
            inventoryBatchId: "batch-cs-1",
          }),
        }),
      );
      expect(txCsCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            lotNumber: "LOT-2",
            amountDrawn: 2,
            balanceBefore: 4,
            balanceAfter: 2,
            sourceEventId: "event-cs-1",
            inventoryBatchId: "batch-cs-2",
          }),
        }),
      );
    });

    it("refuses the dispense when a controlled item carries no drug schedule, before any stock moves", async () => {
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        attributes: { drugSchedule: "Non-scheduled" },
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValue([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);

      await expect(consumeControlledLine(2)).rejects.toThrow(
        /no drug schedule/,
      );

      expect(mockedPrisma.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryStockMovement.create).not.toHaveBeenCalled();
      expect(txCsCreate).not.toHaveBeenCalled();
    });

    it("leaves an item that is not flagged controlled out of the register, whatever its attributes say", async () => {
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        controlledItem: false,
        attributes: { drugSchedule: "Schedule II" },
      });
      mockedPrisma.inventoryBatch.findMany
        .mockResolvedValueOnce([
          { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
        ])
        .mockResolvedValueOnce([
          { id: "batch-cs-1", quantity: 4, allocated: 0, lotNumber: "LOT-1" },
        ]);

      await consumeControlledLine(2);

      expect(txCsCreate).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { decrement: 2 } } }),
      );
    });

    it("reverses the register entry when the dispense is released", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-1",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 6,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            drug: "Ketamine 100mg/ml",
            deaSchedule: "III",
            lotNumber: "LOT-1",
            amountDrawn: -6,
            amountAdministered: -6,
            balanceBefore: 4,
            balanceAfter: 10,
            // Keyed to the release, never to the dispense it cancels: the pair
            // is unique, so inheriting it would collide.
            sourceEventId: "event-cs-release-1",
            inventoryBatchId: "batch-cs-1",
            notes: expect.stringContaining("[reversal:cs-log-1]"),
          }),
        }),
      );
    });

    // `controlledItem` is an ordinary editable boolean and the release re-reads
    // it, so gating the reversal on it let someone untick the flag between the
    // dispense and the return: the stock came back and the register kept saying
    // a Schedule III draw was out. Re-ticking could not repair it either - the
    // release event's idempotency key short-circuits the replay. What the
    // register owes is settled by the dispense that wrote it.
    it("reverses the register entry even after the item is unflagged as controlled", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
        controlledItem: false,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-1",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 6,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountDrawn: -6,
            balanceBefore: 4,
            balanceAfter: 10,
            sourceEventId: "event-cs-release-1",
          }),
        }),
      );
    });

    // The other half of removing that gate: an ordinary item still writes nothing.
    // The lookup, not the flag, is what keeps the register out of it - there is no
    // entry for the dispense, so there is nothing to reverse.
    it("writes no register entry when releasing stock no dispense entered in the register", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-plain-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
        controlledItem: false,
        attributes: {},
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce(null);
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-1",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 6,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { increment: 6 } } }),
      );
    });

    it("reverses only the amount a partial release actually restored", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-2",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 2,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountDrawn: -2,
            amountAdministered: -2,
            balanceBefore: 4,
            balanceAfter: 6,
          }),
        }),
      );
    });

    // The second release of one dispense is the case the first one cannot
    // cover: both rows are derived from the same entry, so a reversal that
    // reads only that entry opens the second row at the dispense's closing
    // balance again and the register reads 4 -> 6 and 4 -> 5 instead of
    // 4 -> 6 and 6 -> 7.
    it("opens a second partial release where the first one closed", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        // The first release's own movement. Without it the register would be
        // claiming two units are back that the stock ledger never returned,
        // which is a state the database cannot be in.
        {
          id: "movement-cs-release-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 6,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      // The 2 units an earlier release already put back.
      txCsFindMany.mockResolvedValueOnce([{ amountDrawn: -2 }]);
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-3",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 1,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountDrawn: -1,
            amountAdministered: -1,
            balanceBefore: 6,
            balanceAfter: 7,
          }),
        }),
      );
    });

    // The reviewer's case: 2 of a 6-unit draw are already back, so this release
    // may take at most 4. Reading only the negative movement lets the request
    // derive its allowance from the original draw a second time - stock would
    // be credited 6 while `reverseDispenseEntry`, which caps at the unrestored
    // amount, would enter only 4 in the register.
    it("refuses a release larger than what the dispense still has out, before any stock moves", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-release-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 6,
      });

      await expect(
        InventoryConsumptionService.releasePrescription({
          organisationId: "org-1",
          prescriptionId: "rx-cs-1",
          medications: [
            {
              inventoryItemId: "item-cs-1",
              quantity: 6,
              sourceLineKey: "line-1",
            },
          ],
        }),
      ).rejects.toThrow(
        "Release exceeds the quantity still outstanding for this consumption",
      );

      // Refused before the first write rather than clamped after it, so there
      // is no half-applied release for the transaction to unwind and no
      // register row that has to be reversed back out.
      expect(mockedPrisma.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryStockMovement.create).not.toHaveBeenCalled();
      expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
      expect(txCsCreate).not.toHaveBeenCalled();
    });

    // The closing release is where the two ledgers have to meet: 2 already back
    // plus 4 now is exactly the 6 that left, and the register's closing balance
    // returns to the balance the dispense opened at. Neither side can have
    // moved more than the original draw if both land on 10.
    it("closes a dispense at the original draw on the stock and register sides alike", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-release-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 6,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 10, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      txCsFindMany.mockResolvedValueOnce([{ amountDrawn: -2 }]);
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-4",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 4,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-cs-1" },
        data: { quantity: { increment: 4 } },
      });
      expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: "batch-cs-1",
            change: 4,
            referenceId: "rx-cs-1",
          }),
        }),
      );
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountDrawn: -4,
            amountAdministered: -4,
            balanceBefore: 6,
            balanceAfter: 10,
          }),
        }),
      );

      // The balances that authorise this release are read and then written
      // back, so the item row has to be locked before the read. Two concurrent
      // partial releases of one dispense would otherwise both see 4 still out
      // and each grant itself all 4.
      expect(txExecuteRaw).toHaveBeenCalledTimes(1);
      // Keyed to the item, so one item's releases queue behind each other and
      // nobody else's do.
      expect(txExecuteRaw.mock.calls[0][1]).toBe("inventory-release:item-cs-1");
      // On the caller's client, so it is the transaction doing the writing that
      // holds the lock.
      expect(mockedPrisma.$executeRaw).not.toHaveBeenCalled();
      expect(txExecuteRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockedPrisma.inventoryItem.findFirst.mock.invocationCallOrder[0],
      );
      expect(txExecuteRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockedPrisma.inventoryStockMovement.findMany.mock
          .invocationCallOrder[0],
      );
    });

    // Outstanding stock is owed by a batch, not by the line as a whole. A
    // release that spends one pooled allowance would take batch-cs-2's two
    // units out of batch-cs-1, which is already square - putting stock back in
    // the wrong lot and reversing the wrong register entry.
    it("takes a later release from the batch that still has stock out", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-release-a",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 4,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        {
          id: "movement-cs-a",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -4,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "movement-cs-b",
          itemId: "item-cs-1",
          batchId: "batch-cs-2",
          change: -2,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 8,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
        { id: "batch-cs-2", quantity: 4, allocated: 0, lotNumber: "LOT-2" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-2",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-2",
        strength: null,
        unit: "ML",
        amountDrawn: 2,
        amountAdministered: 2,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 6,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-2",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-5",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 2,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-cs-2" },
        data: { quantity: { increment: 2 } },
      });
      expect(txCsFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inventoryBatchId: "batch-cs-2",
          }),
        }),
      );
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryBatchId: "batch-cs-2",
            amountDrawn: -2,
          }),
        }),
      );
    });

    // One batch can be drawn more than once under a single reference, so the
    // batch's allowance has to be spent down as the loop walks its movements.
    // Left at its opening figure, the second -3 would fund another 2 units back
    // into a lot that only had 2 out, and the register would follow it.
    it("spends a batch's outstanding balance down across its own movements", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-release-a",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 4,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-04T00:00:00.000Z"),
        },
        {
          id: "movement-cs-a1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "movement-cs-a2",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "movement-cs-b",
          itemId: "item-cs-1",
          batchId: "batch-cs-2",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 5,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 4, allocated: 0, lotNumber: "LOT-1" },
        { id: "batch-cs-2", quantity: 6, allocated: 0, lotNumber: "LOT-2" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst
        .mockResolvedValueOnce({
          id: "cs-log-a",
          organisationId: "org-1",
          patientId: null,
          encounterId: null,
          loggedAt: new Date("2026-01-01T00:00:00.000Z"),
          drug: "Ketamine 100mg/ml",
          deaSchedule: "III",
          lotNumber: "LOT-1",
          strength: null,
          unit: "ML",
          amountDrawn: 6,
          amountAdministered: 6,
          amountWasted: 0,
          wastedWitness: null,
          balanceBefore: 10,
          balanceAfter: 4,
          administeredBy: null,
          notes: null,
          sourceEventId: "event-cs-1",
          inventoryBatchId: "batch-cs-1",
        })
        .mockResolvedValueOnce({
          id: "cs-log-b",
          organisationId: "org-1",
          patientId: null,
          encounterId: null,
          loggedAt: new Date("2026-01-01T00:00:00.000Z"),
          drug: "Ketamine 100mg/ml",
          deaSchedule: "III",
          lotNumber: "LOT-2",
          strength: null,
          unit: "ML",
          amountDrawn: 3,
          amountAdministered: 3,
          amountWasted: 0,
          wastedWitness: null,
          balanceBefore: 4,
          balanceAfter: 1,
          administeredBy: null,
          notes: null,
          sourceEventId: "event-cs-1",
          inventoryBatchId: "batch-cs-2",
        });
      // 4 of batch-cs-1's 6 units are already back; batch-cs-2 has had nothing
      // returned.
      txCsFindMany
        .mockResolvedValueOnce([{ amountDrawn: -4 }])
        .mockResolvedValueOnce([]);
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-6",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 5,
            sourceLineKey: "line-1",
          },
        ],
      });

      // 2 back into the lot that still had 2 out, 3 into the lot that still had
      // 3 out - and nothing more, in either ledger.
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-cs-1" },
        data: { quantity: { increment: 2 } },
      });
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-cs-2" },
        data: { quantity: { increment: 3 } },
      });
      expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledTimes(
        2,
      );
      expect(txCsCreate).toHaveBeenCalledTimes(2);
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryBatchId: "batch-cs-1",
            amountDrawn: -2,
            balanceBefore: 8,
            balanceAfter: 10,
          }),
        }),
      );
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryBatchId: "batch-cs-2",
            amountDrawn: -3,
            balanceBefore: 1,
            balanceAfter: 4,
          }),
        }),
      );
    });

    // Legacy rows can show a batch with more put back than ever came out - that
    // over-crediting is the defect this PR closes, and the movements it already
    // wrote are still on file. Such a batch must contribute nothing, not lend
    // its phantom surplus to a lot that really does still have stock out.
    it("does not let an over-returned batch cancel out another batch's outstanding stock", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-legacy-release",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: 5,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        {
          id: "movement-cs-a",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -2,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "movement-cs-b",
          itemId: "item-cs-1",
          batchId: "batch-cs-2",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 5,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 5, allocated: 0, lotNumber: "LOT-1" },
        { id: "batch-cs-2", quantity: 3, allocated: 0, lotNumber: "LOT-2" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-b",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-2",
        strength: null,
        unit: "ML",
        amountDrawn: 3,
        amountAdministered: 3,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 8,
        balanceAfter: 5,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-2",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-7",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 3,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-cs-2" },
        data: { quantity: { increment: 3 } },
      });
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryBatchId: "batch-cs-2",
            amountDrawn: -3,
          }),
        }),
      );
    });

    // One lot drawn twice under one prescription is restored by two movements
    // but is still one lot. The register keys a reversal on (release event,
    // batch), so two rows for this batch would be two writes to the same unique
    // pair - the release would die on the index rather than record the 5 units
    // it actually put back.
    it("writes one register reversal per batch even when it restores across two movements", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-a1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "movement-cs-a2",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -3,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 9, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce({
        id: "event-cs-1",
      });
      txCsFindFirst.mockResolvedValueOnce({
        id: "cs-log-1",
        organisationId: "org-1",
        patientId: null,
        encounterId: null,
        loggedAt: new Date("2026-01-01T00:00:00.000Z"),
        drug: "Ketamine 100mg/ml",
        deaSchedule: "III",
        lotNumber: "LOT-1",
        strength: null,
        unit: "ML",
        amountDrawn: 6,
        amountAdministered: 6,
        amountWasted: 0,
        wastedWitness: null,
        balanceBefore: 10,
        balanceAfter: 4,
        administeredBy: null,
        notes: null,
        sourceEventId: "event-cs-1",
        inventoryBatchId: "batch-cs-1",
      });
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-8",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 5,
            sourceLineKey: "line-1",
          },
        ],
      });

      // Two stock movements, because that is what the batch rows record...
      expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledTimes(
        2,
      );
      // ...and one register row, for the 5 units the lot got back in total.
      expect(txCsCreate).toHaveBeenCalledTimes(1);
      expect(txCsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryBatchId: "batch-cs-1",
            amountDrawn: -5,
            balanceBefore: 4,
            balanceAfter: 9,
          }),
        }),
      );
    });

    it("writes nothing to the register when the release finds no dispense entry", async () => {
      mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
        {
          id: "movement-cs-1",
          itemId: "item-cs-1",
          batchId: "batch-cs-1",
          change: -6,
          reason: "PRESCRIPTION_DISPENSE",
          referenceId: "rx-cs-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockedPrisma.inventoryItem.findFirst.mockResolvedValue({
        ...controlledItem,
        onHand: 4,
      });
      mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: "batch-cs-1", quantity: 6, allocated: 0, lotNumber: "LOT-1" },
      ]);
      mockedPrisma.inventoryConsumptionEvent.findFirst.mockResolvedValueOnce(
        null,
      );
      mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
        id: "event-cs-release-3",
      });

      await InventoryConsumptionService.releasePrescription({
        organisationId: "org-1",
        prescriptionId: "rx-cs-1",
        medications: [
          {
            inventoryItemId: "item-cs-1",
            quantity: 6,
            sourceLineKey: "line-1",
          },
        ],
      });

      expect(txCsCreate).not.toHaveBeenCalled();
      // The stock still comes back - a missing ledger row must not strand it.
      expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { increment: 6 } } }),
      );
    });
  });
});
