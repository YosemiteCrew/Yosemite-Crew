import type { RelatedArtifact } from "@yosemite-crew/fhir";
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

/**
 * The evidence behind a recommendation, as a FHIR R4 `RelatedArtifact`.
 *
 * `RelatedArtifact` is the standard's own type for exactly this - the citation
 * supporting a definitional resource - so there is no reason to invent a shape
 * for it, and apps/backend/AGENTS.md says as much. The mapping:
 *
 *   type     "citation"
 *   citation the bibliographic string
 *   url      the DOI, or the source URL when there is no DOI
 *   display  the specific claim relied on, which is what a vet argues with
 *   label    the evidence grade, in words
 *
 * The attestation below is NOT part of it. `lastReviewedAt` / `reviewedBy` /
 * `nextReviewDue` are this product's governance over its own rule table, not a
 * property of the cited artifact, and FHIR has no slot for them here. Keeping
 * them beside the artifact rather than inside it avoids overloading a standard
 * type with a local meaning.
 */
export interface RecommendationEvidence {
  artifact: RelatedArtifact;
  /** Kept discrete so a client can sort or filter without parsing the citation. */
  year: number;
  grade: string;
  attestation: {
    lastReviewedAt: Date | null;
    reviewedBy: string | null;
    nextReviewDue: Date | null;
  };
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
  evidence: RecommendationEvidence;
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

/** The three species the task library covers. */
type TaskSpecies = "dog" | "cat" | "horse";

/** `Patient.type` and `TaskLibrarySpecies` share three values; `other` has none. */
const TASK_SPECIES: Record<string, TaskSpecies | undefined> = {
  dog: "dog",
  cat: "cat",
  horse: "horse",
};

/**
 * Plain-language labels for the evidence grades.
 *
 * The citation is meant to be readable by the parent looking at the card, and
 * `CONSENSUS_STATEMENT` is not that. The raw enum is kept alongside so a client
 * can still sort or filter on it without parsing prose.
 */
const GRADE_LABELS: Record<string, string> = {
  CONSENSUS_STATEMENT: "Consensus statement",
  PRACTICE_GUIDELINE: "Practice guideline",
  POPULATION_STUDY: "Population study",
  COHORT_STUDY: "Cohort study",
  CASE_SERIES: "Case series",
  EXPERT_OPINION: "Expert opinion",
};

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

type LoadedPatient = {
  speciesCode: string | null;
  breedCode: string | null;
  dateOfBirth: Date | null;
  type: string;
};

type RuleWithDefinition = {
  id: string;
  breedCodes: string[];
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  taskDefinitionId: string;
  recommendationText: string;
  citationAuthors: string;
  citationTitle: string;
  citationSource: string;
  citationYear: number;
  citationDoi: string | null;
  citationUrl: string | null;
  citationClaim: string;
  evidenceGrade: string;
  lastReviewedAt: Date | null;
  reviewedBy: string | null;
  nextReviewDue: Date | null;
  taskDefinition: {
    id: string;
    name: string;
    category: string;
    isActive: boolean;
    applicableSpecies: string[];
  };
};

/**
 * Which species' rules apply, or null when that cannot be answered safely.
 *
 * `speciesCode` first, `type` as the fallback. They carry the same three
 * species, but `speciesCode` is optional and null on 30 of 37 production
 * companions while `type` is required, so reading only the coded column
 * returned nothing for four companions in five until the backfill ran. This is
 * a fallback between two RECORDED values - `type` is what the parent picked -
 * not an inference from free text, which is still not done.
 *
 * When both are present and disagree the answer is null. The companion's data
 * is inconsistent, and choosing either would serve guidance for the wrong
 * animal on exactly the rows already known to be wrong. Nothing upstream
 * enforces agreement: validateCompanionCodes checks that each code is valid,
 * not that the two describe one species.
 */
const resolveSpecies = (patient: LoadedPatient): TaskSpecies | null => {
  const coded = taskSpeciesForCode(patient.speciesCode);
  const declared = TASK_SPECIES[patient.type];
  if (coded && declared && coded !== declared) return null;
  return coded ?? declared ?? null;
};

/** Whether a rule applies to this companion. Every clause is a reason to say no. */
const appliesTo = (
  rule: RuleWithDefinition,
  species: TaskSpecies,
  ageMonths: number,
  patientBreed: string | null,
): boolean => {
  // A blank reviewer is not a signature. The column is a nullable string, so ""
  // and "   " both satisfy a NOT NULL check while naming nobody, and this is the
  // gate that keeps unreviewed clinical guidance away from pet parents.
  if ((rule.reviewedBy ?? "").trim().length === 0) return false;

  if (!rule.taskDefinition?.isActive) return false;

  // An EMPTY applicableSpecies means universal, not "applies to nothing" -
  // taskLibrary.service.ts matches `{ isEmpty: true }` alongside
  // `{ has: species }` for that reason. Reading empty as a mismatch would
  // silently drop every universal task.
  const scope = rule.taskDefinition.applicableSpecies;
  if (scope.length > 0 && !scope.includes(species)) return false;

  if (!withinWindow(ageMonths, rule.minAgeMonths, rule.maxAgeMonths))
    return false;

  // No breed codes means species-wide - the life-stage tasks most animals get.
  // Otherwise the companion's breed has to appear, compared canonically because
  // the vocabulary holds both separator conventions.
  if (rule.breedCodes.length === 0) return true;
  if (!patientBreed) return false;
  return rule.breedCodes.some(
    (code) => canonicalBreedCode(code) === patientBreed,
  );
};

const toRecommendation = (
  rule: RuleWithDefinition,
  species: TaskSpecies,
  ageMonths: number,
  patientBreed: string | null,
): CompanionRecommendation => ({
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
    ageMonths,
  },
  evidence: {
    artifact: {
      type: "citation",
      label: GRADE_LABELS[rule.evidenceGrade] ?? rule.evidenceGrade,
      display: rule.citationClaim,
      citation: `${rule.citationAuthors}. ${rule.citationTitle}. ${rule.citationSource}. ${rule.citationYear}.`,
      url:
        rule.citationUrl ??
        (rule.citationDoi ? `https://doi.org/${rule.citationDoi}` : undefined),
    },
    year: rule.citationYear,
    grade: rule.evidenceGrade,
    attestation: {
      lastReviewedAt: rule.lastReviewedAt,
      reviewedBy: rule.reviewedBy,
      nextReviewDue: rule.nextReviewDue,
    },
  },
});

