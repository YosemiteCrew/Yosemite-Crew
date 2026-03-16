import type { LabOrderStatus } from "src/models/lab-order";

export const normalizeLabStatus = (
  status: unknown,
): { status: LabOrderStatus | null; externalStatus: string | null } => {
  const coerceStatus = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }
    return "";
  };

  if (status === undefined || status === null) {
    return { status: null, externalStatus: null };
  }

  const raw = coerceStatus(status).trim();
  if (!raw) return { status: null, externalStatus: null };

  const normalized = raw
    .toUpperCase()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/-+/g, "_");

  const known: LabOrderStatus[] = [
    "CREATED",
    "SUBMITTED",
    "AT_THE_LAB",
    "PARTIAL",
    "RUNNING",
    "COMPLETE",
    "CANCELLED",
    "ERROR",
  ];

  if (known.includes(normalized as LabOrderStatus)) {
    return {
      status: normalized as LabOrderStatus,
      externalStatus: raw,
    };
  }

  return { status: null, externalStatus: raw };
};
