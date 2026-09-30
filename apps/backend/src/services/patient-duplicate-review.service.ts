import { prisma } from "src/config/prisma";

const MAX_MATCHES = 200;

type PatientRecord = {
  id: string;
  name: string;
  type: string;
  speciesCode: string | null;
  dateOfBirth: Date;
  microchipNumber: string | null;
};

type PatientSummary = Pick<PatientRecord, "id" | "name" | "dateOfBirth">;

export type PatientDuplicateCandidate = {
  patientA: PatientSummary;
  patientB: PatientSummary;
  matchingOn: "microchip" | "name-and-birth-date";
};

export class PatientDuplicateReviewError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientDuplicateReviewError";
  }
}

const normaliseName = (name: string): string =>
  name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

const normaliseMicrochip = (value: string | null): string =>
  value?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ?? "";

const pairKey = (patientAId: string, patientBId: string): string =>
  [patientAId, patientBId]
    .sort((left, right) => left.localeCompare(right))
    .join(":");

const summary = (patient: PatientRecord): PatientSummary => ({
  id: patient.id,
  name: patient.name,
  dateOfBirth: patient.dateOfBirth,
});

const matchingKeys = (
  patient: PatientRecord,
): Array<{
  key: string;
  matchingOn: PatientDuplicateCandidate["matchingOn"];
}> => {
  const microchip = normaliseMicrochip(patient.microchipNumber);
  const keys: Array<{
    key: string;
    matchingOn: PatientDuplicateCandidate["matchingOn"];
  }> = microchip
    ? [{ key: `microchip:${microchip}`, matchingOn: "microchip" as const }]
    : [];
  const name = normaliseName(patient.name);
  if (name) {
    keys.push({
      key: [
        "identity",
        patient.type,
        patient.speciesCode ?? "",
        patient.dateOfBirth.toISOString().slice(0, 10),
        name,
      ].join(":"),
      matchingOn: "name-and-birth-date",
    });
  }
  return keys;
};

const groupPatients = (patients: PatientRecord[]) => {
  const groups = new Map<string, PatientRecord[]>();
  for (const patient of patients) {
    for (const { key } of matchingKeys(patient)) {
      const group = groups.get(key);
      if (group) group.push(patient);
      else groups.set(key, [patient]);
    }
  }
  return groups;
};

const addGroupCandidates = (
  group: PatientRecord[],
  matchingOn: PatientDuplicateCandidate["matchingOn"],
  dismissed: Set<string>,
  candidates: Map<string, PatientDuplicateCandidate>,
): boolean => {
  for (let first = 0; first < group.length - 1; first += 1) {
    for (let second = first + 1; second < group.length; second += 1) {
      const left = group[first];
      const right = group[second];
      const keyForPair = pairKey(left.id, right.id);
      if (dismissed.has(keyForPair) || candidates.has(keyForPair)) continue;
      const [patientA, patientB] =
        left.id.localeCompare(right.id) < 0 ? [left, right] : [right, left];
      candidates.set(keyForPair, {
        patientA: summary(patientA),
        patientB: summary(patientB),
        matchingOn,
      });
      if (candidates.size === MAX_MATCHES) return true;
    }
  }
  return false;
};

const findCandidates = (
  patients: PatientRecord[],
  dismissed: Set<string>,
): PatientDuplicateCandidate[] => {
  const candidates = new Map<string, PatientDuplicateCandidate>();
  for (const [key, group] of groupPatients(patients)) {
    const matchingOn = key.startsWith("microchip:")
      ? "microchip"
      : "name-and-birth-date";
    if (addGroupCandidates(group, matchingOn, dismissed, candidates)) break;
  }
  return [...candidates.values()];
};

export const PatientDuplicateReviewService = {
  async list(organisationId: string): Promise<PatientDuplicateCandidate[]> {
    const organisation = organisationId.trim();
    if (!organisation) {
      throw new PatientDuplicateReviewError("Organisation is required.", 400);
    }

    const patients = await prisma.patient.findMany({
      where: {
        organisations: {
          some: { organisationId: organisation, status: "ACTIVE" },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        speciesCode: true,
        dateOfBirth: true,
        microchipNumber: true,
      },
      orderBy: { id: "asc" },
    });
    const dismissed = await prisma.patientDuplicateDismissal.findMany({
      where: { organisationId: organisation },
      select: { patientAId: true, patientBId: true },
    });
    const dismissedPairs = new Set(
      dismissed.map(({ patientAId, patientBId }) =>
        pairKey(patientAId, patientBId),
      ),
    );

    return findCandidates(patients, dismissedPairs);
  },

  async dismiss(input: {
    organisationId: string;
    patientAId: string;
    patientBId: string;
    dismissedById: string;
  }): Promise<{ dismissedAt: Date }> {
    const organisationId = input.organisationId.trim();
    if (!organisationId || !input.dismissedById.trim()) {
      throw new PatientDuplicateReviewError(
        "Organisation and staff member are required.",
        400,
      );
    }
    if (input.patientAId === input.patientBId) {
      throw new PatientDuplicateReviewError(
        "Choose two different patient records.",
        400,
      );
    }

    const activePatients = await prisma.patient.findMany({
      where: {
        id: { in: [input.patientAId, input.patientBId] },
        organisations: {
          some: { organisationId, status: "ACTIVE" },
        },
      },
      select: { id: true },
    });
    if (new Set(activePatients.map(({ id }) => id)).size !== 2) {
      throw new PatientDuplicateReviewError("Patient record not found.", 404);
    }

    const [patientAId, patientBId] = [input.patientAId, input.patientBId].sort(
      (left, right) => left.localeCompare(right),
    );
    const dismissal = await prisma.patientDuplicateDismissal.upsert({
      where: {
        organisationId_patientAId_patientBId: {
          organisationId,
          patientAId,
          patientBId,
        },
      },
      create: {
        organisationId,
        patientAId,
        patientBId,
        dismissedById: input.dismissedById.trim(),
      },
      update: {},
      select: { dismissedAt: true },
    });
    return dismissal;
  },
};
