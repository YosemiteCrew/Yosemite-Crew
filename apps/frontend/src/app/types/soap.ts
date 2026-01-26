import { FormSubmission } from "@yosemite-crew/types";

export type SoapNoteSubmission = FormSubmission & {
  signatureRequired?: boolean;
  submissionId?: string;
  formName?: string;
  formCategory?: string;
};

export type GetSOAPResponse = {
  appointmentId: string;
  soapNotes: {
    Subjective: SoapNoteSubmission[];
    Objective: SoapNoteSubmission[];
    Assessment: SoapNoteSubmission[];
    Plan: SoapNoteSubmission[];
    Discharge: SoapNoteSubmission[];
  };
};
