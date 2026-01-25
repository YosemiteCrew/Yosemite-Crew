import { getData } from "@/app/services/axios";
import {
  Form,
  FormSubmission,
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
} from "@yosemite-crew/types";
import { AppointmentFormsResponse } from "@/app/types/appointmentForms";

type AppointmentFormsApiItem = {
  questionnaire: any;
  questionnaireResponse?: any;
  status?: string;
};

type AppointmentFormsApiResponse = {
  appointmentId: string;
  items: AppointmentFormsApiItem[];
};

const mapItem = (item: AppointmentFormsApiItem): { form: Form; submission: FormSubmission | null; status: "completed" | "pending" } => {
  const form = fromFormRequestDTO(item.questionnaire);
  const submission = item.questionnaireResponse
    ? fromFormSubmissionRequestDTO(item.questionnaireResponse, form.schema)
    : null;
  const status = submission ? "completed" : "pending";
  return { form, submission, status };
};

export const fetchAppointmentForms = async (appointmentId: string): Promise<AppointmentFormsResponse> => {
  const res = await getData<AppointmentFormsApiResponse>(
    `/fhir/v1/form/appointments/${appointmentId}/forms`,
    { isPMS: true },
  );
  const forms = (res.data.items ?? []).map(mapItem);
  return { appointmentId: res.data.appointmentId, forms };
};
