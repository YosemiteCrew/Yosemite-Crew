import {
  FormSubmission,
  toFormSubmissionResponseDTO,
} from "@yosemite-crew/types";
import { getData, postData } from "@/app/services/axios";
import { GetSOAPResponse } from "@/app/features/appointments/types/soap";
import { logger } from "@/app/lib/logger";

export const createSubmission = async (
  submission: FormSubmission
): Promise<FormSubmission> => {
  try {
    const fhirSubmission = toFormSubmissionResponseDTO(submission);
    const res = await postData<FormSubmission>(
      "/fhir/v1/form/admin/" + submission.formId + "/submit",
      fhirSubmission
    );
    const data = res.data;
    return data;
  } catch (err) {
    logger.error("Failed to create appointment submission", err);
    throw err;
  }
};

export const fetchSubmissions = async (
  appointmentId: string
): Promise<GetSOAPResponse> => {
  try {
    if (!appointmentId) {
      throw new Error("Appointment Id is required");
    }
    const res = await getData<GetSOAPResponse>(
      "fhir/v1/form/appointments/" + appointmentId + "/soap-notes"
    );
    const data = res.data;
    return data;
  } catch (err) {
    logger.error("Failed to fetch SOAP submissions", err);
    throw err;
  }
};
