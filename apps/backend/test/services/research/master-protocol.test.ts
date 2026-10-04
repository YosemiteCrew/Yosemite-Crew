import {
  allocateFromRandomisationStream,
  amendMasterProtocol,
  canApproveStudyVersion,
  canEnrollInSubStudy,
  createMasterProtocol,
  createStandardsAdherenceReport,
  decideStandardsDeparture,
  generateCaptureBuilds,
  promoteDepartureToLibrary,
  type StandardsDeparture,
  type SubStudy,
} from "../../../src/services/research/master-protocol";

const controlArm = {
  id: "control",
  label: "Shared control",
  eligibility: ["control eligible"],
  schedule: ["control day 14"],
};

const subStudy = (id: string): SubStudy => ({
  id,
  label: `Sub-study ${id}`,
  status: "open",
  endpoints: [`endpoint-${id}`],
  randomisationStreamId: `stream-${id}`,
  captureFormIds: [`form-${id}`],
});

const protocol = () =>
  createMasterProtocol({
    masterProtocolId: "master-1",
    sharedEligibility: ["shared eligible"],
    sharedSchedule: ["baseline"],
    controlArm,
    subStudies: [subStudy("a"), subStudy("b")],
  });

const departure = (
  decision: StandardsDeparture["decision"] = "pending",
): StandardsDeparture => ({
  id: "departure-1",
  elementId: "study-form-1",
  elementKind: "form",
  libraryElementId: "library-form-1",
  libraryVersion: "2.7",
  natureOfChange: "Adds a study-specific pain score",
  justification: "The primary endpoint requires the score",
  decision,
  proposedContent: { title: "Pain score form", itemCount: 7 },
});

describe("master protocol versions", () => {
  it("generates one capture build per sub-study with the shared control arm", () => {
    const builds = generateCaptureBuilds(protocol());

    expect(builds).toHaveLength(2);
    expect(builds.map(({ subStudyId }) => subStudyId)).toEqual(["a", "b"]);
    expect(builds.map(({ armIds }) => armIds)).toEqual([
      ["control", "a"],
      ["control", "b"],
    ]);
    expect(builds[0]).toMatchObject({
      eligibility: ["shared eligible", "control eligible"],
      schedule: ["baseline", "control day 14"],
    });
  });

  it("adds a sub-study by amendment without changing enrolment in existing sub-studies", () => {
    const first = protocol();
    const amended = amendMasterProtocol(first, {
      id: "amendment-1",
      addSubStudies: [subStudy("c")],
    });

    expect(amended).toMatchObject({ version: 2, amendmentId: "amendment-1" });
    expect(amended.subStudies.map(({ id, status }) => [id, status])).toEqual([
      ["a", "open"],
      ["b", "open"],
      ["c", "open"],
    ]);
    expect(first).toEqual(protocol());
  });

  it.each(["closed", "retired"] as const)(
    "prevents new enrolment after a sub-study is %s while keeping its version history",
    (status) => {
      const first = protocol();
      const amended = amendMasterProtocol(first, {
        id: `amendment-${status}`,
        changeStatuses: { a: status },
      });

      expect(canEnrollInSubStudy(first.subStudies[0])).toBe(true);
      expect(canEnrollInSubStudy(amended.subStudies[0])).toBe(false);
      expect(amended.subStudies[0].endpoints).toEqual(["endpoint-a"]);
      expect(
        generateCaptureBuilds(amended).map(({ subStudyId }) => subStudyId),
      ).toEqual(status === "retired" ? ["b"] : ["a", "b"]);
    },
  );

  it("allocates each sub-study from its own randomisation stream", () => {
    const firstA = allocateFromRandomisationStream({
      id: "stream-a",
      nextSequence: 1,
    });
    const secondA = allocateFromRandomisationStream(firstA.stream);
    const firstB = allocateFromRandomisationStream({
      id: "stream-b",
      nextSequence: 1,
    });

    expect([
      firstA.allocationId,
      secondA.allocationId,
      firstB.allocationId,
    ]).toEqual(["stream-a:1", "stream-a:2", "stream-b:1"]);
  });

  it("refuses duplicate sub-study and randomisation stream identifiers", () => {
    expect(() =>
      createMasterProtocol({
        masterProtocolId: "master-1",
        sharedEligibility: [],
        sharedSchedule: [],
        controlArm,
        subStudies: [subStudy("a"), subStudy("a")],
      }),
    ).toThrow("Sub-study ids must be unique");

    expect(() =>
      createMasterProtocol({
        masterProtocolId: "master-1",
        sharedEligibility: [],
        sharedSchedule: [],
        controlArm,
        subStudies: [
          subStudy("a"),
          { ...subStudy("b"), randomisationStreamId: "stream-a" },
        ],
      }),
    ).toThrow("Randomisation stream ids must be unique");
  });

  it("refuses amendments for unknown sub-studies and invalid allocation sequences", () => {
    expect(() =>
      amendMasterProtocol(protocol(), {
        id: "amendment-1",
        changeStatuses: { missing: "closed" },
      }),
    ).toThrow("Unknown sub-study: missing");
    expect(() =>
      allocateFromRandomisationStream({ id: "stream-a", nextSequence: 0 }),
    ).toThrow("Randomisation sequence must be a positive integer");
  });
});

