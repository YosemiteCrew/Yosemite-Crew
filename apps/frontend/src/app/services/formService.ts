import axios from "axios";
import { getData, postData, putData } from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { useFormsStore } from "@/app/stores/formsStore";
import { useAuthStore } from "@/app/stores/authStore";
import {
  buildFHIRPayload,
  mapFormToUI,
  mapQuestionnaireToUI,
} from "@/app/utils/forms";
import { FormsProps, FormsStatus } from "@/app/types/forms";
import {
  Form,
  FormRequestDTO,
  FormResponseDTO,
} from "@yosemite-crew/types";

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) {
    throw new Error("No primary organisation selected");
  }
  return orgId;
};

const resolveUserId = (): string => {
  const { attributes, user } = useAuthStore.getState();
  return attributes?.sub || user?.getUsername() || "web-admin";
};

const applyStatusToStore = (formId: string, status: FormsStatus) => {
  useFormsStore.getState().updateFormStatus(formId, status);
};

export const loadForms = async () => {
  const { setLoading, setForms, setError } = useFormsStore.getState();
  setLoading(true);
  try {
    const orgId = requireOrgId();
    const res = await getData<FormResponseDTO[]>(
      `/fhir/v1/form/admin/${orgId}/forms`
    );
    const forms = res.data.map(mapQuestionnaireToUI);
    setForms(forms);
    return forms;
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Failed to load forms";
    setError(message);
    throw err;
  } finally {
    setLoading(false);
  }
};

export const fetchForm = async (formId: string) => {
  const { upsertForm, setError } = useFormsStore.getState();
  try {
    const orgId = requireOrgId();
    const res = await getData<FormResponseDTO>(
      `/fhir/v1/form/admin/${orgId}/${formId}`
    );
    const form = mapQuestionnaireToUI(res.data);
    upsertForm(form);
    return form;
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Failed to fetch form";
    setError(message);
    throw err;
  }
};

const createForm = async (payload: FormRequestDTO, orgId: string) => {
  const res = await postData<FormResponseDTO>(
    `/fhir/v1/form/admin/${orgId}`,
    payload
  );
  return res.data;
};

const updateForm = async (
  formId: string,
  payload: FormRequestDTO,
  orgId: string
) => {
  const res = await putData<FormResponseDTO | Form>(
    `/fhir/v1/form/admin/${orgId}/${formId}`,
    payload
  );
  return res.data;
};

export const saveFormDraft = async (form: FormsProps) => {
  const { upsertForm, setError } = useFormsStore.getState();

  try {
    const orgId = form.orgId ?? requireOrgId();
    const userId = resolveUserId();
    const payload = buildFHIRPayload({
      form,
      orgId,
      userId,
      fallbackToTemplate: true,
    });

    const dto = form._id
      ? await updateForm(form._id, payload, orgId)
      : await createForm(payload, orgId);
    const normalized =
      (dto as any)?.resourceType === "Questionnaire"
        ? mapQuestionnaireToUI(dto as FormResponseDTO)
        : mapFormToUI(dto as Form);
    const normalizedWithId = normalized._id
      ? normalized
      : { ...normalized, _id: form._id };
    upsertForm(normalizedWithId);
    return normalizedWithId;
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Unable to save form";
    setError(message);
    throw err;
  }
};

export const publishForm = async (formId: string) => {
  try {
    await postData(`/fhir/v1/form/admin/${formId}/publish`);
    applyStatusToStore(formId, "Published");
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Unable to publish form";
    useFormsStore.getState().setError(message);
    throw err;
  }
};

export const unpublishForm = async (formId: string) => {
  try {
    await postData(`/fhir/v1/form/admin/${formId}/unpublish`);
    applyStatusToStore(formId, "Draft");
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Unable to unpublish form";
    useFormsStore.getState().setError(message);
    throw err;
  }
};

export const archiveForm = async (formId: string) => {
  try {
    await postData(`/fhir/v1/form/admin/${formId}/archive`);
    applyStatusToStore(formId, "Archived");
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message ?? err.message
      : "Unable to archive form";
    useFormsStore.getState().setError(message);
    throw err;
  }
};
