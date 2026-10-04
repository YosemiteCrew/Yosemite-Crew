import {
  adoptCaptureOnlyStudy,
  checkDesignIntegrity,
  commitStudyImport,
  createBulkImportJobs,
  enterCaptureData,
  fidelityCounts,
  generateCrossoverDesign,
  generateSplitPlotDesign,
  generateSwitchbackDesign,
  mapStudyImport,
  promoteSandboxSubject,
  reviewStudyImport,
  stageStudyImport,
  transitionCaptureOnlyStudy,
  type CaptureOnlyStudy,
  type MappingProfile,
  type SourceStudyObject,
} from "../../../src/services/research/study-import-designs";

const sources: readonly SourceStudyObject[] = [
  {
    sourceId: "activity-weight",
    kind: "activity",
    code: "BW",
    name: "Body weight",
    content: { unit: "kg" },
  },
  {
    sourceId: "unit-kg",
    kind: "unit",
    code: "kg",
    name: "Kilograms",
    content: {},
  },
  {
    sourceId: "objective-1",
    kind: "objective",
    name: "Primary efficacy",
    content: { level: "primary" },
  },
  {
    sourceId: "criterion-old",
    kind: "criterion",
    name: "Legacy criterion",
    content: {},
  },
];

const staged = () =>
  stageStudyImport({
    id: "import-1",
    studyId: "study-1",
    format: "usdm-json",
    sourceObjects: sources,
    provenance: {
      sourceSystem: "Sponsor archive",
      fileNames: ["study.json"],
      checksums: ["sha256:fixture"],
      mappingProfileId: null,
    },
  });

const profile: MappingProfile = {
  id: "profile-1",
  sourceSystem: "Sponsor archive",
  mappings: { "objective-1": "library-objective-1" },
};

describe("study imports", () => {
  it.each([
    "usdm-json",
    "odm-xml",
    "trial-design-xpt",
    "trial-design-csv",
    "xlsx-template",
  ] as const)(
    "stages the supported %s format without changing a study",
    (format) => {
      expect(
        stageStudyImport({
          ...staged(),
          id: `import-${format}`,
          format,
        }),
      ).toMatchObject({ format, stage: "parsed", fidelity: [] });
    },
  );

  it("maps by code before name, applies a profile and creates placeholders", () => {
    const mapped = mapStudyImport(staged(), {
      profile,
      library: [
        { id: "wrong-name", kind: "activity", name: "Body weight" },
        { id: "activity-bw", kind: "activity", code: "BW", name: "Weight" },
        { id: "unit-kg", kind: "unit", name: "kilograms" },
        {
          id: "library-objective-1",
          kind: "objective",
          name: "Efficacy objective",
        },
      ],
      excluded: { "criterion-old": "Not used by the receiving study" },
    });

    expect(mapped.fidelity).toEqual([
      expect.objectContaining({
        sourceId: "activity-weight",
        status: "changed",
        targetId: "activity-bw",
      }),
      expect.objectContaining({
        sourceId: "unit-kg",
        status: "exact",
        targetId: "unit-kg",
      }),
      expect.objectContaining({
        sourceId: "objective-1",
        status: "changed",
        targetId: "library-objective-1",
      }),
      expect.objectContaining({
        sourceId: "criterion-old",
        status: "not-carried",
        reason: "Not used by the receiving study",
      }),
    ]);
    expect(mapped.provenance.mappingProfileId).toBe("profile-1");
  });

  it("reports every source object and commits one immutable draft batch", () => {
    const mapped = mapStudyImport(staged(), {
      library: [
        {
          id: "activity-bw",
          kind: "activity",
          code: "BW",
          name: "Body weight",
        },
      ],
      excluded: { "criterion-old": "Not applicable" },
    });
    expect(fidelityCounts(mapped)).toEqual({
      exact: 1,
      changed: 0,
      placeholder: 2,
      "not-carried": 1,
      source: 4,
      reported: 4,
    });

    const committed = commitStudyImport(reviewStudyImport(mapped), 1);
    expect(committed.job.stage).toBe("committed");
    expect(committed.version).toMatchObject({
      studyId: "study-1",
      version: 1,
      status: "draft",
      provenance: { mappingProfileId: null },
    });
    expect(committed.version.objects).toHaveLength(3);
    expect(
      committed.version.objects.filter(({ placeholder }) => placeholder),
    ).toHaveLength(2);
    expect(staged()).toMatchObject({ stage: "parsed", fidelity: [] });
  });

  it("leaves the import uncommitted when review or fidelity is incomplete", () => {
    const mapped = mapStudyImport(staged(), { library: [] });
    expect(() => commitStudyImport(mapped, 1)).toThrow(
      "Only a reviewed import can be committed",
    );
    expect(() =>
      commitStudyImport(
        { ...reviewStudyImport(mapped), fidelity: mapped.fidelity.slice(1) },
        1,
      ),
    ).toThrow("Fidelity report does not match the source object count");
    expect(mapped.stage).toBe("mapped");
  });

  it("runs one tracked job per study in a bulk import", () => {
    const jobs = createBulkImportJobs(
      "batch-1",
      ["study-a", "study-b"].map((studyId) => ({
        studyId,
        format: "odm-xml" as const,
        sourceObjects: sources,
        provenance: staged().provenance,
      })),
    );
    expect(jobs.map(({ id, studyId }) => [id, studyId])).toEqual([
      ["batch-1:1", "study-a"],
      ["batch-1:2", "study-b"],
    ]);
  });

  it("validates source identity, checksums and mapping profile targets", () => {
    expect(() =>
      stageStudyImport({
        ...staged(),
        sourceObjects: [sources[0], sources[0]],
      }),
    ).toThrow("Source object ids must be unique");
    expect(() =>
      stageStudyImport({
        ...staged(),
        provenance: { ...staged().provenance, checksums: [] },
      }),
    ).toThrow("Every source file must have one checksum");
    expect(() =>
      mapStudyImport(mapStudyImport(staged(), { library: [] }), {
        library: [],
      }),
    ).toThrow("Only a parsed import can be mapped");
    expect(() =>
      mapStudyImport(staged(), {
        library: [],
        profile: { ...profile, mappings: { "objective-1": "missing" } },
      }),
    ).toThrow("Mapping target does not exist: missing");
    expect(() =>
      mapStudyImport(staged(), {
        library: [{ id: "wrong-kind", kind: "arm", name: "Arm" }],
        profile: { ...profile, mappings: { "objective-1": "wrong-kind" } },
      }),
    ).toThrow("Mapping target kind does not match: objective-1");
  });

  it("validates review and commit boundaries", () => {
    expect(() => reviewStudyImport(staged())).toThrow(
      "Every source object must be mapped before review",
    );
    const reviewed = reviewStudyImport(
      mapStudyImport(staged(), { library: [] }),
    );
    expect(() => commitStudyImport(reviewed, 0)).toThrow(
      "Study version must be a positive integer",
    );
    expect(() =>
      commitStudyImport(
        {
          ...reviewed,
          fidelity: reviewed.fidelity.map((entry, index) =>
            index === 0 ? { ...entry, sourceId: "unknown-source" } : entry,
          ),
        },
        1,
      ),
    ).toThrow("Missing fidelity entry: activity-weight");
    expect(() =>
      commitStudyImport(
        {
          ...reviewed,
          fidelity: reviewed.fidelity.map((entry, index) =>
            index === 0 ? { ...entry, targetId: null } : entry,
          ),
        },
        1,
      ),
    ).toThrow("Missing target for carried object: activity-weight");
  });
});

