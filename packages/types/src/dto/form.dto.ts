import { Questionnaire, QuestionnaireResponse } from "@yosemite-crew/fhirtypes";
import {
  Form,
  FormField,
  FormSubmission,
  fromFHIRQuestionnaire,
  fromFHIRQuestionnaireResponse,
  toFHIRQuestionnaire,
  toFHIRQuestionnaireResponse,
} from "../form";

export type FormRequestDTO = Questionnaire;
export type FormResponseDTO = Questionnaire;
export type FormSubmissionRequestDTO = QuestionnaireResponse;
export type FormSubmissionResponseDTO = QuestionnaireResponse;

export const fromFormRequestDTO = (dto: FormRequestDTO): Form => {
  if (dto?.resourceType !== "Questionnaire") {
    throw new Error("Invalid payload. Expected FHIR Questionnaire resource.");
  }

  return fromFHIRQuestionnaire(dto);
};

export const toFormResponseDTO = (form: Form): FormResponseDTO => {
  return toFHIRQuestionnaire(form);
};

export const fromFormSubmissionRequestDTO = (
  dto: FormSubmissionRequestDTO,
  schema?: FormField[]
): FormSubmission => {
  return fromFHIRQuestionnaireResponse(dto, schema);
};

export const toFormSubmissionResponseDTO = (
  submission: FormSubmission,
  schema?: FormField[]
): FormSubmissionResponseDTO => {
  return toFHIRQuestionnaireResponse(submission, schema);
};
