import { Form, FormSubmission } from '@yosemite-crew/types';

export type AppointmentFormEntry = {
  form: Form;
  submission: FormSubmission | null;
  status: 'completed' | 'pending';
  /** The request sent to the pet parent for the form, where there is one. */
  assignmentId?: string;
  /** Where that request stands: sent, viewed, submitted, signed, cancelled or expired. */
  assignmentStatus?: string;
  /** Whether that request asks the pet parent to sign. */
  signingRequired?: boolean;
  /** Whether that request was sent to the pet parent's app. */
  mobileVisible?: boolean;
};

export type AppointmentFormsResponse = {
  appointmentId: string;
  forms: AppointmentFormEntry[];
};
