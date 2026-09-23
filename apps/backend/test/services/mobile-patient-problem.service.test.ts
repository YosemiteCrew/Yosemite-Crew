import { MobilePatientProblemService } from "../../src/services/mobile-patient-problem.service";

jest.mock("src/config/prisma", () => ({
  prisma: { patientProblem: { findMany: jest.fn() } },
}));

import { prisma } from "src/config/prisma";

const mockProblems = prisma.patientProblem.findMany as jest.Mock;
const { listProblemsForCompanion } = MobilePatientProblemService;

const problemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "prb-1",
  patientId: "pet-1",
  organisationId: "org-1",
  name: "Chronic kidney disease",
  codeSystem: "VeNom",
  code: "1234",
  status: "ACTIVE",
  severity: "SEVERE",
  onsetDate: new Date("2026-03-04T00:00:00.000Z"),
  createdAt: new Date("2026-03-05T09:00:00.000Z"),
  updatedAt: new Date("2026-03-06T09:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProblems.mockResolvedValue([]);
});

describe("scoping", () => {
  it("never queries for a falsy patient id", async () => {
    await expect(listProblemsForCompanion("")).resolves.toEqual([]);
    expect(mockProblems).not.toHaveBeenCalled();
  });

  it("scopes the read to the named companion", async () => {
    await listProblemsForCompanion("pet-1");

    expect(mockProblems).toHaveBeenCalledTimes(1);
    expect(mockProblems.mock.calls[0][0].where).toMatchObject({
      patientId: "pet-1",
    });
  });

  /*
   * The organisation is deliberately absent from the `where`. An animal seen
   * by a second practice has that practice's problem rows under a different
   * organisationId, and an org filter would hide exactly the record the owner
   * cannot reach any other way.
   */
  it("does not filter by organisation, so a second practice's record is returned", async () => {
    mockProblems.mockResolvedValue([
      problemRow(),
      problemRow({ id: "prb-2", organisationId: "org-2", name: "Atopy" }),
    ]);

    const problems = await listProblemsForCompanion("pet-1");

    expect(mockProblems.mock.calls[0][0].where).not.toHaveProperty(
      "organisationId",
    );
    expect(problems.map((p) => p.organisationId)).toEqual(["org-1", "org-2"]);
  });
});

describe("what the owner is shown", () => {
  it("asks for the live statuses and not for resolved ones", async () => {
    await listProblemsForCompanion("pet-1");

    const { status } = mockProblems.mock.calls[0][0].where;
    expect(status.in).toEqual(["ACTIVE", "INACTIVE"]);
    expect(status.in).not.toContain("RESOLVED");
  });

  it("never selects the practice's own notes, staff id or encounter pointer", async () => {
    await listProblemsForCompanion("pet-1");

    const { select } = mockProblems.mock.calls[0][0];
    expect(select).not.toHaveProperty("notes");
    expect(select).not.toHaveProperty("recordedBy");
    expect(select).not.toHaveProperty("encounterId");
  });

  it("orders live before dormant, then most severe first", async () => {
    await listProblemsForCompanion("pet-1");

    const [first, second] = mockProblems.mock.calls[0][0].orderBy;
    expect(first).toEqual({ status: "asc" });
    expect(second).toEqual({ severity: { sort: "desc", nulls: "last" } });
  });

  /*
   * Postgres sorts NULLs FIRST on a descending order, so a row with no
   * severity or no onset date recorded would otherwise float above the rows
   * that carry the information. Both nullable sort keys have to say so.
   */
  it("sorts the rows missing a severity or an onset date last, not first", async () => {
    await listProblemsForCompanion("pet-1");

    const nullable = mockProblems.mock.calls[0][0].orderBy.filter(
      (clause: Record<string, unknown>) =>
        "severity" in clause || "onsetDate" in clause,
    );

    expect(nullable).toHaveLength(2);
    for (const clause of nullable) {
      expect(Object.values(clause)[0]).toMatchObject({ nulls: "last" });
    }
  });

  it("reads the list unpaged, so no problem is silently withheld", async () => {
    await listProblemsForCompanion("pet-1");

    const args = mockProblems.mock.calls[0][0];
    expect(args).not.toHaveProperty("take");
    expect(args).not.toHaveProperty("cursor");
    expect(args).not.toHaveProperty("skip");
  });
});

describe("the wire shape", () => {
  it("maps a row to the owner-facing fields", async () => {
    mockProblems.mockResolvedValue([problemRow()]);

    const [problem] = await listProblemsForCompanion("pet-1");

    expect(problem).toEqual({
      id: "prb-1",
      patientId: "pet-1",
      organisationId: "org-1",
      name: "Chronic kidney disease",
      codeSystem: "VeNom",
      code: "1234",
      status: "ACTIVE",
      severity: "SEVERE",
      onsetDate: "2026-03-04T00:00:00.000Z",
      recordedAt: "2026-03-05T09:00:00.000Z",
      updatedAt: "2026-03-06T09:00:00.000Z",
    });
  });

  /*
   * `recordedAt` is the row's createdAt, which is when the practice wrote it
   * down - not when the animal fell ill. Conflating the two is the mistake the
   * rename exists to prevent, so the test pins both separately.
   */
  it("keeps the recorded date distinct from the onset date", async () => {
    mockProblems.mockResolvedValue([
      problemRow({
        onsetDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-06T06:00:00.000Z"),
      }),
    ]);

    const [problem] = await listProblemsForCompanion("pet-1");

    expect(problem.onsetDate).toBe("2024-01-01T00:00:00.000Z");
    expect(problem.recordedAt).toBe("2026-06-06T06:00:00.000Z");
  });

  /*
   * Absent, not null. JSON.stringify drops an undefined and emits a null, so a
   * client checking presence would otherwise see a code that is there and
   * empty.
   */
  it("omits an uncoded, unsevered, undated problem rather than sending nulls", async () => {
    mockProblems.mockResolvedValue([
      problemRow({
        codeSystem: null,
        code: null,
        severity: null,
        onsetDate: null,
      }),
    ]);

    const [problem] = await listProblemsForCompanion("pet-1");

    expect(problem.codeSystem).toBeUndefined();
    expect(problem.code).toBeUndefined();
    expect(problem.severity).toBeUndefined();
    expect(problem.onsetDate).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(problem, "severity")).toBe(
      true,
    );
  });

  it("carries a dormant problem through with its status intact", async () => {
    mockProblems.mockResolvedValue([
      problemRow({ id: "prb-9", status: "INACTIVE", severity: "MILD" }),
    ]);

    const [problem] = await listProblemsForCompanion("pet-1");

    expect(problem.status).toBe("INACTIVE");
  });

  it("returns an empty list when nothing has been recorded", async () => {
    await expect(listProblemsForCompanion("pet-1")).resolves.toEqual([]);
  });
});
