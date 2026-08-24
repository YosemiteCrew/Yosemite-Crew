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
    applicableSpecies: ["dog", "cat", "horse"],
  },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  patientFind.mockResolvedValue({
    speciesCode: "YSPEC:CANINE",
    breedCode: "YBREED:CANINE:CAVALIER_KING_CHARLES_SPANIEL",
    dateOfBirth: yearsAgo(7),
    type: "dog",
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
          reviewedBy: { not: null },
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
      type: "dog",
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
      type: "dog",
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
      type: "dog",
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

  it("returns nothing for a species with no rules vocabulary, rather than guessing", async () => {
    // Guessing the species from free-text breed would put an unreviewed inference
    // behind a cited recommendation.
    patientFind.mockResolvedValue({
      speciesCode: null,
      breedCode: "YBREED:CANINE:PUG",
      dateOfBirth: yearsAgo(4),
      type: "other",
    });

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
    expect(ruleFind).not.toHaveBeenCalled();
  });

  it("returns nothing when the date of birth is unusable", async () => {
    patientFind.mockResolvedValue({
      speciesCode: "YSPEC:CANINE",
      breedCode: null,
      dateOfBirth: null,
      type: "dog",
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

    expect(out.evidence.artifact).toMatchObject({
      type: "citation",
      // The claim relied on, not the paper's abstract - this is what a vet argues with.
      display: "The specific sentence relied on.",
      citation: "Author A, Author B. A title. A journal. 2024.",
      url: "https://doi.org/10.0000/example",
    });
    expect(out.evidence.grade).toBe("CONSENSUS_STATEMENT");
    expect(out.evidence.attestation.reviewedBy).toBe("vet-1");
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

describe("TaskRecommendationService hardening", () => {
  it("falls back to the required type when speciesCode is missing", async () => {
    // speciesCode is null on 30 of 37 production companions. Reading only the
    // coded column returned nothing for four companions in five until the
    // backfill ran. `type` is required and is what the parent picked, so this is
    // a fallback between two recorded values, not an inference.
    patientFind.mockResolvedValue({
      speciesCode: null,
      breedCode: null,
      dateOfBirth: yearsAgo(5),
      type: "cat",
    });
    ruleFind.mockResolvedValue([rule()]);

    const out = await TaskRecommendationService.forCompanion("pat-1");

    expect(ruleFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ species: "cat" }),
      }),
    );
    expect(out).toHaveLength(1);
  });

  it("does not treat a blank reviewer as a signature", async () => {
    // The column is a nullable string, so "" and "   " both pass a NOT NULL
    // check while naming nobody. This is the gate that keeps unreviewed clinical
    // guidance away from pet parents.
    ruleFind.mockResolvedValue([
      rule({ id: "empty", reviewedBy: "" }),
      rule({ id: "spaces", reviewedBy: "   " }),
      rule({ id: "named", reviewedBy: "Dr Real Person" }),
    ]);

    const out = await TaskRecommendationService.forCompanion("pat-1");

    expect(out.map((r) => r.ruleId)).toEqual(["named"]);
  });

  it("will not recommend a task the definition does not apply to that species", async () => {
    // Nothing in the relation enforces this, so a curator pointing a canine rule
    // at a feline-only task would otherwise ship it.
    ruleFind.mockResolvedValue([
      rule({
        taskDefinition: {
          id: "task-1",
          name: "Cat-only thing",
          category: "x",
          isActive: true,
          applicableSpecies: ["cat"],
        },
      }),
    ]);

    expect(await TaskRecommendationService.forCompanion("pat-1")).toEqual([]);
  });

  it("gives the evidence grade a readable label without dropping the raw value", async () => {
    ruleFind.mockResolvedValue([
      rule({ evidenceGrade: "CONSENSUS_STATEMENT" }),
    ]);

    const [out] = await TaskRecommendationService.forCompanion("pat-1");

    expect(out.evidence.grade).toBe("CONSENSUS_STATEMENT");
    expect(out.evidence.artifact.label).toBe("Consensus statement");
  });

  it("falls back to the raw grade if a new one has no label yet", async () => {
    ruleFind.mockResolvedValue([rule({ evidenceGrade: "SOMETHING_NEW" })]);

    const [out] = await TaskRecommendationService.forCompanion("pat-1");

    expect(out.evidence.artifact.label).toBe("SOMETHING_NEW");
  });
});

describe("TaskRecommendationService evidence shape", () => {
  it("prefers an explicit url over a DOI, and omits the link when there is neither", async () => {
    ruleFind.mockResolvedValue([
      rule({
        id: "with-url",
        citationUrl: "https://example.org/paper",
        citationDoi: "10.1/x",
      }),
    ]);
    const [withUrl] = await TaskRecommendationService.forCompanion("pat-1");
    expect(withUrl.evidence.artifact.url).toBe("https://example.org/paper");

    ruleFind.mockResolvedValue([
      rule({ citationUrl: null, citationDoi: null }),
    ]);
    const [bare] = await TaskRecommendationService.forCompanion("pat-1");
    // Not an empty string or a bare "https://doi.org/" - the field is simply absent.
    expect(bare.evidence.artifact.url).toBeUndefined();
  });
});
