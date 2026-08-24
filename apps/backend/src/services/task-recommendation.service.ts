import { prisma } from "src/config/prisma";
import {
  ageInMonths,
  canonicalBreedCode,
  taskSpeciesForCode,
} from "./shared/breed-code";

/**
 * Breed- and age-based husbandry recommendations for one companion.
 *
 * Rules live in the database rather than the app bundle so a rule later found to
 * be wrong can be withdrawn the same day, instead of waiting out mobile adoption.
 *
 * Everything here recommends HUSBANDRY. "Log Gigi's weight monthly" and "book a
 * dental check" are actions a parent takes. Nothing is phrased as a claim about
 * the individual animal, which is both the safe framing and the honest one: a
 * rule knows a breed and an age, not a patient.
 */

export interface RecommendationCitation {
  authors: string;
  title: string;
  source: string;
  year: number;
  doi: string | null;
  url: string | null;
  /** The specific claim relied on, so a vet can argue with the rule, not the paper. */
  claim: string;
  grade: string;
  lastReviewedAt: Date | null;
  reviewedBy: string | null;
  nextReviewDue: Date | null;
}

export interface CompanionRecommendation {
  ruleId: string;
  taskDefinitionId: string;
  taskName: string;
  taskCategory: string;
  text: string;
  /** What actually triggered this, for the "why am I seeing this?" affordance. */
  because: {
    species: string;
    breedSpecific: boolean;
    breedCode: string | null;
    minAgeMonths: number | null;
    maxAgeMonths: number | null;
    ageMonths: number;
  };
  citation: RecommendationCitation;
}

export class TaskRecommendationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TaskRecommendationError";
  }
}

/**
 * Half-open window: [min, max). A rule for "from seven years" is minAgeMonths 84
 * with no upper bound; "under two" is maxAgeMonths 24. Half-open so adjacent
 * life-stage rules meet exactly once rather than both firing on the boundary.
 */
const withinWindow = (
  ageMonths: number,
  min: number | null,
  max: number | null,
): boolean => {
  if (min !== null && ageMonths < min) return false;
  if (max !== null && ageMonths >= max) return false;
  return true;
};

export const TaskRecommendationService = {
  async forCompanion(patientId: string): Promise<CompanionRecommendation[]> {
    const id = patientId?.trim();
    if (!id) {
      throw new TaskRecommendationError("Companion id is required.", 400);
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      select: { speciesCode: true, breedCode: true, dateOfBirth: true },
    });
    if (!patient) {
      throw new TaskRecommendationError("Companion not found.", 404);
    }

    // A companion with no coded species cannot be matched. Returning nothing is
    // correct: guessing the species from free-text breed here would put an
    // unreviewed inference behind a cited recommendation.
    const species = taskSpeciesForCode(patient.speciesCode);
    if (!species) return [];

    const age = ageInMonths(patient.dateOfBirth, new Date());
    if (age === null) return [];

    const rules = await prisma.taskRecommendationRule.findMany({
      where: {
        species,
        isActive: true,
        // Both conditions, not just isActive. A rule reaches a pet parent only
        // once a named reviewer has signed it off; an active-but-unreviewed row
        // is a seeding accident, not a recommendation.
        NOT: { reviewedBy: null },
      },
      include: {
        taskDefinition: {
          select: { id: true, name: true, category: true, isActive: true },
        },
      },
    });

    const patientBreed = canonicalBreedCode(patient.breedCode);

    return rules
      .filter((rule) => rule.taskDefinition?.isActive)
      .filter((rule) => withinWindow(age, rule.minAgeMonths, rule.maxAgeMonths))
      .filter((rule) => {
        // No breed codes means the rule is species-wide - the life-stage tasks
        // most animals get. Otherwise the patient's breed has to appear, compared
        // canonically because the vocabulary holds both separator conventions.
        if (rule.breedCodes.length === 0) return true;
        if (!patientBreed) return false;
        return rule.breedCodes.some(
          (code) => canonicalBreedCode(code) === patientBreed,
        );
      })
      .map((rule) => ({
        ruleId: rule.id,
        taskDefinitionId: rule.taskDefinitionId,
        taskName: rule.taskDefinition.name,
        taskCategory: rule.taskDefinition.category,
        text: rule.recommendationText,
        because: {
          species,
          breedSpecific: rule.breedCodes.length > 0,
          breedCode: patientBreed,
          minAgeMonths: rule.minAgeMonths,
          maxAgeMonths: rule.maxAgeMonths,
          ageMonths: age,
        },
        citation: {
          authors: rule.citationAuthors,
          title: rule.citationTitle,
          source: rule.citationSource,
          year: rule.citationYear,
          doi: rule.citationDoi,
          url: rule.citationUrl,
          claim: rule.citationClaim,
          grade: rule.evidenceGrade,
          lastReviewedAt: rule.lastReviewedAt,
          reviewedBy: rule.reviewedBy,
          nextReviewDue: rule.nextReviewDue,
        },
      }));
  },
};