const captureStudy = (): CaptureOnlyStudy => ({
  id: "capture-1",
  status: "draft",
  protocolReference: "Sponsor protocol 7",
  formSet: [
    { id: "form-generated", origin: "generated" },
    { id: "form-manual", origin: "hand-built" },
    { id: "form-odm", origin: "imported-odm" },
  ],
  sandboxSubjectIds: [],
  liveSubjectIds: [],
});

describe("capture-only studies", () => {
  it("moves through UAT, approval, live, lock and archive", () => {
    const uat = transitionCaptureOnlyStudy(captureStudy(), "uat");
    const approved = transitionCaptureOnlyStudy(uat, "approved");
    const live = transitionCaptureOnlyStudy(approved, "live");
    const locked = transitionCaptureOnlyStudy(live, "locked");
    expect(transitionCaptureOnlyStudy(locked, "archived").status).toBe(
      "archived",
    );
    expect(() => transitionCaptureOnlyStudy(captureStudy(), "live")).toThrow(
      "Cannot move a capture-only study from draft to live",
    );
  });

  it("separates sandbox data and refuses builders and subject promotion", () => {
    const uat = transitionCaptureOnlyStudy(captureStudy(), "uat");
    const withTestSubject = enterCaptureData(uat, {
      actorRoles: ["data-manager"],
      subjectId: "test-subject-1",
      sandbox: true,
    });
    expect(withTestSubject).toMatchObject({
      sandboxSubjectIds: ["test-subject-1"],
      liveSubjectIds: [],
    });
    expect(() =>
      enterCaptureData(uat, {
        actorRoles: ["study-builder"],
        subjectId: "test-subject-2",
        sandbox: true,
      }),
    ).toThrow("Study builders cannot enter subject data");
    expect(promoteSandboxSubject).toThrow(
      "Sandbox subjects cannot be promoted to live data",
    );
  });

  it("adopts the study without re-entering forms or captured data", () => {
    const adopted = adoptCaptureOnlyStudy({
      ...captureStudy(),
      status: "live",
      liveSubjectIds: ["subject-1"],
    });
    expect(adopted.studyType).toBe("full-builder");
    expect(adopted.formSet).toEqual(captureStudy().formSet);
    expect(adopted.liveSubjectIds).toEqual(["subject-1"]);
  });

  it("accepts live data only while the study is live", () => {
    const live = transitionCaptureOnlyStudy(
      transitionCaptureOnlyStudy(
        transitionCaptureOnlyStudy(captureStudy(), "uat"),
        "approved",
      ),
      "live",
    );
    expect(
      enterCaptureData(live, {
        actorRoles: ["investigator"],
        subjectId: "subject-1",
        sandbox: false,
      }).liveSubjectIds,
    ).toEqual(["subject-1"]);
    expect(() =>
      enterCaptureData(captureStudy(), {
        actorRoles: ["investigator"],
        subjectId: "subject-2",
        sandbox: false,
      }),
    ).toThrow("Data entry requires the study to be live");
  });
});

