jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findUnique: jest.fn() },
    taskRecommendationRule: { findMany: jest.fn() },
  },
}));

import { prisma } from "src/config/prisma";
import {
  TaskRecommendationError,
  TaskRecommendationService,
} from "src/services/task-recommendation.service";

const patientFind = (
  prisma as unknown as { patient: { findUnique: jest.Mock } }
).patient.findUnique;
const ruleFind = (
  prisma as unknown as { taskRecommendationRule: { findMany: jest.Mock } }
).taskRecommendationRule.findMany;

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  // Step back a day so a same-day boundary never makes the age flap.
  d.setDate(d.getDate() - 1);
  return d;
};

const rule = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "rule-1",
  breedCodes: [] as string[],
  minAgeMonths: null,
  maxAgeMonths: null,
  taskDefinitionId: "task-1",
  recommendationText: "Log their weight monthly.",
  citationAuthors: "Author A, Author B",
  citationTitle: "A title",
  citationSource: "A journal",
  citationYear: 2024,
  citationDoi: "10.0000/example",
  citationUrl: null,
  citationClaim: "The specific sentence relied on.",
  evidenceGrade: "CONSENSUS_STATEMENT",
  lastReviewedAt: new Date("2026-01-01"),
  reviewedBy: "vet-1",
  nextReviewDue: new Date("2027-01-01"),
  taskDefinition: {
    id: "task-1",
    name: "Log weight",
    category: "Monitoring",
    isActive: true,
  },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  patientFind.mockResolvedValue({
    speciesCode: "YSPEC:CANINE",
    breedCode: "YBREED:CANINE:CAVALIER_KING_CHARLES_SPANIEL",
    dateOfBirth: yearsAgo(7),
  });
  ruleFind.mockResolvedValue([]);
});

describe("TaskRecommendationService.forCompanion", () => {
  it("only ever asks for active rules that a named reviewer signed off", async () => {
    // isActive alone is not enough. An active-but-unreviewed row is a seeding
    // accident, and this feature puts cited clinical guidance in front of pet
    // parents - it must not be reachable without a person attached to it.
    await TaskRecommendationService.forCompanion("pat-1");

    expect(ruleFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          species: "dog",
          isActive: true,
          NOT: { reviewedBy: null },
        }),
      }),
    );
  });

  it("matches a breed rule across the two vocabulary conventions", async () => {
    // The rule is stored hyphenated, the patient is coded with underscores. A
    // literal comparison returns nothing here, and a recommendation that is
    // silently absent looks exactly like a breed with no guidance for it.
    ruleFind.mockResolvedValue([
      rule({ breedCodes: ["YBREED:CANINE:CAVALIER-KING-CHARLES-SPANIEL"] }),
    ]);

    const out = await TaskRecommendationService.forCompanion("pat-1");

    expect(out).toHaveLength(1);
    expect(out[0].because.breedSpecific).toBe(true);
  });

  it("applies a species-wide rule to any breed, including an uncoded one", async () => {
    patientFind.mockResolvedValue({
      speciesCode: "YSPEC:CANINE",
      breedCode: null,
      dateOfBirth: yearsAgo(3),
    });
    ruleFind.mockResolvedValue([rule({ breedCodes: [] })]);

    const out = await TaskRecommendationService.forCompanion("pat-1");

    expect(out).toHaveLength(1);
    expect(out[0].because.breedSpecific).toBe(false);
  });

  it("does not apply a breed rule to a companion with no breed code", async () => {
    patientFind.mockResolvedValue({
      speciesCode: "YSPEC:CANINE",
      breedCode: null,
      dateOfBirth: yearsAgo(7),
    });
    ruleFind.mockResolvedValue([
      rule({ breedCodes: ["YBREED:CANINE:CAVALIER_KING_CHARLES_SPANIEL"] }),
    ]);

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
  });

  it("treats the age window as half-open so adjacent life stages do not overlap", async () => {
    patientFind.mockResolvedValue({
      speciesCode: "YSPEC:CANINE",
      breedCode: null,
      dateOfBirth: yearsAgo(7),
    });
    ruleFind.mockResolvedValue([
      rule({ id: "under-84", minAgeMonths: null, maxAgeMonths: 84 }),
      rule({ id: "from-84", minAgeMonths: 84, maxAgeMonths: null }),
    ]);

    const out = await TaskRecommendationService.forCompanion("pat-1");

    expect(out.map((r) => r.ruleId)).toEqual(["from-84"]);
  });

  it("drops a rule whose task definition has been deactivated", async () => {
    ruleFind.mockResolvedValue([
      rule({
        taskDefinition: {
          id: "task-1",
          name: "x",
          category: "y",
          isActive: false,
        },
      }),
    ]);

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
  });

  it("returns nothing for a species it cannot code, rather than guessing", async () => {
    // Guessing the species from free-text breed would put an unreviewed inference
    // behind a cited recommendation.
    patientFind.mockResolvedValue({
      speciesCode: null,
      breedCode: "YBREED:CANINE:PUG",
      dateOfBirth: yearsAgo(4),
    });

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
    expect(ruleFind).not.toHaveBeenCalled();
  });

  it("returns nothing when the date of birth is unusable", async () => {
    patientFind.mockResolvedValue({
      speciesCode: "YSPEC:CANINE",
      breedCode: null,
      dateOfBirth: null,
    });

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
  });

  it("carries the citation and the trigger through for the why-am-I-seeing-this panel", async () => {
    ruleFind.mockResolvedValue([
      rule({
        breedCodes: ["YBREED:CANINE:CAVALIER_KING_CHARLES_SPANIEL"],
        minAgeMonths: 60,
      }),
    ]);

    const [out] = await TaskRecommendationService.forCompanion("pat-1");

    expect(out.citation).toMatchObject({
      authors: "Author A, Author B",
      year: 2024,
      doi: "10.0000/example",
      claim: "The specific sentence relied on.",
      grade: "CONSENSUS_STATEMENT",
      reviewedBy: "vet-1",
    });
    expect(out.because).toMatchObject({
      species: "dog",
      breedSpecific: true,
      minAgeMonths: 60,
    });
    expect(out.because.ageMonths).toBeGreaterThanOrEqual(84);
  });

  it("404s an unknown companion and 400s a blank id", async () => {
    patientFind.mockResolvedValue(null);
    await expect(
      TaskRecommendationService.forCompanion("nope"),
    ).rejects.toThrow(TaskRecommendationError);

    await expect(
      TaskRecommendationService.forCompanion("   "),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
