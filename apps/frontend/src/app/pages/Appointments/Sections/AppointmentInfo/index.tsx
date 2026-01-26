import Labels from "@/app/components/Labels/Labels";
import Modal from "@/app/components/Modal";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Summary from "./Finance/Summary";
import Task from "./Tasks/Task";
import AppointmentInfo from "./Info/AppointmentInfo";
import Companion from "./Info/Companion";
import History from "./Info/History";
import Subjective from "./Prescription/Subjective";
import Objective from "./Prescription/Objective";
import Assessment from "./Prescription/Assessment";
import Chat from "./Tasks/Chat";
import Details from "./Finance/Details";
import Documents from "./Prescription/Documents";
import Discharge from "./Prescription/Discharge";
import Audit from "./Prescription/Audit";
import Plan from "./Prescription/Plan";
import {
  Appointment,
  FormSubmission,
  InvoiceItem,
  Service,
} from "@yosemite-crew/types";
import { fetchSubmissions } from "@/app/services/soapService";
import Close from "@/app/components/Icons/Close";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";
import { fetchAppointmentForms } from "@/app/services/appointmentFormsService";
import { useOrgStore } from "@/app/stores/orgStore";
import { AppointmentFormEntry } from "@/app/types/appointmentForms";
import { FormField } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import { useFormsStore } from "@/app/stores/formsStore";
import { useLoadFormsForPrimaryOrg } from "@/app/hooks/useForms";
import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import { SoapNoteSubmission } from "@/app/types/soap";
import SignatureActions from "./Prescription/Submissions/SignatureActions";
import { hasSignatureField } from "./Prescription/signatureUtils";
import { useServiceStore } from "@/app/stores/serviceStore";
import { humanizeKey } from "./Prescription/labelUtils";
import SigningOverlay from "@/app/components/SigningOverlay";
import ParentTask from "./Tasks/ParentTask";
import { useServicesForPrimaryOrgSpecialities } from "@/app/hooks/useSpecialities";
import { useSigningOverlayStore } from "@/app/stores/signingOverlayStore";

const formatValue = (
  field: FormField,
  value: any,
  submission?: FormSubmission,
  servicesById?: Record<string, any>,
): string => {
  const resolveService = (val: string): string | undefined => {
    if (!servicesById) return undefined;
    return servicesById[val]?.name || servicesById[val]?.displayName;
  };

  if (value === undefined || value === null) return "—";
  if (field.type === "signature") {
    const isSigned =
      submission?.signing?.status === "SIGNED" ||
      Boolean(submission?.signing?.pdf?.url);
    return isSigned ? "Signed" : "Not signed";
  }
  if (field.type === "date" || (field.type as string) === "time") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return `${value}`;
    return (field.type as string) === "time" ? d.toLocaleTimeString() : d.toLocaleDateString();
  }
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const mapped = value
      .map((v) => resolveService(String(v)) ?? `${v}`)
      .filter(Boolean)
      .join(", ");
    return mapped || "—";
  }
  const serviceName = typeof value === "string" ? resolveService(value) : undefined;
  if (serviceName) return serviceName;
  if (typeof value === "object") {
    if (Object.keys(value ?? {}).length === 0) return "—";
    return JSON.stringify(value);
  }
  return `${value}`;
};

const resolveLabel = (field: FormField): string => {
  const id = field.id ?? "";
  const rawLabel = field.label ?? "";
  const normalizedId = id.toLowerCase();

  const isServicesField = normalizedId.endsWith("services");

  const humanized = humanizeKey(id);
  const cleanedLabel =
    rawLabel && rawLabel !== id ? rawLabel : isServicesField ? "Services" : humanized;

  return cleanedLabel || humanized;
};

const flattenFields = (fields: FormField[]): FormField[] =>
  fields.flatMap((f) => (f.type === "group" && f.fields ? flattenFields(f.fields as FormField[]) : [f]));