export const TaskRecommendationService = {
  async forCompanion(patientId: string): Promise<CompanionRecommendation[]> {
    const id = patientId?.trim();
    if (!id) {
      throw new TaskRecommendationError("Companion id is required.", 400);
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      select: {
        speciesCode: true,
        breedCode: true,
        dateOfBirth: true,
        type: true,
      },
    });
    if (!patient) {
      throw new TaskRecommendationError("Companion not found.", 404);
    }

    const species = resolveSpecies(patient);
    if (!species) return [];

    const ageMonths = ageInMonths(patient.dateOfBirth, new Date());
    if (ageMonths === null) return [];

    const rules = await prisma.taskRecommendationRule.findMany({
      where: {
        species,
        isActive: true,
        // Both conditions, not just isActive. A rule reaches a pet parent only
        // once a named reviewer has signed it off; an active-but-unreviewed row
        // is a seeding accident, not a recommendation. `appliesTo` rejects a
        // blank name, which this predicate cannot.
        reviewedBy: { not: null },
      },
      include: {
        taskDefinition: {
          select: {
            id: true,
            name: true,
            category: true,
            isActive: true,
            applicableSpecies: true,
          },
        },
      },
    });

    const patientBreed = canonicalBreedCode(patient.breedCode);

    return rules
      .filter((rule: RuleWithDefinition) =>
        appliesTo(rule, species, ageMonths, patientBreed),
      )
      .map((rule: RuleWithDefinition) =>
        toRecommendation(rule, species, ageMonths, patientBreed),
      );
  },
};
