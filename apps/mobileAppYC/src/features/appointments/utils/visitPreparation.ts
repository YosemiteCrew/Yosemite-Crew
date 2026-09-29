import type {VisitPreparationDraft} from '../types';

export const composeVisitPreparationMessage = (
  draft: VisitPreparationDraft,
  observationLabel: string,
  questionLabel: string,
): string => {
  const sections: string[] = [];
  const observations = draft.observations.trim();
  const questions = draft.questions.trim();
  if (draft.includeObservations && observations) {
    sections.push(`${observationLabel}\n${observations}`);
  }
  if (draft.includeQuestions && questions) {
    sections.push(`${questionLabel}\n${questions}`);
  }
  return sections.join('\n\n');
};