const CustomFormsView = ({
  forms,
  loading,
  error,
  canEdit,
  activeAppointment,
  onSubmission,
  templates,
  onSubmissionUpdate,
}: {
  forms: AppointmentFormEntry[];
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  activeAppointment: Appointment | null;
  onSubmission?: (entry: AppointmentFormEntry) => void;
  templates: { value: string; label: string; schema: FormField[]; form: any }[];
  onSubmissionUpdate?: (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean },
  ) => void;
}) => {
  const attributes = useAuthStore.getState().attributes;
  const servicesById = useServiceStore((s) => s.servicesById);
  const [valuesByForm, setValuesByForm] = useState<Record<string, Record<string, any>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState<string>("");

  if (loading) {
    return <div className="text-body-3 text-text-primary">Loading forms…</div>;
  }
  if (error) {
    return <div className="text-body-3 text-error-main">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {canEdit ? (
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search form templates"
            options={templates.map((t) => ({ value: t.value, label: t.label }))}
            onSelect={(id) => {
              const match = templates.find((t) => t.value === id);
              setSelectedTemplateId(id);
              setSelectedTemplateLabel(match?.label ?? id);
            }}
            query={selectedTemplateLabel}
            setQuery={(val) => setSelectedTemplateLabel(val)}
            minChars={0}
          />
          {selectedTemplateId ? (
            <div className="border border-card-border rounded-2xl p-4">
              <FormRenderer
                fields={templates.find((t) => t.value === selectedTemplateId)?.schema ?? []}
                values={
                  valuesByForm[selectedTemplateId] ??
                  buildInitialValues(templates.find((t) => t.value === selectedTemplateId)?.schema ?? [])
                }
                onChange={(id, value) =>
                  setValuesByForm((prev) => ({
                    ...prev,
                    [selectedTemplateId]: {
                      ...(prev[selectedTemplateId] ??
                        buildInitialValues(templates.find((t) => t.value === selectedTemplateId)?.schema ?? [])),
                      [id]: value,
                    },
                  }))
                }
                readOnly={false}
              />
            </div>
          ) : null}
          {selectedTemplateId ? (
            <Primary
              href="#"
              text={submittingId === selectedTemplateId ? "Saving..." : "Save"}
              onClick={async () => {
                if (!activeAppointment?.id || !attributes?.sub || !selectedTemplateId) return;
                setSubmitError(null);
                setSubmittingId(selectedTemplateId);
                const template = templates.find((t) => t.value === selectedTemplateId);
                if (!template) {
                  setSubmitError("Template not found");
                  setSubmittingId(null);
                  return;
                }
                try {
                  const requiresSignature = hasSignatureField(
                    template.schema as FormField[],
                  );
                  const submission: FormSubmission = {
                    _id: "",
                    formVersion: 1,
                    submittedAt: new Date(),
                    formId: template.value,
                    appointmentId: activeAppointment.id,
                    companionId: (activeAppointment as any).companion?.id ?? "",
                    parentId: (activeAppointment as any).companion?.parent?.id ?? "",
                    answers: valuesByForm[selectedTemplateId] ?? buildInitialValues(template.schema),
                    submittedBy: attributes.sub,
                  };
                  const created = await createSubmission(submission);
                  const submissionWithSigning = requiresSignature
                    ? {
                        ...created,
                        signatureRequired: true,
                        signing:
                          created.signing ?? {
                            required: true,
                            status: "NOT_STARTED",
                            provider: "DOCUMENSO",
                          },
                      }
                    : created;
                  onSubmission?.({
                    form: template.form,
                    submission: submissionWithSigning,
                    status: "completed",
                  });
                  setSelectedTemplateId("");
                  setSelectedTemplateLabel("");
                } catch (e) {
                  console.error("Failed to submit form", e);
                  setSubmitError("Failed to submit form. Please try again.");
                } finally {
                  setSubmittingId(null);
                }
              }}
            />
          ) : null}
        </div>
      ) : null}

      {forms.map((entry, idx) => {
        const flat = flattenFields(entry.form.schema as FormField[]);
        const answers = entry.submission?.answers ?? {};
        const signatureRequired = hasSignatureField(entry.form.schema as FormField[]);
        const formId = entry.form._id ?? entry.form.name;
        const formValues =
          valuesByForm[formId] ??
          buildInitialValues((entry.form.schema as FormField[]) ?? []);
        const key = entry.submission?._id ?? `${formId}-${idx}`;
        const submissionWithMeta = entry.submission
          ? ({
              ...entry.submission,
              signatureRequired,
            } satisfies FormSubmission & { signatureRequired?: boolean })
          : null;
        return (
          <Accordion
            key={key}
            title={entry.form.name}
            defaultOpen={idx === 0}
            showEditIcon={false}
            isEditing
            rightElement={
              (() => {
                const signingStatus = submissionWithMeta?.signing?.status;
                const needsSignature = submissionWithMeta?.signatureRequired;
                const isSigned = signingStatus === "SIGNED";
                const isCompleted = entry.status === "completed" && (!needsSignature || isSigned);
                const label = isCompleted
                  ? "Completed"
                  : needsSignature && !isSigned
                    ? "Signature Pending"
                    : "Pending";
                const badgeClass = isCompleted
                  ? "bg-green-50 text-green-800"
                  : "bg-amber-50 text-amber-700";
                return (
                  <span className={`text-label-xsmall px-2 py-1 rounded ${badgeClass}`}>
                    {label}
                  </span>
                );
              })()
            }
          >
            {entry.submission ? (
              <div className="border border-card-border rounded-2xl p-4 flex flex-col gap-2">
                {flat.map((field) => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <div className="text-body-4 text-text-secondary">
                      {resolveLabel(field)}
                    </div>
                    <div className="text-body-3 text-text-primary">
                      {formatValue(
                        field,
                        (answers as any)[field.id],
                        submissionWithMeta ?? undefined,
                        servicesById,
                      )}
                    </div>
                  </div>
                ))}
                {submissionWithMeta?.signatureRequired ? (
                  <SignatureActions
                    submission={submissionWithMeta}
                    onStatusChange={(submissionId, updates) =>
                      onSubmissionUpdate?.(submissionId, updates)
                    }
                  />
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="border border-card-border rounded-2xl p-4">
                  <FormRenderer
                    fields={entry.form.schema ?? []}
                    values={formValues}
                    onChange={(id, value) =>
                      setValuesByForm((prev) => ({
                        ...prev,
                        [formId]: { ...(prev[formId] ?? formValues), [id]: value },
                      }))
                    }
                    readOnly={!canEdit}
                  />
                </div>
                {canEdit && (
                  <Primary
                    href="#"
                    text={submittingId === formId ? "Saving..." : "Save"}
                    onClick={async () => {
                      if (!activeAppointment?.id || !attributes?.sub) return;
                      setSubmitError(null);
                      setSubmittingId(formId);
                      try {
                        const requiresSignature = signatureRequired;
                        const submission: FormSubmission = {
                          _id: "",
                          formVersion: entry.submission?.formVersion ?? 1,
                          submittedAt: new Date(),
                          formId: entry.form._id,
                          appointmentId: activeAppointment.id,
                          companionId: (activeAppointment as any).companion?.id ?? "",
                          parentId: (activeAppointment as any).companion?.parent?.id ?? "",
                          answers: valuesByForm[formId] ?? formValues,
                          submittedBy: attributes.sub,
                        };
                        const created = await createSubmission(submission);
                        const submissionWithSigning = requiresSignature
                          ? {
                              ...created,
                              signatureRequired: true,
                              signing:
                                created.signing ?? {
                                  required: true,
                                  status: "NOT_STARTED",
                                  provider: "DOCUMENSO",
                                },
                            }
                          : created;
                        onSubmission?.({
                          form: entry.form,
                          submission: submissionWithSigning,
                          status: "completed",
                        });
                      } catch (e) {
                        console.error("Failed to submit form", e);
                        setSubmitError("Failed to submit form. Please try again.");
                      } finally {
                        setSubmittingId(null);
                      }
                    }}
                  />
                )}
              </div>
            )}
          </Accordion>
        );
      })}
      {forms.length === 0 ? (
        <Accordion
          title="Previous form submissions"
          defaultOpen
          showEditIcon={false}
          isEditing
        >
          <div className="text-body-3 text-text-secondary">No past form submissions.</div>
        </Accordion>
      ) : null}
      {submitError ? <div className="text-error-main text-body-4">{submitError}</div> : null}
    </div>
  );
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v == null) return 0;
  return 0;
};

