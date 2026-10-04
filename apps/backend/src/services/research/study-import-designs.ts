export const STUDY_IMPORT_FORMATS = [
  "usdm-json",
  "odm-xml",
  "trial-design-xpt",
  "trial-design-csv",
  "xlsx-template",
] as const;

export type StudyImportFormat = (typeof STUDY_IMPORT_FORMATS)[number];
export type StudyObjectKind =
  | "arm"
  | "epoch"
  | "element"
  | "visit"
  | "product"
  | "criterion"
  | "objective"
  | "activity"
  | "unit"
  | "code"
  | "form";

export type SourceStudyObject = {
  sourceId: string;
  kind: StudyObjectKind;
  code?: string;
  name: string;
  content: Readonly<Record<string, unknown>>;
};

export type LibraryStudyObject = {
  id: string;
  kind: StudyObjectKind;
  code?: string;
  name: string;
};

export type MappingProfile = {
  id: string;
  sourceSystem: string;
  mappings: Readonly<Record<string, string>>;
};

export type ImportProvenance = {
  sourceSystem: string;
  fileNames: readonly string[];
  checksums: readonly string[];
  mappingProfileId: string | null;
};

export type FidelityStatus =
  "exact" | "changed" | "placeholder" | "not-carried";

export type FidelityEntry = {
  sourceId: string;
  kind: StudyObjectKind;
  sourceName: string;
  status: FidelityStatus;
  targetId: string | null;
  reason: string | null;
};

export type ImportStage = "parsed" | "mapped" | "reviewed" | "committed";

export type StudyImportJob = {
  id: string;
  studyId: string;
  format: StudyImportFormat;
  stage: ImportStage;
  sourceObjects: readonly SourceStudyObject[];
  fidelity: readonly FidelityEntry[];
  provenance: ImportProvenance;
};

export type ImportedStudyVersion = {
  studyId: string;
  version: number;
  status: "draft";
  objects: readonly {
    id: string;
    kind: StudyObjectKind;
    name: string;
    content: Readonly<Record<string, unknown>>;
    placeholder: boolean;
  }[];
  provenance: ImportProvenance;
  fidelity: readonly FidelityEntry[];
};

const requireText = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
};

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

