import { Form, FormSubmission } from "@yosemite-crew/types";

export type AppointmentFormEntry = {
  form: Form;
  submission: FormSubmission | null;
  status: "completed" | "pending";
};

export type AppointmentFormsResponse = {
  appointmentId: string;
  forms: AppointmentFormEntry[];
};