const getTaxPercent = (activeAppointment: Appointment | null): number => {
  return 0;
};

type AppoitmentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment | null;
};

export type ServiceEdit = Service & {
  discount: string;
};

export type FormDataProps = {
  subjective: SoapNoteSubmission[];
  objective: SoapNoteSubmission[];
  assessment: SoapNoteSubmission[];
  discharge: SoapNoteSubmission[];
  plan: SoapNoteSubmission[];
  total: string;
  subTotal: string;
  tax: string;
  discount: string;
  lineItems: InvoiceItem[];
};

export const createEmptyFormData = (): FormDataProps => ({
  subjective: [],
  objective: [],
  assessment: [],
  discharge: [],
  plan: [],
  total: "",
  discount: "",
  subTotal: "",
  tax: "",
  lineItems: [],
});

type LabelKey = "info" | "prescription" | "care" | "tasks" | "finance";
type SubLabelKey = string;

const hospitalLabels = [
  {
    key: "info",
    name: "Info",
    labels: [
      { key: "appointment", name: "Appointment" },
      { key: "companion", name: "Companion" },
      { key: "history", name: "History" },
    ],
  },
  {
    key: "prescription",
    name: "Prescription",
    labels: [
      { key: "subjective", name: "Subjective" },
      { key: "objective", name: "Objective" },
      { key: "assessment", name: "Assessment" },
      { key: "plan", name: "Plan" },
      { key: "audit-trail", name: "Audit trail" },
      { key: "discharge-summary", name: "Discharge summary" },
      { key: "forms", name: "Forms" },
      { key: "documents", name: "Documents" },
    ],
  },
  {
    key: "tasks",
    name: "Tasks",
    labels: [
      { key: "parent-chat", name: "Companion parent chat" },
      { key: "task", name: "Task" },
      { key: "parent-task", name: "Parent task" },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    labels: [
      { key: "summary", name: "Summary" },
      { key: "payment-details", name: "Payment details" },
    ],
  },
];

const AppoitmentInfo = ({
  showModal,
  setShowModal,
  activeAppointment,
}: AppoitmentInfoProps) => {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.PRESCRIPTION_EDIT_OWN);
  const services = useServicesForPrimaryOrgSpecialities();
  const [activeLabel, setActiveLabel] = useState<LabelKey>(hospitalLabels[0].key as LabelKey);
  const [activeSubLabel, setActiveSubLabel] = useState<SubLabelKey>(
    hospitalLabels[0].labels[0].key,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [customForms, setCustomForms] = useState<AppointmentFormEntry[]>([]);
  const [customFormsLoading, setCustomFormsLoading] = useState(false);
  const [customFormsError, setCustomFormsError] = useState<string | null>(null);
  const updateCustomFormSubmission = (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean },
  ) => {
    setCustomForms((prev) =>
      prev.map((entry) =>
        entry.submission?._id === submissionId ||
        (entry.submission as any)?.submissionId === submissionId
          ? { ...entry, submission: { ...entry.submission!, ...updates } as FormSubmission }
          : entry,
      ),
    );
  };

  const orgsById = useOrgStore((s) => s.orgsById);
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE;
  const orgType =
    (orgTypeOverride as any) ||
    (activeAppointment?.organisationId &&
      orgsById[activeAppointment.organisationId]?.type) ||
    "HOSPITAL";
  const formsById = useFormsStore((s) => s.formsById);
  useLoadFormsForPrimaryOrg();
  const formIds = useFormsStore((s) => s.formIds);
  const allForms = formIds.map((id) => formsById[id]).filter(Boolean);
  const signingOverlayOpen = useSigningOverlayStore((s) => s.open);
  const templatesForOrg = useMemo(() => {
    const trimPrefix = (text?: string | null) => (text ?? "").replace(/^(Boarder|Breeder|Groomer)\s*-\s*/i, "");
    const matchesAllowed = (category: string, allowed: string[]) => {
      const normalized = trimPrefix(category);
      return allowed.includes(category) || allowed.includes(normalized);
    };
    const allowedCategories =
      orgType === "HOSPITAL"
        ? ["Discharge", "Consent form", "Custom"]
        : orgType === "BOARDER"
          ? ["Boarding Checklist", "Dietary Plan", "Medication Details", "Daily Summary", "Schedule", "Belongings", "Consent form", "Discharge"]
          : orgType === "BREEDER"
            ? ["Health & Behavior", "Mating Log", "Consultation & Planning", "Mating & Fertility Preferences", "Belongings", "Check-in", "Pregnancy Care", "Health Summary", "Consent form", "Discharge"]
            : ["Service Request & Preferences", "Grooming Prep", "Bathing & Cleaning Worklog", "Haircut / Styling Worklog", "Spa Add-ons Worklog", "Health Requirements", "Consent form", "Discharge"];
    return allForms
      .filter((f) => matchesAllowed(f.category, allowedCategories))
      .map((f) => ({
        value: f._id ?? f.name,
        label: trimPrefix(f.name),
        schema: f.schema as FormField[],
        form: f,
      }));
  }, [allForms, orgType]);

  const labels = orgType === "HOSPITAL"
    ? hospitalLabels
    : [
        hospitalLabels[0],
        {
          key: "care",
          name: "Care plan",
          labels: [
            { key: "forms", name: "Forms" },
            { key: "audit-trail", name: "Audit trail" },
            { key: "discharge-summary", name: "Discharge summary" },
            { key: "documents", name: "Documents" },
          ],
        },
        hospitalLabels[2],
        hospitalLabels[3],
      ];

  const COMPONENT_MAP: Record<string, Record<string, React.FC<any>>> = {
    info: {
      appointment: AppointmentInfo,
      companion: Companion,
      history: History,
    },
    prescription: {
      subjective: Subjective,
      objective: Objective,
      assessment: Assessment,
      plan: Plan,
      "audit-trail": Audit,
      "discharge-summary": Discharge,
      forms: (props: any) => (
        <CustomFormsView
          forms={customForms}
          loading={customFormsLoading}
          error={customFormsError}
          canEdit={canEdit}
          activeAppointment={activeAppointment}
          onSubmission={(entry) =>
            setCustomForms((prev) => {
              const existsIdx = prev.findIndex(
                (e) => (e.form._id ?? e.form.name) === (entry.form._id ?? entry.form.name),
              );
              if (existsIdx === -1) {
                return [entry, ...prev];
              }
              const next = [...prev];
              next[existsIdx] = entry;
              return next;
            })
          }
          templates={templatesForOrg}
          onSubmissionUpdate={updateCustomFormSubmission}
          {...props}
        />
      ),
      documents: Documents,
    },
    care: {
      forms: (props: any) => (
        <CustomFormsView
          forms={customForms}
          loading={customFormsLoading}
          error={customFormsError}
          canEdit={canEdit}
          activeAppointment={activeAppointment}
          onSubmission={(entry) =>
            setCustomForms((prev) => {
              const existsIdx = prev.findIndex(
                (e) => (e.form._id ?? e.form.name) === (entry.form._id ?? entry.form.name),
              );
              if (existsIdx === -1) {
                return [entry, ...prev];
              }
              const next = [...prev];
              next[existsIdx] = entry;
              return next;
            })
          }
          templates={templatesForOrg}
          onSubmissionUpdate={updateCustomFormSubmission}
          {...props}
        />
      ),
      documents: Documents,
      "audit-trail": Audit,
      "discharge-summary": Discharge,
    },
    tasks: {
      "parent-chat": Chat,
      task: Task,
      "parent-task": ParentTask,
    },
    finance: {
      summary: Summary,
      "payment-details": Details,
    },
  };

  const Content = COMPONENT_MAP[activeLabel]?.[activeSubLabel];
  const [formData, setFormData] = useState<FormDataProps>(
    createEmptyFormData(),
  );

  const loadAppointmentForms = useCallback(async () => {
    if (!activeAppointment?.id) {
      setCustomForms([]);
      setCustomFormsError(null);
      setCustomFormsLoading(false);
      return;
    }
    setCustomFormsLoading(true);
    setCustomFormsError(null);
    try {
      const res = await fetchAppointmentForms(activeAppointment.id);
      setCustomForms(res.forms);
    } catch (e) {
      setCustomFormsError("Unable to load forms");
      setCustomForms([]);
    } finally {
      setCustomFormsLoading(false);
    }
  }, [activeAppointment?.id, orgType]);

  const resolveAppointmentFormEntry = useCallback(
    (submission: SoapNoteSubmission | FormSubmission | undefined) => {
      if (!submission) return undefined;
      const submissionId = submission._id || (submission as SoapNoteSubmission).submissionId;
      if (submissionId) {
        return customForms.find((entry) => {
          const entryId =
            entry.submission?._id || (entry.submission as SoapNoteSubmission | undefined)?.submissionId;
          return entryId && String(entryId) === String(submissionId);
        });
      }
      if (submission.formId) {
        return customForms.find((entry) => entry.submission?.formId === submission.formId);
      }
      return undefined;
    },
    [customForms],
  );

  const withSignatureMeta = useCallback(
    (submissions: SoapNoteSubmission[] | FormSubmission[] | undefined): SoapNoteSubmission[] => {
      if (!submissions?.length) return [];
      return submissions.map((sub) => {
        const matchedEntry = resolveAppointmentFormEntry(sub);
        const matchedSubmission = matchedEntry?.submission;
        const form = formsById[sub.formId] ?? matchedEntry?.form;
        const schemaHasSignature = hasSignatureField((form?.schema as FormField[]) ?? []);
        const mergedSigning = matchedSubmission?.signing ?? sub.signing;
        const requiresSignature =
          (sub as SoapNoteSubmission).signatureRequired ??
          mergedSigning?.required ??
          schemaHasSignature;
        const signing =
          requiresSignature ||
          mergedSigning?.status ||
          mergedSigning?.pdf?.url ||
          mergedSigning?.documentId
            ? mergedSigning ?? {
                required: true,
                status: "NOT_STARTED",
                provider: "DOCUMENSO",
              }
            : undefined;
        return {
          ...(sub as SoapNoteSubmission),
          signatureRequired: requiresSignature,
          signing,
        };
      });
    },
    [formsById, resolveAppointmentFormEntry],
  );

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (!current) {
      setActiveLabel(labels[0].key as LabelKey);
      setActiveSubLabel(labels[0].labels[0].key as SubLabelKey);
      return;
    }
    const sub = current.labels.find((l) => l.key === activeSubLabel);
    if (!sub) {
      setActiveSubLabel(current.labels[0].key as SubLabelKey);
    }
  }, [labels, activeLabel, activeSubLabel]);

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (current && current.labels.length > 0) {
      setActiveSubLabel(current.labels[0].key);
    }
  }, [activeLabel]);

  useEffect(() => {
    const appointmentId = activeAppointment?.id;
    if (!appointmentId) return;

    setFormData((prev) => {
      const itemsSubTotal = (prev.lineItems ?? []).reduce(
        (sum, li) => sum + toNumber(li.total),
        0,
      );
      const serviceId = activeAppointment?.appointmentType?.id;
      const service = services.find((s) => s.id === serviceId);
      const serviceCost = service ? toNumber(service.cost) : 0;
      const subTotal = itemsSubTotal + serviceCost;
      const taxPercent = getTaxPercent(activeAppointment);
      const taxTotal = (subTotal * taxPercent) / 100;
      const total = subTotal + taxTotal;
      return {
        ...prev,
        subTotal: String(subTotal),
        tax: String(taxTotal),
        total: String(total),
      };
    });
  }, [
    activeAppointment?.id,
    activeAppointment?.appointmentType?.id,
    services,
    formData.lineItems,
  ]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const appointmentId = activeAppointment?.id;
      if (!appointmentId) {
        setFormData(createEmptyFormData());
        return;
      }
      try {
        const soap = await fetchSubmissions(appointmentId);
        console.log(soap)
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          subjective: withSignatureMeta(soap?.soapNotes?.Subjective),
          objective: withSignatureMeta(soap?.soapNotes?.Objective),
          assessment: withSignatureMeta(soap?.soapNotes?.Assessment),
          plan: withSignatureMeta(soap?.soapNotes?.Plan),
          discharge: withSignatureMeta(soap?.soapNotes?.Discharge),
          // not present in GetSOAPResponse, keep as-is / empty
          total: prev.total ?? "",
          subTotal: prev.subTotal ?? "",
          tax: prev.tax ?? "",
          discount: prev.discount ?? "",
        }));
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to fetch submissions:", e);
        setFormData(createEmptyFormData());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeAppointment?.id, orgType, withSignatureMeta]);

  useEffect(() => {
    void loadAppointmentForms();
  }, [loadAppointmentForms]);

  useEffect(() => {
    // When signing overlay closes, refresh forms so signature status updates without a full page reload.
    if (signingOverlayOpen) return;
    void loadAppointmentForms();
  }, [signingOverlayOpen, loadAppointmentForms]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      subjective: withSignatureMeta(prev.subjective),
      objective: withSignatureMeta(prev.objective),
      assessment: withSignatureMeta(prev.assessment),
      plan: withSignatureMeta(prev.plan),
      discharge: withSignatureMeta(prev.discharge),
    }));
  }, [formsById, customForms, withSignatureMeta]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLabel, activeSubLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <SigningOverlay />
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex justify-center items-center gap-2">
              <Image
                alt="pet image"
                src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
                className="rounded-full"
                height={40}
                width={40}
              />
              <div className="text-body-1 text-text-primary">
                {activeAppointment?.companion.name}
              </div>
              <div className="text-body-4 text-text-primary mt-1">
                {activeAppointment?.companion.breed}
              </div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          <Labels
            labels={labels}
            activeLabel={activeLabel}
            setActiveLabel={setActiveLabel}
            activeSubLabel={activeSubLabel}
            setActiveSubLabel={setActiveSubLabel}
          />
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-y-auto flex-1 scrollbar-hidden"
        >
          {Content ? (
            <Content
              activeAppointment={activeAppointment}
              formData={formData}
              setFormData={setFormData}
              canEdit={canEdit}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default AppoitmentInfo;
