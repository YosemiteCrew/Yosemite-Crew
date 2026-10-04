export type SubStudyStatus = "open" | "closed" | "retired";

export type SharedControlArm = {
  id: string;
  label: string;
  eligibility: readonly string[];
  schedule: readonly string[];
};

export type SubStudy = {
  id: string;
  label: string;
  status: SubStudyStatus;
  endpoints: readonly string[];
  randomisationStreamId: string;
  captureFormIds: readonly string[];
};

export type MasterProtocolVersion = {
  masterProtocolId: string;
  version: number;
  amendmentId: string | null;
  sharedEligibility: readonly string[];
  sharedSchedule: readonly string[];
  controlArm: SharedControlArm;
  subStudies: readonly SubStudy[];
};

export type MasterProtocolAmendment = {
  id: string;
  addSubStudies?: readonly SubStudy[];
  changeStatuses?: Readonly<Record<string, SubStudyStatus>>;
};

export type CaptureBuild = {
  masterProtocolId: string;
  masterProtocolVersion: number;
  subStudyId: string;
  randomisationStreamId: string;
  eligibility: readonly string[];
  schedule: readonly string[];
  armIds: readonly string[];
  captureFormIds: readonly string[];
};

const requireText = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
};

const assertUnique = (values: readonly string[], field: string): void => {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} must be unique`);
  }
};

const validateSubStudies = (subStudies: readonly SubStudy[]): void => {
  assertUnique(
    subStudies.map(({ id }) => requireText(id, "Sub-study id")),
    "Sub-study ids",
  );
  assertUnique(
    subStudies.map(({ randomisationStreamId }) =>
      requireText(randomisationStreamId, "Randomisation stream id"),
    ),
    "Randomisation stream ids",
  );
};

export const createMasterProtocol = (input: {
  masterProtocolId: string;
  sharedEligibility: readonly string[];
  sharedSchedule: readonly string[];
  controlArm: SharedControlArm;
  subStudies: readonly SubStudy[];
}): MasterProtocolVersion => {
  requireText(input.masterProtocolId, "Master protocol id");
  requireText(input.controlArm.id, "Control arm id");
  validateSubStudies(input.subStudies);
  return {
    ...input,
    version: 1,
    amendmentId: null,
    sharedEligibility: [...input.sharedEligibility],
    sharedSchedule: [...input.sharedSchedule],
    controlArm: {
      ...input.controlArm,
      eligibility: [...input.controlArm.eligibility],
      schedule: [...input.controlArm.schedule],
    },
    subStudies: input.subStudies.map(cloneSubStudy),
  };
};

const cloneSubStudy = (subStudy: SubStudy): SubStudy => ({
  ...subStudy,
  endpoints: [...subStudy.endpoints],
  captureFormIds: [...subStudy.captureFormIds],
});

export const amendMasterProtocol = (
  current: MasterProtocolVersion,
  amendment: MasterProtocolAmendment,
): MasterProtocolVersion => {
  requireText(amendment.id, "Amendment id");
  const additions = amendment.addSubStudies ?? [];
  const knownIds = new Set(current.subStudies.map(({ id }) => id));
  for (const id of Object.keys(amendment.changeStatuses ?? {})) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown sub-study: ${id}`);
    }
  }

  const subStudies = [
    ...current.subStudies.map((subStudy) => ({
      ...cloneSubStudy(subStudy),
      status: amendment.changeStatuses?.[subStudy.id] ?? subStudy.status,
    })),
    ...additions.map(cloneSubStudy),
  ];
  validateSubStudies(subStudies);

  return {
    ...current,
    version: current.version + 1,
    amendmentId: amendment.id,
    sharedEligibility: [...current.sharedEligibility],
    sharedSchedule: [...current.sharedSchedule],
    controlArm: {
      ...current.controlArm,
      eligibility: [...current.controlArm.eligibility],
      schedule: [...current.controlArm.schedule],
    },
    subStudies,
  };
};

export const canEnrollInSubStudy = (subStudy: SubStudy): boolean =>
  subStudy.status === "open";

export const generateCaptureBuilds = (
  protocol: MasterProtocolVersion,
): readonly CaptureBuild[] => {
  validateSubStudies(protocol.subStudies);
  return protocol.subStudies
    .filter(({ status }) => status !== "retired")
    .map((subStudy) => ({
      masterProtocolId: protocol.masterProtocolId,
      masterProtocolVersion: protocol.version,
      subStudyId: subStudy.id,
      randomisationStreamId: subStudy.randomisationStreamId,
      eligibility: [
        ...protocol.sharedEligibility,
        ...protocol.controlArm.eligibility,
      ],
      schedule: [...protocol.sharedSchedule, ...protocol.controlArm.schedule],
      armIds: [protocol.controlArm.id, subStudy.id],
      captureFormIds: [...subStudy.captureFormIds],
    }));
};

export type RandomisationStream = {
  id: string;
  nextSequence: number;
};

export const allocateFromRandomisationStream = (
  stream: RandomisationStream,
): { allocationId: string; stream: RandomisationStream } => {
  requireText(stream.id, "Randomisation stream id");
  if (!Number.isSafeInteger(stream.nextSequence) || stream.nextSequence < 1) {
    throw new Error("Randomisation sequence must be a positive integer");
  }
  return {
    allocationId: `${stream.id}:${stream.nextSequence}`,
    stream: { ...stream, nextSequence: stream.nextSequence + 1 },
  };
};