describe("design-pattern generation", () => {
  it("generates a Williams-balanced crossover for four treatments", () => {
    const design = generateCrossoverDesign({
      treatments: ["A", "B", "C", "D"],
      periodLengthDays: 7,
      washoutDays: 2,
    });
    const carryovers = new Map<string, number>();
    for (const { treatmentsByPeriod } of design.sequences) {
      for (let index = 1; index < treatmentsByPeriod.length; index += 1) {
        const pair = `${treatmentsByPeriod[index - 1]}:${treatmentsByPeriod[index]}`;
        carryovers.set(pair, (carryovers.get(pair) ?? 0) + 1);
      }
    }
    expect(design.sequences).toHaveLength(4);
    expect(carryovers.size).toBe(12);
    expect([...carryovers.values()]).toEqual(Array(12).fill(1));
  });

  it("generates alternating switchback sequences", () => {
    expect(
      generateSwitchbackDesign({
        treatments: ["control", "active"],
        periods: 3,
        periodLengthDays: 14,
        washoutDays: 3,
      }).sequences.map(({ treatmentsByPeriod }) => treatmentsByPeriod),
    ).toEqual([
      ["control", "active", "control"],
      ["active", "control", "active"],
    ]);
  });

  it("records whole-plot and sub-plot units separately", () => {
    const design = generateSplitPlotDesign({
      treatments: ["A", "B"],
      wholePlotCount: 2,
      subPlotsPerWholePlot: 3,
    });
    expect(design.wholePlotUnits).toEqual(["whole-plot-1", "whole-plot-2"]);
    expect(design.subPlotUnits).toHaveLength(6);
    expect(design.subPlotUnits?.[3]).toEqual({
      id: "whole-plot-2:sub-plot-1",
      wholePlotUnitId: "whole-plot-2",
    });
    expect(design.sequences).toHaveLength(6);
  });

  it("flags a hand edit that removes one sequence period", () => {
    const design = generateCrossoverDesign({
      treatments: ["A", "B", "C", "D"],
      periodLengthDays: 7,
      washoutDays: 0,
    });
    const edited = {
      ...design,
      sequences: [
        { ...design.sequences[0], treatmentsByPeriod: ["A", "B", "D"] },
        ...design.sequences.slice(1),
      ],
    };
    expect(checkDesignIntegrity(edited)).toEqual([
      {
        sequenceId: "sequence-1",
        message: "Expected 4 periods but found 3",
      },
    ]);
  });

  it("balances odd crossovers by adding reversed sequences", () => {
    expect(
      generateCrossoverDesign({
        treatments: ["A", "B", "C"],
        periodLengthDays: 5,
        washoutDays: 1,
      }).sequences,
    ).toHaveLength(6);
  });

  it("validates design inputs", () => {
    expect(() =>
      generateCrossoverDesign({
        treatments: ["A"],
        periodLengthDays: 7,
        washoutDays: 0,
      }),
    ).toThrow("At least two treatments are required");
    expect(() =>
      generateCrossoverDesign({
        treatments: ["A", "A"],
        periodLengthDays: 7,
        washoutDays: 0,
      }),
    ).toThrow("Treatments must be unique");
    expect(() =>
      generateCrossoverDesign({
        treatments: ["A", "B"],
        periodLengthDays: 0,
        washoutDays: 0,
      }),
    ).toThrow("Period length must be positive");
    expect(() =>
      generateCrossoverDesign({
        treatments: ["A", "B"],
        periodLengthDays: 7,
        washoutDays: -1,
      }),
    ).toThrow("Wash-out must not be negative");
    expect(() =>
      generateSwitchbackDesign({
        treatments: ["A", "B", "C"],
        periods: 3,
        periodLengthDays: 7,
        washoutDays: 0,
      }),
    ).toThrow("A switchback design requires exactly two treatments");
    expect(() =>
      generateSwitchbackDesign({
        treatments: ["A", "B"],
        periods: 2,
        periodLengthDays: 7,
        washoutDays: 0,
      }),
    ).toThrow("A switchback design requires at least three periods");
    expect(() =>
      generateSplitPlotDesign({
        treatments: ["A", "B"],
        wholePlotCount: 0,
        subPlotsPerWholePlot: 1,
      }),
    ).toThrow("Whole-plot count must be a positive integer");
    expect(() =>
      generateSplitPlotDesign({
        treatments: ["A", "B"],
        wholePlotCount: 1,
        subPlotsPerWholePlot: 0,
      }),
    ).toThrow("Sub-plot count must be a positive integer");
  });
});