const assertUnique = (values: readonly string[], field: string): void => {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} must be unique`);
  }
};

const cloneProvenance = (provenance: ImportProvenance): ImportProvenance => ({
  ...provenance,
  fileNames: [...provenance.fileNames],
  checksums: [...provenance.checksums],
});

export const stageStudyImport = (input: {
  id: string;
  studyId: string;
  format: StudyImportFormat;
  sourceObjects: readonly SourceStudyObject[];
  provenance: ImportProvenance;
}): StudyImportJob => {
  requireText(input.id, "Import job id");
  requireText(input.studyId, "Study id");
  assertUnique(
    input.sourceObjects.map(({ sourceId }) =>
      requireText(sourceId, "Source object id"),
    ),
    "Source object ids",
  );
  if (input.provenance.fileNames.length !== input.provenance.checksums.length) {
    throw new Error("Every source file must have one checksum");
  }
  return {
    ...input,
    stage: "parsed",
    sourceObjects: input.sourceObjects.map((object) => ({
      ...object,
      content: { ...object.content },
    })),
    fidelity: [],
    provenance: cloneProvenance(input.provenance),
  };
};

const libraryMatch = (
  source: SourceStudyObject,
  library: readonly LibraryStudyObject[],
): LibraryStudyObject | undefined => {
  const sameKind = library.filter(({ kind }) => kind === source.kind);
  if (source.code) {
    const byCode = sameKind.find(
      ({ code }) => code && normalized(code) === normalized(source.code ?? ""),
    );
    if (byCode) return byCode;
  }
  return sameKind.find(
    ({ name }) => normalized(name) === normalized(source.name),
  );
};

export const mapStudyImport = (
  job: StudyImportJob,
  input: {
    library: readonly LibraryStudyObject[];
    profile?: MappingProfile;
    excluded?: Readonly<Record<string, string>>;
  },
): StudyImportJob => {
  if (job.stage !== "parsed") {
    throw new Error("Only a parsed import can be mapped");
  }
  const libraryById = new Map(input.library.map((item) => [item.id, item]));
  const fidelity = job.sourceObjects.map<FidelityEntry>((source) => {
    const exclusionReason = input.excluded?.[source.sourceId];
    if (exclusionReason) {
      return {
        sourceId: source.sourceId,
        kind: source.kind,
        sourceName: source.name,
        status: "not-carried",
        targetId: null,
        reason: requireText(exclusionReason, "Exclusion reason"),
      };
    }
    const profileTargetId = input.profile?.mappings[source.sourceId];
    const profileTarget = profileTargetId
      ? libraryById.get(profileTargetId)
      : undefined;
    if (profileTargetId && !profileTarget) {
      throw new Error(`Mapping target does not exist: ${profileTargetId}`);
    }
    if (profileTarget && profileTarget.kind !== source.kind) {
      throw new Error(`Mapping target kind does not match: ${source.sourceId}`);
    }
    const target = profileTarget ?? libraryMatch(source, input.library);
    if (!target) {
      return {
        sourceId: source.sourceId,
        kind: source.kind,
        sourceName: source.name,
        status: "placeholder",
        targetId: `placeholder:${source.sourceId}`,
        reason: "No matching library object",
      };
    }
    return {
      sourceId: source.sourceId,
      kind: source.kind,
      sourceName: source.name,
      status:
        normalized(target.name) === normalized(source.name)
          ? "exact"
          : "changed",
      targetId: target.id,
      reason:
        normalized(target.name) === normalized(source.name)
          ? null
          : `Mapped to ${target.name}`,
    };
  });
  return {
    ...job,
    stage: "mapped",
    fidelity,
    provenance: {
      ...cloneProvenance(job.provenance),
      mappingProfileId: input.profile?.id ?? job.provenance.mappingProfileId,
    },
  };
};

export const reviewStudyImport = (job: StudyImportJob): StudyImportJob => {
  if (
    job.stage !== "mapped" ||
    job.fidelity.length !== job.sourceObjects.length
  ) {
    throw new Error("Every source object must be mapped before review");
  }
  return { ...job, stage: "reviewed" };
};

export const fidelityCounts = (
  job: Pick<StudyImportJob, "sourceObjects" | "fidelity">,
): Record<FidelityStatus, number> & { source: number; reported: number } => {
  const counts = job.fidelity.reduce<Record<FidelityStatus, number>>(
    (result, entry) => ({
      ...result,
      [entry.status]: result[entry.status] + 1,
    }),
    { exact: 0, changed: 0, placeholder: 0, "not-carried": 0 },
  );
  return {
    ...counts,
    source: job.sourceObjects.length,
    reported: job.fidelity.length,
  };
};

export const commitStudyImport = (
  job: StudyImportJob,
  nextVersion: number,
): { job: StudyImportJob; version: ImportedStudyVersion } => {
  if (job.stage !== "reviewed") {
    throw new Error("Only a reviewed import can be committed");
  }
  if (!Number.isSafeInteger(nextVersion) || nextVersion < 1) {
    throw new Error("Study version must be a positive integer");
  }
  const fidelityBySourceId = new Map(
    job.fidelity.map((entry) => [entry.sourceId, entry]),
  );
  if (fidelityBySourceId.size !== job.sourceObjects.length) {
    throw new Error("Fidelity report does not match the source object count");
  }
  const objects = job.sourceObjects.flatMap((source) => {
    const result = fidelityBySourceId.get(source.sourceId);
    if (!result) {
      throw new Error(`Missing fidelity entry: ${source.sourceId}`);
    }
    if (result.status === "not-carried") return [];
    if (!result.targetId) {
      throw new Error(`Missing target for carried object: ${source.sourceId}`);
    }
    return [
      {
        id: result.targetId,
        kind: source.kind,
        name: source.name,
        content: { ...source.content },
        placeholder: result.status === "placeholder",
      },
    ];
  });
  return {
    job: { ...job, stage: "committed" },
    version: {
      studyId: job.studyId,
      version: nextVersion,
      status: "draft",
      objects,
      provenance: cloneProvenance(job.provenance),
      fidelity: job.fidelity.map((entry) => ({ ...entry })),
    },
  };
};

export const createBulkImportJobs = (
  batchId: string,
  studies: readonly Omit<Parameters<typeof stageStudyImport>[0], "id">[],
): readonly StudyImportJob[] => {
  requireText(batchId, "Batch id");
  assertUnique(
    studies.map(({ studyId }) => requireText(studyId, "Study id")),
    "Bulk import study ids",
  );
  return studies.map((study, index) =>
    stageStudyImport({ ...study, id: `${batchId}:${index + 1}` }),
  );
};

export type CaptureOnlyStatus =
  "draft" | "uat" | "approved" | "live" | "locked" | "archived";

export type CaptureForm = {
  id: string;
  origin: "generated" | "hand-built" | "imported-odm";
};

export type CaptureOnlyStudy = {
  id: string;
  status: CaptureOnlyStatus;
  protocolReference: string;
  formSet: readonly CaptureForm[];
  sandboxSubjectIds: readonly string[];
  liveSubjectIds: readonly string[];
};

const captureTransitions: Record<
  CaptureOnlyStatus,
  readonly CaptureOnlyStatus[]
> = {
  draft: ["uat"],
  uat: ["draft", "approved"],
  approved: ["live"],
  live: ["locked"],
  locked: ["live", "archived"],
  archived: [],
};

export const transitionCaptureOnlyStudy = (
  study: CaptureOnlyStudy,
  status: CaptureOnlyStatus,
): CaptureOnlyStudy => {
  if (!captureTransitions[study.status].includes(status)) {
    throw new Error(
      `Cannot move a capture-only study from ${study.status} to ${status}`,
    );
  }
  return {
    ...study,
    status,
    formSet: study.formSet.map((form) => ({ ...form })),
    sandboxSubjectIds: [...study.sandboxSubjectIds],
    liveSubjectIds: [...study.liveSubjectIds],
  };
};

export const enterCaptureData = (
  study: CaptureOnlyStudy,
  input: { actorRoles: readonly string[]; subjectId: string; sandbox: boolean },
): CaptureOnlyStudy => {
  if (input.actorRoles.includes("study-builder")) {
    throw new Error("Study builders cannot enter subject data");
  }
  const requiredStatus = input.sandbox ? "uat" : "live";
  if (study.status !== requiredStatus) {
    throw new Error(`Data entry requires the study to be ${requiredStatus}`);
  }
  const subjectId = requireText(input.subjectId, "Subject id");
  return input.sandbox
    ? { ...study, sandboxSubjectIds: [...study.sandboxSubjectIds, subjectId] }
    : { ...study, liveSubjectIds: [...study.liveSubjectIds, subjectId] };
};

export const promoteSandboxSubject = (): never => {
  throw new Error("Sandbox subjects cannot be promoted to live data");
};

export const adoptCaptureOnlyStudy = (
  study: CaptureOnlyStudy,
): CaptureOnlyStudy & { studyType: "full-builder" } => ({
  ...study,
  studyType: "full-builder",
  formSet: study.formSet.map((form) => ({ ...form })),
  sandboxSubjectIds: [...study.sandboxSubjectIds],
  liveSubjectIds: [...study.liveSubjectIds],
});

export type DesignMatrix = {
  pattern: "switchback" | "crossover" | "split-plot";
  treatments: readonly string[];
  periods: readonly string[];
  sequences: readonly { id: string; treatmentsByPeriod: readonly string[] }[];
  washoutDays: number;
  wholePlotUnits?: readonly string[];
  subPlotUnits?: readonly { id: string; wholePlotUnitId: string }[];
};

const validateTreatments = (treatments: readonly string[]): string[] => {
  const values = treatments.map((value) => requireText(value, "Treatment"));
  if (values.length < 2)
    throw new Error("At least two treatments are required");
  assertUnique(values, "Treatments");
  return values;
};

const balancedRow = (size: number): number[] => {
  const row = [0];
  for (let offset = 1; offset < size; offset += 1) {
    row.push(offset % 2 === 1 ? (offset + 1) / 2 : size - offset / 2);
  }
  return row;
};

export const generateCrossoverDesign = (input: {
  treatments: readonly string[];
  periodLengthDays: number;
  washoutDays: number;
}): DesignMatrix => {
  const treatments = validateTreatments(input.treatments);
  if (!Number.isFinite(input.periodLengthDays) || input.periodLengthDays <= 0) {
    throw new Error("Period length must be positive");
  }
  if (!Number.isFinite(input.washoutDays) || input.washoutDays < 0) {
    throw new Error("Wash-out must not be negative");
  }
  const base = balancedRow(treatments.length);
  const rows = treatments.map((_, rotation) =>
    base.map((index) => treatments[(index + rotation) % treatments.length]),
  );
  const balancedRows =
    treatments.length % 2 === 0
      ? rows
      : [...rows, ...rows.map((row) => [...row].reverse())];
  return {
    pattern: "crossover",
    treatments,
    periods: treatments.map(
      (_, index) => `Period ${index + 1} (${input.periodLengthDays} days)`,
    ),
    sequences: balancedRows.map((row, index) => ({
      id: `sequence-${index + 1}`,
      treatmentsByPeriod: row,
    })),
    washoutDays: input.washoutDays,
  };
};

export const generateSwitchbackDesign = (input: {
  treatments: readonly string[];
  periods: number;
  periodLengthDays: number;
  washoutDays: number;
}): DesignMatrix => {
  const treatments = validateTreatments(input.treatments);
  if (treatments.length !== 2) {
    throw new Error("A switchback design requires exactly two treatments");
  }
  if (!Number.isSafeInteger(input.periods) || input.periods < 3) {
    throw new Error("A switchback design requires at least three periods");
  }
  const sequences = treatments.map((_, start) => ({
    id: `sequence-${start + 1}`,
    treatmentsByPeriod: Array.from(
      { length: input.periods },
      (__, period) => treatments[(start + period) % treatments.length],
    ),
  }));
  return {
    pattern: "switchback",
    treatments,
    periods: Array.from(
      { length: input.periods },
      (_, index) => `Period ${index + 1} (${input.periodLengthDays} days)`,
    ),
    sequences,
    washoutDays: input.washoutDays,
  };
};

export const generateSplitPlotDesign = (input: {
  treatments: readonly string[];
  wholePlotCount: number;
  subPlotsPerWholePlot: number;
}): DesignMatrix => {
  const treatments = validateTreatments(input.treatments);
  if (!Number.isSafeInteger(input.wholePlotCount) || input.wholePlotCount < 1) {
    throw new Error("Whole-plot count must be a positive integer");
  }
  if (
    !Number.isSafeInteger(input.subPlotsPerWholePlot) ||
    input.subPlotsPerWholePlot < 1
  ) {
    throw new Error("Sub-plot count must be a positive integer");
  }
  const wholePlotUnits = Array.from(
    { length: input.wholePlotCount },
    (_, index) => `whole-plot-${index + 1}`,
  );
  const subPlotUnits = wholePlotUnits.flatMap((wholePlotUnitId) =>
    Array.from({ length: input.subPlotsPerWholePlot }, (_, index) => ({
      id: `${wholePlotUnitId}:sub-plot-${index + 1}`,
      wholePlotUnitId,
    })),
  );
  return {
    pattern: "split-plot",
    treatments,
    periods: ["Period 1"],
    sequences: subPlotUnits.map((unit, index) => ({
      id: unit.id,
      treatmentsByPeriod: [treatments[index % treatments.length]],
    })),
    washoutDays: 0,
    wholePlotUnits,
    subPlotUnits,
  };
};

export type DesignIntegrityIssue = {
  sequenceId: string;
  message: string;
};

export const checkDesignIntegrity = (
  design: DesignMatrix,
): readonly DesignIntegrityIssue[] =>
  design.sequences.flatMap((sequence) =>
    sequence.treatmentsByPeriod.length === design.periods.length
      ? []
      : [
          {
            sequenceId: sequence.id,
            message: `Expected ${design.periods.length} periods but found ${sequence.treatmentsByPeriod.length}`,
          },
        ],
  );
