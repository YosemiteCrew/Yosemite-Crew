import { FormSubmission } from "@yosemite-crew/types";

export type GetSOAPResponse = {
    appointmentId: string;
    Subjective: FormSubmission[];
    Objective: FormSubmission[];
    Assessment: FormSubmission[];
    Plan: FormSubmission[];
}