describe("standards adherence", () => {
  it("reconciles percentages with counts for every element kind and overall", () => {
    const report = createStandardsAdherenceReport([
      { id: "form-1", kind: "form", classification: "unchanged" },
      { id: "form-2", kind: "form", classification: "modified" },
      { id: "form-3", kind: "form", classification: "study-local" },
      { id: "item-1", kind: "item", classification: "unchanged" },
      { id: "item-2", kind: "item", classification: "unchanged" },
      { id: "codes-1", kind: "code-list", classification: "modified" },
      {
        id: "variable-1",
        kind: "dataset-variable",
        classification: "unchanged",
      },
      {
        id: "variable-2",
        kind: "dataset-variable",
        classification: "study-local",
      },
    ]);

    expect(report.byKind.form).toEqual({
      unchanged: 1,
      modified: 1,
      "study-local": 1,
      total: 3,
      percentages: { unchanged: 33.33, modified: 33.33, "study-local": 33.33 },
    });
    expect(report.overall).toEqual({
      unchanged: 4,
      modified: 2,
      "study-local": 2,
      total: 8,
      percentages: { unchanged: 50, modified: 25, "study-local": 25 },
    });
    expect(report.byKind["code-list"].total).toBe(1);
    expect(report.byKind["dataset-variable"].total).toBe(2);
  });

  it("returns zero percentages for an empty element kind", () => {
    expect(createStandardsAdherenceReport([]).byKind.form).toEqual({
      unchanged: 0,
      modified: 0,
      "study-local": 0,
      total: 0,
      percentages: { unchanged: 0, modified: 0, "study-local": 0 },
    });
  });

  it("keeps the library source, source version, change and justification on a departure", () => {
    expect(departure()).toMatchObject({
      elementId: "study-form-1",
      libraryElementId: "library-form-1",
      libraryVersion: "2.7",
      natureOfChange: "Adds a study-specific pain score",
      justification: "The primary endpoint requires the score",
    });
  });

  it("blocks study approval for pending and rejected departures", () => {
    const pending = departure();
    const rejected = {
      ...departure("rejected"),
      id: "departure-2",
    };

    expect(canApproveStudyVersion([pending, rejected])).toEqual({
      allowed: false,
      unresolvedDepartureIds: ["departure-1"],
      rejectedDepartureIds: ["departure-2"],
    });
    expect(
      canApproveStudyVersion([
        decideStandardsDeparture(pending, "approved"),
        decideStandardsDeparture(rejected, "approved"),
      ]),
    ).toEqual({ allowed: true });
  });

  it("promotes an approved departure to a new library version with an audit entry", () => {
    const result = promoteDepartureToLibrary({
      departure: departure("approved"),
      currentVersion: {
        libraryElementId: "library-form-1",
        version: "2.7",
        content: { title: "Pain score form", itemCount: 6 },
      },
      actorId: "standards-manager-1",
      occurredAt: "2026-10-04T01:30:00.000Z",
    });

    expect(result.version).toEqual({
      libraryElementId: "library-form-1",
      version: "2.8",
      content: { title: "Pain score form", itemCount: 7 },
    });
    expect(result.auditEntry).toEqual({
      event: "departure-promoted",
      departureId: "departure-1",
      libraryElementId: "library-form-1",
      previousVersion: "2.7",
      newVersion: "2.8",
      actorId: "standards-manager-1",
      occurredAt: "2026-10-04T01:30:00.000Z",
    });
  });

  it("refuses promotion before approval or from a stale library version", () => {
    expect(() =>
      promoteDepartureToLibrary({
        departure: departure(),
        currentVersion: {
          libraryElementId: "library-form-1",
          version: "2.7",
          content: {},
        },
        actorId: "manager-1",
        occurredAt: "2026-10-04T01:30:00.000Z",
      }),
    ).toThrow("Only an approved departure can be promoted");
    expect(() =>
      promoteDepartureToLibrary({
        departure: departure("approved"),
        currentVersion: {
          libraryElementId: "library-form-1",
          version: "2.8",
          content: {},
        },
        actorId: "manager-1",
        occurredAt: "2026-10-04T01:30:00.000Z",
      }),
    ).toThrow("Departure source does not match the current library version");
  });
});
