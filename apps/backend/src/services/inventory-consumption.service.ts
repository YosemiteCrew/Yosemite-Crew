import { createHash } from "crypto";
import {
  InventoryConsumptionAction,
  InventoryConsumptionSourceType,
  PrescriptionDispenseRequestStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class InventoryConsumptionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "InventoryConsumptionServiceError";
  }
}

export type InventoryConsumptionLineInput = {
  sourceLineKey: string;
  inventoryItemId?: string;
  inventoryItemSku?: string;
  batchId?: string;
  quantity: number;
  metadata?: Prisma.InputJsonValue;
};

export type InventoryConsumptionRuleInput = {
  organisationId: string;
  sourceType: InventoryConsumptionSourceType;
  sourceKey: string;
  inventoryItemId: string;
  quantityMultiplier?: number;
  notes?: string | null;
  active?: boolean;
};

export type InventoryConsumptionRequest = {
  organisationId: string;
  sourceType: InventoryConsumptionSourceType;
  sourceId: string;
  action?: InventoryConsumptionAction;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
  lines: InventoryConsumptionLineInput[];
};

type AppointmentKindValue = "INPATIENT" | "OUTPATIENT";
type DispenseStockSource = "NORMAL" | "ALLOCATED";

type PrescriptionDispenseRequestContext = {
  appointmentId?: string | null;
  encounterId?: string | null;
};

type PrescriptionDispenseRequestMedication = Record<string, unknown> & {
  inventoryItemName?: string | null;
  frequency?: string | null;
  frequencyPerDay?: number | null;
  durationDays?: number | null;
  doseQty?: number | null;
  doseUnit?: string | null;
  refillsRemaining?: number | null;
  isRx?: boolean | null;
  isControlled?: boolean | null;
  stockUnitQty?: number | null;
  stockUnitType?: string | null;
  stockUnitQuantity?: number | null;
  packageQuantity?: number | null;
  unitQuantity?: number | null;
  priceCents?: number | null;
};

type PrescriptionDispenseRequestMetadata = Record<string, unknown> & {
  appointmentKind?: AppointmentKindValue;
  dispenseStockSource?: DispenseStockSource;
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const asPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integer = Math.trunc(value);
  return integer > 0 ? integer : undefined;
};

const asPositiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
};

const asPositiveFloat = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
};

const readPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const integer = Math.trunc(value);
    return integer > 0 ? integer : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        const integer = Math.trunc(parsed);
        return integer > 0 ? integer : undefined;
      }
    }
  }

  return undefined;
};

const readPositiveNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }
  }

  return undefined;
};

const readDoseParts = (
  value: unknown,
): {
  doseQty?: number;
  doseUnit?: string;
} => {
  if (typeof value !== "string") {
    return {};
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) {
    return { doseUnit: trimmed };
  }

  const doseQty = Number(match[1]);
  return {
    doseQty: Number.isFinite(doseQty) && doseQty > 0 ? doseQty : undefined,
    doseUnit: match[2].trim() || undefined,
  };
};

