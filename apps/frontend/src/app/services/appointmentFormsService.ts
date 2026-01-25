import { getData } from "@/app/services/axios";
import {
  Form,
  FormSubmission,
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
} from "@yosemite-crew/types";
import { AppointmentFormsResponse } from "@/app/types/appointmentForms";
import { FormField } from "@/app/types/forms";

type AppointmentFormsApiItem = {
  questionnaire: any;
  questionnaireResponse?: any;
  status?: string;
};

type AppointmentFormsApiResponse = {
  appointmentId: string;
  items: AppointmentFormsApiItem[];
};

const inferFieldType = (item: any): FormField["type"] => {
  const ans = (item.answer ?? [])[0];
  if (ans?.valueBoolean !== undefined) return "boolean";
  if (ans?.valueDate !== undefined || ans?.valueDateTime !== undefined) return "date";
  if (ans?.valueAttachment !== undefined) return "signature";
  return "input";
};

const buildFallbackForm = (qr: any): { form: Form; submission: FormSubmission } => {
  const firstItemText =
    Array.isArray(qr.item) && qr.item.length > 0
      ? qr.item.find((it: any) => typeof it?.text === "string")?.text
      : undefined;

  const schema: FormField[] = (qr.item ?? []).map((it: any, idx: number) => ({
    id: it.linkId || `field_${idx}`,
    label: it.text || it.linkId || `Field ${idx + 1}`,
    type: inferFieldType(it),
  }));

  const formId =
    (qr.questionnaire && String(qr.questionnaire).split("/").pop()) ||
    qr.id ||
    `form-${Date.now()}`;
  const fallbackName =
    qr.title || firstItemText || "Form submission";

  const form: Form = {
    _id: formId,
    orgId: "",
    name: fallbackName,
    category: "Custom",
    description: qr.description,
    visibilityType: "Internal",
    schema,
    status: "published",
    createdBy: "",
    updatedBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const submission = fromFormSubmissionRequestDTO(qr as any, schema);

  return { form, submission };
};

const mapItem = (
  item: AppointmentFormsApiItem,
): { form: Form; submission: FormSubmission | null; status: "completed" | "pending" } | null => {
  try {
    const form = fromFormRequestDTO(item.questionnaire);
    const submission = item.questionnaireResponse
      ? fromFormSubmissionRequestDTO(item.questionnaireResponse, form.schema)
      : null;
    const status = submission ? "completed" : "pending";
    return { form, submission, status };
  } catch (err) {
    try {
      if (item.questionnaireResponse) {
        const { form, submission } = buildFallbackForm(item.questionnaireResponse);
        return { form, submission, status: "completed" };
      }
    } catch (fallbackErr) {
      console.error("Skipping invalid appointment form item", fallbackErr, item);
    }
    return null;
  }
};

export const fetchAppointmentForms = async (appointmentId: string): Promise<AppointmentFormsResponse> => {
  const res = await getData<AppointmentFormsApiResponse>(
    `/fhir/v1/form/appointments/${appointmentId}/forms`,
    { isPMS: true },
  );
  const forms = (res.data.items ?? [])
    .map(mapItem)
    .filter((x): x is NonNullable<ReturnType<typeof mapItem>> => x !== null);
  return { appointmentId: res.data.appointmentId, forms };
};
