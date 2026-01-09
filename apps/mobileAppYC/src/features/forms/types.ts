import type {Form, FormSubmission} from '@yosemite-crew/types';

export type FormSource = 'appointment' | 'service' | 'soap';

export type AppointmentFormStatus =
  | 'not_started'
  | 'submitted'
  | 'signing'
  | 'signed'
  | 'completed';

export interface AppointmentFormEntry {
  form: Form;
  formVersion?: number;
  submission?: FormSubmission | null;
  status: AppointmentFormStatus;
  signingRequired: boolean;
  signingUrl?: string | null;
  source: FormSource;
  soapSection?: string;
}

export interface AppointmentFormsState {
  byAppointmentId: Record<string, AppointmentFormEntry[]>;
  loadingByAppointment: Record<string, boolean>;
  submittingByForm: Record<string, boolean>;
  signingBySubmission: Record<string, boolean>;
  error: string | null;
  formsCache: Record<string, Form>;
}