const resolveFrequencyPerDay = (frequency?: string | null) => {
  const normalized = frequency?.trim().toUpperCase();
  if (!normalized) return undefined;

  const directMap: Record<string, number> = {
    OD: 1,
    QD: 1,
    SID: 1,
    DAILY: 1,
    QDLY: 1,
    Q24H: 1,
    BID: 2,
    TID: 3,
    QID: 4,
    Q6H: 4,
    Q8H: 3,
    Q12H: 2,
  };
  if (directMap[normalized] !== undefined) {
    return directMap[normalized];
  }

  const everyNhours = normalized.match(/^Q(\d+)H$/);
  if (everyNhours) {
    const hours = Number(everyNhours[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return Math.max(1, Math.ceil(24 / hours));
    }
  }

  const timesPerDay = normalized.match(/^(\d+)\s*X(?:\s*DAILY)?$/);
  if (timesPerDay) {
    const count = Number(timesPerDay[1]);
    if (Number.isFinite(count) && count > 0) {
      return count;
    }
  }

  return undefined;
};

const resolvePriceCents = (item: {
  sellingPrice?: number | null;
  unitCost?: number | null;
}) => {
  const price = asPositiveFloat(item.sellingPrice ?? item.unitCost);
  if (price === undefined) return undefined;
  return Math.round(price * 100);
};

const resolvePackQuantity = (
  medication: Record<string, unknown>,
): number | undefined =>
  asPositiveNumber(
    medication.stockUnitQuantity ??
      medication.stockUnitQty ??
      medication.unitQuantity ??
      medication.packageQuantity,
  );

const toDispenseUnits = (quantity: number, packSize?: number) => {
  if (!packSize || packSize <= 1) {
    return quantity;
  }
  return Math.max(1, Math.ceil(quantity / packSize));
};

const resolveDispenseStockSource = (
  appointmentKind?: AppointmentKindValue,
): DispenseStockSource =>
  appointmentKind === "INPATIENT" ? "ALLOCATED" : "NORMAL";

const resolveDispenseStockSourceFromMetadata = (
  metadata?: unknown,
): DispenseStockSource | undefined => {
  const record = toRecord(metadata);
  const explicitSource = asNonEmptyString(record.dispenseStockSource);
  if (explicitSource === "ALLOCATED" || explicitSource === "NORMAL") {
    return explicitSource;
  }

  const appointmentKind = asNonEmptyString(record.appointmentKind);
  if (appointmentKind === "INPATIENT") {
    return "ALLOCATED";
  }
  if (appointmentKind === "OUTPATIENT") {
    return "NORMAL";
  }

  if (record.originalMetadata !== undefined) {
    return resolveDispenseStockSourceFromMetadata(record.originalMetadata);
  }

  return undefined;
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toTitleCase = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatPetAge = (dateOfBirth: unknown): string | undefined => {
  const birthDate =
    dateOfBirth instanceof Date
      ? dateOfBirth
      : typeof dateOfBirth === "string" && dateOfBirth.trim()
        ? new Date(dateOfBirth)
        : null;

  if (!birthDate || Number.isNaN(birthDate.getTime())) {
    return undefined;
  }

  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    return undefined;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}y ${remainingMonths}m`;
};

const resolvePetSpecies = (
  patient: Record<string, unknown>,
): string | undefined => {
  const species = asNonEmptyString(patient.type);
  if (species === "dog") return "Canine";
  if (species === "cat") return "Feline";
  if (species === "horse") return "Equine";
  if (species) return toTitleCase(species);
  return undefined;
};

const resolvePetSex = (
  patient: Record<string, unknown>,
): string | undefined => {
  const gender = asNonEmptyString(patient.gender)?.toLowerCase();
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  if (gender) return toTitleCase(gender);
  return undefined;
};

const resolvePetReproductiveStatus = (
  patient: Record<string, unknown>,
): string | undefined => {
  const isNeutered = patient.isNeutered;
  if (typeof isNeutered !== "boolean") return undefined;
  if (!isNeutered) return "Intact";

  const gender = asNonEmptyString(patient.gender)?.toLowerCase();
  if (gender === "female") return "Spayed";
  return "Neutered";
};

const resolvePetWeightUnit = (
  patient: Record<string, unknown>,
): string | undefined => {
  const unit = asNonEmptyString(
    patient.currentWeightUnit ?? patient.weightUnit ?? patient.unit,
  );
  if (unit) return unit;
  if (patient.currentWeight !== undefined && patient.currentWeight !== null) {
    return "kg";
  }
  return undefined;
};

const buildPetSnapshot = (patient: Record<string, unknown>) => {
  const snapshot: Record<string, unknown> = {};
  const petAge = formatPetAge(patient.dateOfBirth);
  const petSpecies = resolvePetSpecies(patient);
  const petSex = resolvePetSex(patient);
  const petReproductiveStatus = resolvePetReproductiveStatus(patient);
  const patientImageUrl =
    asNonEmptyString(patient.photoUrl) ?? asNonEmptyString(patient.imageUrl);
  const petWeight =
    typeof patient.currentWeight === "number" &&
    Number.isFinite(patient.currentWeight)
      ? patient.currentWeight
      : undefined;
  const petWeightUnit = resolvePetWeightUnit(patient);

  if (petAge) snapshot.petAge = petAge;
  if (petSpecies) snapshot.petSpecies = petSpecies;
  if (petSex) snapshot.petSex = petSex;
  if (petReproductiveStatus) {
    snapshot.petReproductiveStatus = petReproductiveStatus;
  }
  if (patientImageUrl) snapshot.patientImageUrl = patientImageUrl;
  if (petWeight !== undefined) snapshot.petWeight = petWeight;
  if (petWeightUnit) snapshot.petWeightUnit = petWeightUnit;

  return snapshot;
};

const loadPetSnapshot = async (
  db: Pick<typeof prisma, "appointment" | "encounter" | "patient">,
  params: {
    organisationId: string;
    context?: PrescriptionDispenseRequestContext;
  },
): Promise<{
  snapshot: Record<string, unknown>;
  appointmentKind?: AppointmentKindValue;
}> => {
  const appointmentId = asNonEmptyString(params.context?.appointmentId);
  if (appointmentId) {
    const appointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        organisationId: params.organisationId,
      },
      select: {
        patient: true,
        appointmentKind: true,
      },
    });

    if (appointment) {
      return {
        snapshot: buildPetSnapshot(toRecord(appointment.patient)),
        appointmentKind:
          appointment.appointmentKind === "INPATIENT"
            ? "INPATIENT"
            : "OUTPATIENT",
      };
    }
  }

  const encounterId = asNonEmptyString(params.context?.encounterId);
  if (!encounterId) {
    return { snapshot: {} };
  }

  const encounter = await db.encounter.findFirst({
    where: {
      id: encounterId,
      organisationId: params.organisationId,
    },
    select: {
      patientId: true,
    },
  });

  if (!encounter?.patientId) {
    return { snapshot: {} };
  }

  const patient = await db.patient.findFirst({
    where: {
      id: encounter.patientId,
    },
    select: {
      type: true,
      dateOfBirth: true,
      gender: true,
      currentWeight: true,
      isNeutered: true,
      photoUrl: true,
    },
  });

  return {
    snapshot: patient ? buildPetSnapshot(toRecord(patient)) : {},
  };
};

const enrichDispenseRequestMedications = async (
  db: Pick<typeof prisma, "inventoryItem">,
  params: {
    organisationId: string;
    medications: unknown;
  },
): Promise<unknown> => {
  if (!Array.isArray(params.medications)) {
    return params.medications;
  }

  const normalized = params.medications.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
  const ids = normalized
    .map((item) => asNonEmptyString(item.inventoryItemId))
    .filter((value): value is string => Boolean(value));
  const skus = normalized
    .map((item) => asNonEmptyString(item.inventoryItemSku))
    .filter((value): value is string => Boolean(value));

  if (!ids.length && !skus.length) {
    return params.medications;
  }

  const inventoryItems = await db.inventoryItem.findMany({
    where: {
      organisationId: params.organisationId,
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(skus.length ? [{ sku: { in: skus } }] : []),
      ],
    },
    select: {
      id: true,
      sku: true,
      name: true,
      stockUnitType: true,
      unitOfMeasure: true,
      packageQuantity: true,
      sellingPrice: true,
      unitCost: true,
      prescriptionRequired: true,
      controlledItem: true,
    },
  });

  const byId = new Map(inventoryItems.map((item) => [item.id, item]));
  const bySku = new Map(
    inventoryItems
      .map((item) => [asNonEmptyString(item.sku), item] as const)
      .filter(
        (entry): entry is readonly [string, (typeof inventoryItems)[number]] =>
          Boolean(entry[0]),
      ),
  );

  return normalized.map<PrescriptionDispenseRequestMedication>((item) => {
    const itemId = asNonEmptyString(item.inventoryItemId);
    const itemSku = asNonEmptyString(item.inventoryItemSku);
    const frequency = asNonEmptyString(item.frequency ?? item.freq);
    const doseParts = readDoseParts(item.dosage ?? item.dose);
    const durationDays =
      readPositiveInteger(item.durationDays) ??
      readPositiveInteger(item.duration ?? item.days);
    const refillsRemaining =
      readPositiveInteger(item.refillsRemaining) ??
      readPositiveInteger(item.refill);
    const doseQty = readPositiveNumber(item.doseQty) ?? doseParts.doseQty;
    const inventoryItem =
      (itemId ? byId.get(itemId) : undefined) ??
      (itemSku ? bySku.get(itemSku) : undefined);
    const stockUnitQty =
      readPositiveInteger(item.stockUnitQty ?? item.stockUnitQuantity) ??
      inventoryItem?.packageQuantity ??
      null;
    const frequencyPerDay =
      readPositiveInteger(item.frequencyPerDay) ??
      resolveFrequencyPerDay(frequency);
    const baseQuantity =
      readPositiveInteger(
        item.quantity ?? item.units ?? item.count ?? item.dispenseQuantity,
      ) ??
      (doseQty !== undefined &&
      frequencyPerDay !== undefined &&
      durationDays !== undefined
        ? Math.max(1, Math.ceil(doseQty * frequencyPerDay * durationDays))
        : undefined);

    return {
      ...item,
      inventoryItemName:
        inventoryItem?.name ??
        asNonEmptyString(item.inventoryItemName) ??
        asNonEmptyString(item.medication) ??
        null,
      frequency,
      frequencyPerDay,
      durationDays,
      doseQty,
      doseUnit:
        asNonEmptyString(item.doseUnit) ?? doseParts.doseUnit ?? undefined,
      refillsRemaining,
      isRx:
        typeof item.isRx === "boolean"
          ? item.isRx
          : (inventoryItem?.prescriptionRequired ?? true),
      isControlled:
        typeof item.isControlled === "boolean"
          ? item.isControlled
          : (inventoryItem?.controlledItem ?? null),
      stockUnitType: inventoryItem?.stockUnitType ?? null,
      packageQuantity: stockUnitQty,
      unitQuantity: stockUnitQty,
      stockUnitQty,
      stockUnitQuantity: stockUnitQty,
      quantity: baseQuantity ?? item.quantity ?? undefined,
      priceCents:
        readPositiveInteger(item.priceCents) ??
        resolvePriceCents(inventoryItem ?? {}),
    };
  });
};

const buildIdempotencyKey = (request: InventoryConsumptionRequest) =>
  request.idempotencyKey ??
  createHash("sha256")
    .update(
      JSON.stringify({
        organisationId: request.organisationId,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        action: request.action ?? "CONSUME",
        lines: request.lines.map((line) => ({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId: line.inventoryItemId ?? null,
          inventoryItemSku: line.inventoryItemSku ?? null,
          quantity: line.quantity,
        })),
      }),
    )
    .digest("hex");

const ensureQuantity = (quantity: number) => {
  const safe = asPositiveInteger(quantity);
  if (!safe) {
    throw new InventoryConsumptionServiceError(
      "quantity must be a positive integer",
      400,
    );
  }
  return safe;
};

const createInventoryConsumptionSkippedEvent = (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    action: InventoryConsumptionAction;
    idempotencyKey: string;
    inventoryItemId: string;
    quantity: number;
    metadata?: Prisma.InputJsonValue;
  },
) =>
  createInventoryConsumptionEvent(tx, {
    ...params,
    status: "SKIPPED",
  });

const createInventoryConsumptionAppliedEvent = (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    action: InventoryConsumptionAction;
    idempotencyKey: string;
    inventoryItemId: string;
    quantity: number;
    metadata?: Prisma.InputJsonValue;
  },
) =>
  createInventoryConsumptionEvent(tx, {
    ...params,
    status: "APPLIED",
  });

const applyInventoryRelease = async (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    inventoryItemId: string;
    quantity: number;
    metadata?: Prisma.InputJsonValue;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    idempotencyKey: string;
    batchId?: string;
    movementReason?: string;
    stockSource?: DispenseStockSource;
  },
) => {
  const item = await tx.inventoryItem.findFirst({
    where: {
      id: params.inventoryItemId,
      organisationId: params.organisationId,
    },
  });
  if (!item) {
    throw new InventoryConsumptionServiceError("Inventory item not found", 404);
  }

  const movements = await tx.inventoryStockMovement.findMany({
    where: {
      itemId: params.inventoryItemId,
      referenceId: params.sourceId,
      change: { lt: 0 },
      ...(params.batchId ? { batchId: params.batchId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!movements.length) {
    throw new InventoryConsumptionServiceError(
      "No prior consumption found to release",
      400,
    );
  }

  let remainingRelease = params.quantity;
  for (const movement of movements) {
    if (remainingRelease <= 0) break;

    const consumedQuantity = Math.abs(movement.change ?? 0);
    if (consumedQuantity <= 0) continue;

    const restore = Math.min(remainingRelease, consumedQuantity);
    remainingRelease -= restore;

    if (movement.batchId) {
      await tx.inventoryBatch.update({
        where: { id: movement.batchId },
        data: { quantity: { increment: restore } },
      });
    }

    await tx.inventoryStockMovement.create({
      data: {
        itemId: params.inventoryItemId,
        batchId: movement.batchId ?? undefined,
        change: restore,
        reason: params.movementReason ?? "PRESCRIPTION_RELEASE",
        referenceId: params.sourceId,
      },
    });
  }

  if (remainingRelease > 0) {
    throw new InventoryConsumptionServiceError(
      "Failed to release full requested quantity",
      500,
    );
  }

  const onHand = await updateInventoryItemOnHand(
    tx,
    params.organisationId,
    params.inventoryItemId,
  );
  const allocated =
    params.stockSource === "ALLOCATED"
      ? Math.max(0, (item.allocated ?? 0) + params.quantity)
      : (item.allocated ?? 0);
  await tx.inventoryItem.update({
    where: { id: params.inventoryItemId },
    data:
      params.stockSource === "ALLOCATED" ? { onHand, allocated } : { onHand },
  });

  return createInventoryConsumptionAppliedEvent(tx, {
    organisationId: params.organisationId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceLineKey: params.sourceLineKey,
    action: "RELEASE",
    idempotencyKey: params.idempotencyKey,
    inventoryItemId: params.inventoryItemId,
    quantity: params.quantity,
    metadata: params.metadata,
  });
};

const applyInventoryConsumption = async (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    inventoryItemId: string;
    quantity: number;
    metadata?: Prisma.InputJsonValue;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    idempotencyKey: string;
    batchId?: string;
    movementReason?: string;
    stockSource?: DispenseStockSource;
  },
) => {
  const item = await tx.inventoryItem.findFirst({
    where: {
      id: params.inventoryItemId,
      organisationId: params.organisationId,
    },
  });
  if (!item) {
    throw new InventoryConsumptionServiceError("Inventory item not found", 404);
  }
  if ((item.onHand ?? 0) < params.quantity) {
    throw new InventoryConsumptionServiceError("Insufficient stock", 400);
  }

  let remaining = params.quantity;
  const batches = await tx.inventoryBatch.findMany({
    where: {
      itemId: params.inventoryItemId,
      organisationId: params.organisationId,
      ...(params.batchId ? { id: params.batchId } : {}),
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  for (const batch of batches) {
    if (remaining <= 0) break;

    const available = batch.quantity ?? 0;
    if (available <= 0) continue;

    const consume = Math.min(available, remaining);
    remaining -= consume;

    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: available - consume },
    });

    await tx.inventoryStockMovement.create({
      data: {
        itemId: params.inventoryItemId,
        batchId: batch.id,
        change: -consume,
        reason: params.movementReason ?? "MANUAL_ADJUSTMENT",
        referenceId: params.sourceId,
      },
    });
  }

  if (remaining > 0) {
    throw new InventoryConsumptionServiceError(
      "Failed to consume full requested quantity",
      500,
    );
  }

  const onHand = await updateInventoryItemOnHand(
    tx,
    params.organisationId,
    params.inventoryItemId,
  );
  const allocated =
    params.stockSource === "ALLOCATED"
      ? Math.max(0, (item.allocated ?? 0) - params.quantity)
      : (item.allocated ?? 0);
  await tx.inventoryItem.update({
    where: { id: params.inventoryItemId },
    data:
      params.stockSource === "ALLOCATED" ? { onHand, allocated } : { onHand },
  });

  return createInventoryConsumptionAppliedEvent(tx, {
    organisationId: params.organisationId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceLineKey: params.sourceLineKey,
    action: "CONSUME",
    idempotencyKey: params.idempotencyKey,
    inventoryItemId: params.inventoryItemId,
    quantity: params.quantity,
    metadata: params.metadata,
  });
};

const consumeInventoryItem = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  inventoryItemId: string,
  quantity: number,
  metadata: Prisma.InputJsonValue | undefined,
  sourceType: InventoryConsumptionSourceType,
  sourceId: string,
  sourceLineKey: string,
  action: InventoryConsumptionAction,
  idempotencyKey: string,
  batchId?: string,
  movementReason?: string,
  stockSource?: DispenseStockSource,
) => {
  const existingEvent = await tx.inventoryConsumptionEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existingEvent) {
    return existingEvent;
  }

  if (action === "RESERVE") {
    return createInventoryConsumptionAppliedEvent(tx, {
      organisationId,
      sourceType,
      sourceId,
      sourceLineKey,
      action,
      idempotencyKey,
      inventoryItemId,
      quantity,
      metadata,
    });
  }

  if (action === "RELEASE") {
    return applyInventoryRelease(tx, {
      organisationId,
      sourceType,
      sourceId,
      sourceLineKey,
      idempotencyKey,
      inventoryItemId,
      quantity,
      metadata,
      batchId,
      movementReason,
      stockSource,
    });
  }

  if (action !== "CONSUME") {
    return createInventoryConsumptionSkippedEvent(tx, {
      organisationId,
      sourceType,
      sourceId,
      sourceLineKey,
      action,
      idempotencyKey,
      inventoryItemId,
      quantity,
      metadata,
    });
  }

  return applyInventoryConsumption(tx, {
    organisationId,
    sourceType,
    sourceId,
    sourceLineKey,
    idempotencyKey,
    inventoryItemId,
    quantity,
    metadata,
    batchId,
    movementReason,
    stockSource,
  });
};

const resolveInventoryItemFromRule = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  sourceType: InventoryConsumptionSourceType,
  sourceKey: string,
) => {
  const rule = await tx.inventoryConsumptionRule.findFirst({
    where: {
      organisationId,
      sourceType,
      sourceKey,
      active: true,
    },
  });

  return rule ?? null;
};

const resolveInventoryItemIdBySku = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  sku: string,
) => {
  const item = await tx.inventoryItem.findFirst({
    where: { organisationId, sku },
    select: { id: true },
  });
  return item?.id ?? null;
};

const resolveInventoryItemIdByBatch = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  batchSelector: {
    batchId?: string | null;
    batchNumber?: string | null;
    lotNumber?: string | null;
    expiryDate?: string | Date | null;
  },
) => {
  const batchId = asNonEmptyString(batchSelector.batchId);
  const batchNumber = asNonEmptyString(batchSelector.batchNumber);
  const lotNumber = asNonEmptyString(batchSelector.lotNumber);
  const expiryDate =
    batchSelector.expiryDate instanceof Date
      ? batchSelector.expiryDate
      : typeof batchSelector.expiryDate === "string" &&
          batchSelector.expiryDate.trim()
        ? new Date(batchSelector.expiryDate)
        : undefined;

  if (!batchId && !batchNumber && !lotNumber && !expiryDate) {
    return null;
  }

  const batch = await tx.inventoryBatch.findFirst({
    where: {
      organisationId,
      ...(batchId
        ? { id: batchId }
        : batchNumber
          ? { batchNumber }
          : lotNumber
            ? { lotNumber }
            : {}),
      ...(expiryDate && !Number.isNaN(expiryDate.getTime())
        ? { expiryDate }
        : {}),
    },
    select: { id: true, itemId: true },
  });

  return batch ?? null;
};

const updateInventoryItemOnHand = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  inventoryItemId: string,
) => {
  const batchesAfter = await tx.inventoryBatch.findMany({
    where: { itemId: inventoryItemId, organisationId },
  });
  const onHand = batchesAfter.reduce(
    (sum, batch) => sum + (batch.quantity ?? 0),
    0,
  );

  await tx.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { onHand },
  });

  return onHand;
};

const createInventoryConsumptionEvent = (
  tx: Prisma.TransactionClient,
  data: {
    organisationId: string;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    action: InventoryConsumptionAction;
    idempotencyKey: string;
    inventoryItemId: string;
    quantity: number;
    status: "APPLIED" | "SKIPPED";
    metadata?: Prisma.InputJsonValue;
  },
) =>
  tx.inventoryConsumptionEvent.create({
    data,
  });

const consumeResolvedLines = async (
  tx: Prisma.TransactionClient,
  request: InventoryConsumptionRequest,
  resolvedLines: InventoryConsumptionLineInput[],
  options?: { movementReason?: string; stockSource?: DispenseStockSource },
) => {
  const organisationId = asNonEmptyString(request.organisationId);
  const sourceId = asNonEmptyString(request.sourceId);
  if (!organisationId || !sourceId) {
    throw new InventoryConsumptionServiceError(
      "organisationId and sourceId are required",
      400,
    );
  }
  if (!resolvedLines.length) return [];

  const action = request.action ?? "CONSUME";
  const idempotencyBase = buildIdempotencyKey({
    ...request,
    organisationId,
    sourceId,
    action,
  });

  const events = [];
  for (const line of resolvedLines) {
    const quantity = ensureQuantity(line.quantity);
    const inventoryItemId = asNonEmptyString(line.inventoryItemId);
    if (!inventoryItemId) {
      throw new InventoryConsumptionServiceError(
        `Unable to resolve inventory item for ${line.sourceLineKey}.`,
        400,
      );
    }
    const event = await consumeInventoryItem(
      tx,
      organisationId,
      inventoryItemId,
      quantity,
      line.metadata ?? request.metadata,
      request.sourceType,
      sourceId,
      line.sourceLineKey,
      action,
      `${idempotencyBase}:${line.sourceLineKey}:${inventoryItemId}`,
      line.batchId,
      options?.movementReason,
      options?.stockSource,
    );
    events.push(event);
  }
  return events;
};

const normalizePrescriptionLines = (medications: unknown) => {
  if (!Array.isArray(medications)) return [];

  return medications.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const quantity = asPositiveInteger(
      record.quantity ??
        record.units ??
        record.count ??
        record.dispenseQuantity,
    );
    if (!quantity) return [];
    const stockUnitQuantity = resolvePackQuantity(record);

    const sourceLineKey =
      asNonEmptyString(record.sourceLineKey) ??
      asNonEmptyString(record.id) ??
      asNonEmptyString(record.medicationCode) ??
      asNonEmptyString(record.drugCode) ??
      asNonEmptyString(record.code) ??
      asNonEmptyString(record.name) ??
      `line-${index}`;

    return [
      {
        sourceLineKey,
        quantity,
        inventoryItemId: asNonEmptyString(record.inventoryItemId),
        inventoryItemSku:
          asNonEmptyString(record.inventoryItemSku) ??
          asNonEmptyString(record.sku),
        batchId: asNonEmptyString(record.batchId),
        batchNumber: asNonEmptyString(record.batchNumber),
        lotNumber: asNonEmptyString(record.lotNumber),
        expiryDate:
          typeof record.expiryDate === "string" ||
          record.expiryDate instanceof Date
            ? record.expiryDate
            : undefined,
        stockUnitQuantity,
        ruleKeys: [
          asNonEmptyString(record.inventoryItemCode),
          asNonEmptyString(record.medicationCode),
          asNonEmptyString(record.drugCode),
          asNonEmptyString(record.code),
          asNonEmptyString(record.name),
        ].filter((value): value is string => Boolean(value)),
        metadata: record.metadata as Prisma.InputJsonValue | undefined,
      },
    ];
  });
};

const resolvePrescriptionLines = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  medications: unknown,
) => {
  const prescriptionLines = normalizePrescriptionLines(medications);
  const resolved: InventoryConsumptionLineInput[] = [];

  for (const line of prescriptionLines) {
    const batchMatch = await resolveInventoryItemIdByBatch(tx, organisationId, {
      batchId: line.batchId,
      batchNumber: line.batchNumber,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
    });
    const inventoryQuantity = toDispenseUnits(
      line.quantity,
      line.stockUnitQuantity,
    );

    if (line.inventoryItemId) {
      resolved.push({
        sourceLineKey: line.sourceLineKey,
        inventoryItemId: line.inventoryItemId,
        quantity: inventoryQuantity,
        metadata: line.metadata,
        batchId: batchMatch?.id ?? line.batchId ?? undefined,
      });
      continue;
    }

    if (line.inventoryItemSku) {
      const inventoryItemId = await resolveInventoryItemIdBySku(
        tx,
        organisationId,
        line.inventoryItemSku,
      );
      if (inventoryItemId) {
        resolved.push({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId,
          quantity: inventoryQuantity,
          metadata: line.metadata,
          batchId: batchMatch?.id ?? line.batchId ?? undefined,
        });
        continue;
      }
    }

    if (batchMatch?.itemId) {
      resolved.push({
        sourceLineKey: line.sourceLineKey,
        inventoryItemId: batchMatch.itemId,
        quantity: inventoryQuantity,
        metadata: line.metadata,
        batchId: batchMatch.id,
      });
      continue;
    }

    for (const ruleKey of line.ruleKeys) {
      const rule = await resolveInventoryItemFromRule(
        tx,
        organisationId,
        "PRESCRIPTION",
        normalizeKey(ruleKey),
      );
      if (rule) {
        resolved.push({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId: rule.inventoryItemId,
          quantity: toDispenseUnits(
            Math.max(1, Math.round(line.quantity * rule.quantityMultiplier)),
            line.stockUnitQuantity,
          ),
          metadata: line.metadata,
          batchId: batchMatch?.id ?? line.batchId ?? undefined,
        });
        break;
      }
    }
  }

  return resolved;
};

const runPrescriptionInventoryAction = async (params: {
  organisationId: string;
  prescriptionId: string;
  medications: unknown;
  metadata?: Prisma.InputJsonValue;
  action: InventoryConsumptionAction;
  movementReason?: string;
}) => {
  const organisationId = asNonEmptyString(params.organisationId);
  const prescriptionId = asNonEmptyString(params.prescriptionId);
  if (!organisationId || !prescriptionId) {
    throw new InventoryConsumptionServiceError(
      "organisationId and prescriptionId are required",
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const stockSource = resolveDispenseStockSourceFromMetadata(params.metadata);
    return consumePrescriptionMedications(tx, {
      organisationId,
      prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: params.action,
      movementReason: params.movementReason,
      stockSource,
    });
  });
};

const consumePrescriptionMedications = async (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
    action: InventoryConsumptionAction;
    movementReason?: string;
    stockSource?: DispenseStockSource;
  },
) => {
  const lines = await resolvePrescriptionLines(
    tx,
    params.organisationId,
    params.medications,
  );
  if (!lines.length) return [];

  return consumeResolvedLines(
    tx,
    {
      organisationId: params.organisationId,
      sourceType: "PRESCRIPTION",
      sourceId: params.prescriptionId,
      action: params.action,
      metadata: params.metadata,
      lines,
    },
    lines,
    {
      movementReason: params.movementReason,
      stockSource: params.stockSource,
    },
  );
};

const upsertPendingDispenseRequest = async (
  tx: Prisma.TransactionClient,
  params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
    requestedBy?: string | null;
  },
) => {
  const existing = await tx.prescriptionDispenseRequest.findFirst({
    where: {
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      status: "PENDING",
    },
    orderBy: { requestedAt: "desc" },
  });

  if (existing) {
    return tx.prescriptionDispenseRequest.update({
      where: { id: existing.id },
      data: {
        medications: params.medications as Prisma.InputJsonValue,
        metadata: params.metadata,
        requestedBy: params.requestedBy ?? existing.requestedBy ?? undefined,
        reviewedBy: null,
        reviewedAt: null,
        status: "PENDING",
      },
    });
  }

  return tx.prescriptionDispenseRequest.create({
    data: {
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications as Prisma.InputJsonValue,
      metadata: params.metadata,
      requestedBy: params.requestedBy ?? undefined,
      status: "PENDING",
    },
  });
};

const buildPrescriptionDispenseRequestInclude = () =>
  ({
    prescription: {
      include: {
        artifact: true,
      },
    },
  }) as const;

export const InventoryConsumptionService = {
  async upsertRule(input: InventoryConsumptionRuleInput) {
    const organisationId = asNonEmptyString(input.organisationId);
    const sourceKey = asNonEmptyString(input.sourceKey);
    const inventoryItemId = asNonEmptyString(input.inventoryItemId);
    if (!organisationId || !sourceKey || !inventoryItemId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, sourceKey, and inventoryItemId are required",
        400,
      );
    }

    return prisma.inventoryConsumptionRule.upsert({
      where: {
        organisationId_sourceType_sourceKey_inventoryItemId: {
          organisationId,
          sourceType: input.sourceType,
          sourceKey: normalizeKey(sourceKey),
          inventoryItemId,
        },
      },
      create: {
        organisationId,
        sourceType: input.sourceType,
        sourceKey: normalizeKey(sourceKey),
        inventoryItemId,
        quantityMultiplier: input.quantityMultiplier ?? 1,
        notes: input.notes ?? undefined,
        active: input.active ?? true,
      },
      update: {
        quantityMultiplier: input.quantityMultiplier ?? 1,
        notes: input.notes ?? undefined,
        active: input.active ?? true,
      },
    });
  },

  async listRules(organisationId: string) {
    const safeOrganisationId = asNonEmptyString(organisationId);
    if (!safeOrganisationId) {
      throw new InventoryConsumptionServiceError(
        "organisationId is required",
        400,
      );
    }

    return prisma.inventoryConsumptionRule.findMany({
      where: { organisationId: safeOrganisationId },
      orderBy: [{ sourceType: "asc" }, { sourceKey: "asc" }],
    });
  },

  async listPrescriptionDispenseRequests(params: {
    organisationId: string;
    status?: PrescriptionDispenseRequestStatus;
    prescriptionId?: string;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new InventoryConsumptionServiceError(
        "organisationId is required",
        400,
      );
    }

    return prisma.prescriptionDispenseRequest.findMany({
      where: {
        organisationId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.prescriptionId
          ? { prescriptionId: params.prescriptionId }
          : {}),
      },
      include: buildPrescriptionDispenseRequestInclude(),
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
    });
  },

  async getPrescriptionDispenseRequest(params: {
    organisationId: string;
    dispenseRequestId: string;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const dispenseRequestId = asNonEmptyString(params.dispenseRequestId);
    if (!organisationId || !dispenseRequestId) {
      throw new InventoryConsumptionServiceError(
        "organisationId and dispenseRequestId are required",
        400,
      );
    }

    const request = await prisma.prescriptionDispenseRequest.findFirst({
      where: {
        id: dispenseRequestId,
        organisationId,
      },
      include: buildPrescriptionDispenseRequestInclude(),
    });

    if (!request) {
      throw new InventoryConsumptionServiceError(
        "Dispense request not found",
        404,
      );
    }

    return request;
  },

  async createPrescriptionDispenseRequest(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
    requestedBy?: string | null;
    context?: PrescriptionDispenseRequestContext;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const prescriptionId = asNonEmptyString(params.prescriptionId);
    if (!organisationId || !prescriptionId) {
      throw new InventoryConsumptionServiceError(
        "organisationId and prescriptionId are required",
        400,
      );
    }

    const [petContext, medications] = await Promise.all([
      loadPetSnapshot(prisma, {
        organisationId,
        context: params.context,
      }),
      enrichDispenseRequestMedications(prisma, {
        organisationId,
        medications: params.medications,
      }),
    ]);

    const appointmentKind = petContext.appointmentKind ?? "OUTPATIENT";
    const dispenseStockSource = resolveDispenseStockSource(appointmentKind);

    const metadataBase = {
      ...toRecord(params.metadata),
      ...petContext.snapshot,
      appointmentKind,
      dispenseStockSource,
    } satisfies PrescriptionDispenseRequestMetadata;

    const metadata = Object.keys(metadataBase).length
      ? (metadataBase as Prisma.InputJsonValue)
      : params.metadata;

    return prisma.$transaction((tx) =>
      upsertPendingDispenseRequest(tx, {
        organisationId,
        prescriptionId,
        medications,
        metadata,
        requestedBy: params.requestedBy,
      }),
    );
  },

  async approvePrescriptionDispenseRequest(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
    reviewedBy?: string | null;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const prescriptionId = asNonEmptyString(params.prescriptionId);
    if (!organisationId || !prescriptionId) {
      throw new InventoryConsumptionServiceError(
        "organisationId and prescriptionId are required",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      const request = await tx.prescriptionDispenseRequest.findFirst({
        where: {
          organisationId,
          prescriptionId,
          status: "PENDING",
        },
        orderBy: { requestedAt: "desc" },
      });

      if (!request) {
        throw new InventoryConsumptionServiceError(
          "Dispense request not found",
          404,
        );
      }

      const medications = request.medications ?? params.medications;
      const metadata = request.metadata ?? params.metadata;
      const stockSource =
        resolveDispenseStockSourceFromMetadata(metadata) ?? "NORMAL";

      const inventoryEvents = await consumePrescriptionMedications(tx, {
        organisationId,
        prescriptionId,
        medications,
        metadata,
        action: "CONSUME",
        movementReason: "PRESCRIPTION_DISPENSE",
        stockSource,
      });

      await tx.prescriptionDispenseRequest.update({
        where: { id: request.id },
        data: {
          status: "DISPENSED",
          reviewedBy: params.reviewedBy ?? undefined,
          reviewedAt: new Date(),
        },
      });

      return inventoryEvents;
    });
  },

  async markPrescriptionDispenseRequestNotDispensed(params: {
    organisationId: string;
    prescriptionId: string;
    metadata?: Prisma.InputJsonValue;
    reviewedBy?: string | null;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const prescriptionId = asNonEmptyString(params.prescriptionId);
    if (!organisationId || !prescriptionId) {
      throw new InventoryConsumptionServiceError(
        "organisationId and prescriptionId are required",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      const request = await tx.prescriptionDispenseRequest.findFirst({
        where: {
          organisationId,
          prescriptionId,
          status: "PENDING",
        },
        orderBy: { requestedAt: "desc" },
      });

      if (!request) {
        return null;
      }

      return tx.prescriptionDispenseRequest.update({
        where: { id: request.id },
        data: {
          status: "NOT_DISPENSED",
          metadata: params.metadata,
          reviewedBy: params.reviewedBy ?? undefined,
          reviewedAt: new Date(),
        },
      });
    });
  },

  async consume(request: InventoryConsumptionRequest) {
    if (!Array.isArray(request.lines) || request.lines.length === 0) {
      return [];
    }

    return prisma.$transaction(async (tx) => {
      const organisationId = asNonEmptyString(request.organisationId);
      const sourceId = asNonEmptyString(request.sourceId);
      if (!organisationId || !sourceId) {
        throw new InventoryConsumptionServiceError(
          "organisationId and sourceId are required",
          400,
        );
      }

      const action = request.action ?? "CONSUME";
      const stockSource = resolveDispenseStockSourceFromMetadata(
        request.metadata,
      );
      const idempotencyBase = buildIdempotencyKey({
        ...request,
        organisationId,
        sourceId,
        action,
      });

      const events = [];
      for (const line of request.lines) {
        const quantity = ensureQuantity(line.quantity);
        const inventoryItemId = asNonEmptyString(line.inventoryItemId);
        const inventoryItemSku = asNonEmptyString(line.inventoryItemSku);
        let resolvedInventoryItemId = inventoryItemId ?? null;

        if (!resolvedInventoryItemId && inventoryItemSku) {
          resolvedInventoryItemId = await resolveInventoryItemIdBySku(
            tx,
            organisationId,
            inventoryItemSku,
          );
        }

        if (!resolvedInventoryItemId) {
          throw new InventoryConsumptionServiceError(
            `Unable to resolve inventory item for ${line.sourceLineKey}.`,
            400,
          );
        }

        const event = await consumeInventoryItem(
          tx,
          organisationId,
          resolvedInventoryItemId,
          quantity,
          line.metadata ?? request.metadata,
          request.sourceType,
          sourceId,
          line.sourceLineKey,
          action,
          `${idempotencyBase}:${line.sourceLineKey}:${resolvedInventoryItemId}`,
          line.batchId,
          undefined,
          stockSource,
        );
        events.push(event);
      }
      return events;
    });
  },

  async consumePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "CONSUME",
      movementReason: "PRESCRIPTION_DISPENSE",
    });
  },

  async reservePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RESERVE",
    });
  },

  async releasePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_RELEASE",
    });
  },

  async returnPrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_RETURN",
    });
  },

  async voidDispensePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: {
        voided: true,
        originalMetadata: params.metadata ?? null,
      } as Prisma.InputJsonValue,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_VOID_DISPENSE",
    });
  },

  async consumePackageProduct(params: {
    organisationId: string;
    packageProductItemId: string;
    sourceId: string;
    quantity?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const packageProductItemId = asNonEmptyString(params.packageProductItemId);
    const sourceId = asNonEmptyString(params.sourceId);
    if (!organisationId || !packageProductItemId || !sourceId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, packageProductItemId and sourceId are required",
        400,
      );
    }

    const quantity = ensureQuantity(params.quantity ?? 1);
    const product = await prisma.productItem.findFirst({
      where: {
        id: packageProductItemId,
        organisationId,
        kind: "PACKAGE",
      },
      include: {
        package: {
          include: {
            items: {
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });
    if (!product || !product.package) {
      throw new InventoryConsumptionServiceError(
        "Package product not found",
        404,
      );
    }

    const lines: InventoryConsumptionLineInput[] = [];
    for (const item of product.package.items) {
      const rule = await resolveInventoryItemFromRule(
        prisma,
        organisationId,
        "PACKAGE",
        item.childProductItemId,
      );
      if (!rule) {
        throw new InventoryConsumptionServiceError(
          `Missing inventory mapping for package component ${item.childProductItemId}.`,
          400,
        );
      }
      lines.push({
        sourceLineKey: item.childProductItemId,
        inventoryItemId: rule.inventoryItemId,
        quantity: Math.max(
          1,
          Math.round(quantity * item.quantity * rule.quantityMultiplier),
        ),
      });
    }

    return this.consume({
      organisationId,
      sourceType: "PACKAGE",
      sourceId,
      action: "CONSUME",
      metadata: params.metadata,
      lines,
    });
  },

  async consumeProcedureProduct(params: {
    organisationId: string;
    procedureProductItemId: string;
    sourceId: string;
    quantity?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const procedureProductItemId = asNonEmptyString(
      params.procedureProductItemId,
    );
    const sourceId = asNonEmptyString(params.sourceId);
    if (!organisationId || !procedureProductItemId || !sourceId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, procedureProductItemId and sourceId are required",
        400,
      );
    }

    const quantity = ensureQuantity(params.quantity ?? 1);
    const ruleRows = await prisma.inventoryConsumptionRule.findMany({
      where: {
        organisationId,
        sourceType: "PROCEDURE",
        sourceKey: normalizeKey(procedureProductItemId),
        active: true,
      },
    });

    if (!ruleRows.length) {
      throw new InventoryConsumptionServiceError(
        `Missing inventory mapping for procedure ${procedureProductItemId}.`,
        400,
      );
    }

    const lines = ruleRows.map<InventoryConsumptionLineInput>((rule) => ({
      sourceLineKey: procedureProductItemId,
      inventoryItemId: rule.inventoryItemId,
      quantity: Math.max(1, Math.round(quantity * rule.quantityMultiplier)),
    }));

    return this.consume({
      organisationId,
      sourceType: "PROCEDURE",
      sourceId,
      action: "CONSUME",
      metadata: params.metadata,
      lines,
    });
  },
};