export const STUDY_ELEMENT_KINDS = [
  "form",
  "item",
  "code-list",
  "dataset-variable",
] as const;

export type StudyElementKind = (typeof STUDY_ELEMENT_KINDS)[number];
export type AdherenceClassification = "unchanged" | "modified" | "study-local";

export type StudyElement = {
  id: string;
  kind: StudyElementKind;
  classification: AdherenceClassification;
};

export type AdherenceCounts = Record<AdherenceClassification, number> & {
  total: number;
};

export type AdherenceBreakdown = AdherenceCounts & {
  percentages: Record<AdherenceClassification, number>;
};

export type StandardsAdherenceReport = {
  byKind: Record<StudyElementKind, AdherenceBreakdown>;
  overall: AdherenceBreakdown;
};

const percentage = (count: number, total: number): number =>
  total === 0 ? 0 : Math.round((count / total) * 10_000) / 100;

const adherenceBreakdown = (
  elements: readonly StudyElement[],
): AdherenceBreakdown => {
  const counts = elements.reduce<AdherenceCounts>(
    (result, element) => ({
      ...result,
      [element.classification]: result[element.classification] + 1,
      total: result.total + 1,
    }),
    { unchanged: 0, modified: 0, "study-local": 0, total: 0 },
  );
  return {
    ...counts,
    percentages: {
      unchanged: percentage(counts.unchanged, counts.total),
      modified: percentage(counts.modified, counts.total),
      "study-local": percentage(counts["study-local"], counts.total),
    },
  };
};

export const createStandardsAdherenceReport = (
  elements: readonly StudyElement[],
): StandardsAdherenceReport => ({
  byKind: Object.fromEntries(
    STUDY_ELEMENT_KINDS.map((kind) => [
      kind,
      adherenceBreakdown(elements.filter((element) => element.kind === kind)),
    ]),
  ) as Record<StudyElementKind, AdherenceBreakdown>,
  overall: adherenceBreakdown(elements),
});

export type DepartureDecision = "pending" | "approved" | "rejected";

export type StandardsDeparture = {
  id: string;
  elementId: string;
  elementKind: StudyElementKind;
  libraryElementId: string;
  libraryVersion: string;
  natureOfChange: string;
  justification: string;
  decision: DepartureDecision;
  proposedContent: Readonly<Record<string, unknown>>;
};

export const decideStandardsDeparture = (
  departure: StandardsDeparture,
  decision: Exclude<DepartureDecision, "pending">,
): StandardsDeparture => ({ ...departure, decision });

export type StudyApprovalDecision =
  | { allowed: true }
  | {
      allowed: false;
      unresolvedDepartureIds: readonly string[];
      rejectedDepartureIds: readonly string[];
    };

export const canApproveStudyVersion = (
  departures: readonly StandardsDeparture[],
): StudyApprovalDecision => {
  const unresolvedDepartureIds = departures
    .filter(({ decision }) => decision === "pending")
    .map(({ id }) => id);
  const rejectedDepartureIds = departures
    .filter(({ decision }) => decision === "rejected")
    .map(({ id }) => id);
  return unresolvedDepartureIds.length === 0 &&
    rejectedDepartureIds.length === 0
    ? { allowed: true }
    : { allowed: false, unresolvedDepartureIds, rejectedDepartureIds };
};

export type LibraryVersion = {
  libraryElementId: string;
  version: string;
  content: Readonly<Record<string, unknown>>;
};

export type LibraryPromotionAuditEntry = {
  event: "departure-promoted";
  departureId: string;
  libraryElementId: string;
  previousVersion: string;
  newVersion: string;
  actorId: string;
  occurredAt: string;
};

const nextLibraryVersion = (version: string): string => {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error("Library version must use major.minor numbering");
  }
  return `${match[1]}.${Number(match[2]) + 1}`;
};

export const promoteDepartureToLibrary = (input: {
  departure: StandardsDeparture;
  currentVersion: LibraryVersion;
  actorId: string;
  occurredAt: string;
}): { version: LibraryVersion; auditEntry: LibraryPromotionAuditEntry } => {
  if (input.departure.decision !== "approved") {
    throw new Error("Only an approved departure can be promoted");
  }
  if (
    input.departure.libraryElementId !==
      input.currentVersion.libraryElementId ||
    input.departure.libraryVersion !== input.currentVersion.version
  ) {
    throw new Error(
      "Departure source does not match the current library version",
    );
  }
  const version = nextLibraryVersion(input.currentVersion.version);
  return {
    version: {
      libraryElementId: input.currentVersion.libraryElementId,
      version,
      content: { ...input.departure.proposedContent },
    },
    auditEntry: {
      event: "departure-promoted",
      departureId: input.departure.id,
      libraryElementId: input.currentVersion.libraryElementId,
      previousVersion: input.currentVersion.version,
      newVersion: version,
      actorId: requireText(input.actorId, "Actor id"),
      occurredAt: requireText(input.occurredAt, "Occurrence time"),
    },
  };
};
