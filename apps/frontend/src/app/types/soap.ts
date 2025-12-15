import { FormSubmission } from "@yosemite-crew/types";

export type GetSOAPResponse = {
  appointmentId: string;
  soapNotes: {
    Subjective: FormSubmission[];
    Objective: FormSubmission[];
    Assessment: FormSubmission[];
    Plan: FormSubmission[];
    Discharge: FormSubmission[];
  };
};
