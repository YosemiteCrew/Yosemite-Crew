import Labels from '@/app/ui/widgets/Labels/Labels';
import Modal from '@/app/ui/overlays/Modal';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Summary from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Summary';
import Task from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Task';
import AppointmentInfo from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo';
import Companion from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/Companion';
import History from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/History';
import Subjective from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective';
import Objective from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective';
import Assessment from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Assessment';
import Chat from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat';
import Details from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/Details';
import Documents from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents';
import Discharge from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Discharge';
import Audit from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit';
import Plan from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan';
import {
  Appointment,
  FormSubmission,
  InvoiceItem,
  Organisation,
  Service,
} from '@yosemite-crew/types';
import {
  createSubmission,
  fetchSubmissions,
} from '@/app/features/appointments/services/soapService';
import Close from '@/app/ui/primitives/Icons/Close';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { useOrgStore } from '@/app/stores/orgStore';
import { AppointmentFormEntry } from '@/app/features/appointments/types/appointmentForms';
import { FormField } from '@/app/features/forms/types/forms';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/Review';
import { useAuthStore } from '@/app/stores/authStore';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { useFormsStore } from '@/app/stores/formsStore';
import { useLoadFormsForPrimaryOrg } from '@/app/hooks/useForms';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary } from '@/app/ui/primitives/Buttons';
import { SoapNoteSubmission } from '@/app/features/appointments/types/soap';
import SignatureActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SignatureActions';
import { hasSignatureField } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/signatureUtils';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import ParentTask from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/ParentTask';
import LabTests from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import AppointmentMerckSearch from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch';
import { useServicesForPrimaryOrgSpecialities } from '@/app/hooks/useSpecialities';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import {
  getAppointmentCompanionPhotoUrl,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';

const COMPANION_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveCompanionImageType = (species?: string | null): ImageType => {
  const normalized = String(species ?? '')
    .trim()
    .toLowerCase();
  return COMPANION_IMAGE_TYPES.has(normalized as ImageType) ? (normalized as ImageType) : 'other';
};

const ALLOWED_CATEGORIES_BY_ORG: Record<string, string[]> = {
  HOSPITAL: ['Prescription', 'SOAP', 'Consent form', 'Discharge Form', 'Custom'],
  BOARDER: [
    'Boarding Checklist',
    'Dietary Plan',
    'Medication Details',
    'Daily Summary',
    'Schedule',
    'Belongings',
    'Consent form',
    'Discharge',
  ],
  BREEDER: [
    'Health & Behavior',
    'Mating Log',
    'Consultation & Planning',
    'Mating & Fertility Preferences',
    'Belongings',
    'Check-in',
    'Pregnancy Care',
    'Health Summary',
    'Consent form',
    'Discharge',
  ],
  GROOMER: [
    'Service Request & Preferences',
    'Grooming Prep',
    'Bathing & Cleaning Worklog',
    'Haircut / Styling Worklog',
    'Spa Add-ons Worklog',
    'Health Requirements',
    'Consent form',
    'Discharge',
  ],
};

const getAllowedCategories = (orgType?: string) =>
  ALLOWED_CATEGORIES_BY_ORG[orgType ?? ''] ?? ALLOWED_CATEGORIES_BY_ORG.GROOMER;

const getLabelsForOrgType = (orgType: string | undefined, hospitalLabels: any[]) => {
  if (orgType === 'HOSPITAL') return hospitalLabels;
  return [
    hospitalLabels[0],
    {
      key: 'care',
      name: 'Care plan',
      labels: [
        { key: 'forms', name: 'Templates' },
        { key: 'documents', name: 'Documents' },
      ],
    },
    hospitalLabels[2],
    hospitalLabels[3],
    hospitalLabels[4],
  ];
};

type CustomFormsSectionProps = {
  forms: AppointmentFormEntry[];
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  activeAppointment: Appointment | null;
  templates: { value: string; label: string; schema: FormField[]; form: any }[];
  accordionTitle?: string;
  onSubmission?: (entry: AppointmentFormEntry) => void;
  onSubmissionUpdate?: (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean }
  ) => void;
  onFormLinked?: (entry: AppointmentFormEntry) => void;
};

const FormBadge: React.FC<{ label: string; badgeClass: string }> = ({ label, badgeClass }) => (
  <span className={`text-label-xsmall px-2 py-1 rounded ${badgeClass}`}>{label}</span>
);

const CustomFormsSection: React.FC<CustomFormsSectionProps> = ({
  forms,
  loading,
  error,
  canEdit,
  activeAppointment,
  templates,
  accordionTitle,
  onSubmission,
  onSubmissionUpdate,
  onFormLinked,
}) => (
  <CustomFormsView
    forms={forms}
    loading={loading}
    error={error}
    canEdit={canEdit}
    activeAppointment={activeAppointment}
    onSubmission={onSubmission}
    onSubmissionUpdate={onSubmissionUpdate}
    onFormLinked={onFormLinked}
    templates={templates}
    accordionTitle={accordionTitle}
  />
);

const CustomFormsView = ({
  forms,
  loading,
  error,
  canEdit,
  activeAppointment,
  onSubmission,
  templates,
  accordionTitle,
  onSubmissionUpdate,
  onFormLinked,
}: {
  forms: AppointmentFormEntry[];
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  activeAppointment: Appointment | null;
  onSubmission?: (entry: AppointmentFormEntry) => void;
  templates: { value: string; label: string; schema: FormField[]; form: any }[];
  accordionTitle?: string;
  onSubmissionUpdate?: (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean }
  ) => void;
  onFormLinked?: (entry: AppointmentFormEntry) => void;
}) => {
  const attributes = useAuthStore.getState().attributes;
  const [valuesByForm, setValuesByForm] = useState<Record<string, Record<string, any>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState<string>('');

  if (loading) {
    return <div className="text-body-3 text-text-primary">Loading forms…</div>;
  }
  if (error) {
    return <div className="text-body-3 text-error-main">{error}</div>;
  }

  const getFormBadge = (
    entry: AppointmentFormEntry,
    needsSignature: boolean | undefined,
    isSigned: boolean,
    isClientSigner: boolean
  ) => {
    const isCompleted = entry.status === 'completed' && (!needsSignature || isSigned);
    let label = 'Pending';
    if (isClientSigner) {
      label = isSigned ? 'Signed by pet parent' : 'Pending parent signature';
    } else if (isCompleted) {
      label = 'Completed';
    } else if (needsSignature && !isSigned) {
      label = 'Signature Pending';
    }
    const badgeClass =
      isSigned || isCompleted ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-700';
    return { label, badgeClass };
  };

  return (
    <Accordion
      title={accordionTitle || 'Templates'}
      defaultOpen={true}
      showEditIcon={false}
      isEditing
    >
      <div className="flex flex-col gap-4 w-full">
        {canEdit ? (
          <div className="flex flex-col gap-3">
            <SearchDropdown
              placeholder="Search templates"
              options={templates.map((t) => ({ value: t.value, label: t.label }))}
              onSelect={(id: string) => {
                const match = templates.find((t) => t.value === id);
                setSelectedTemplateId(id);
                setSelectedTemplateLabel(match?.label ?? id);
              }}
              query={selectedTemplateLabel}
              setQuery={(val: string) => setSelectedTemplateLabel(val)}
              minChars={0}
            />
            {selectedTemplateId
              ? (() => {
                  const template = templates.find((t) => t.value === selectedTemplateId);
                  const schema = template?.schema ?? [];
                  const isClientSigner = template?.form?.requiredSigner === 'CLIENT';
                  return (
                    <div className="border border-card-border rounded-2xl p-4">
                      <FormRenderer
                        fields={schema}
                        values={valuesByForm[selectedTemplateId] ?? buildInitialValues(schema)}
                        onChange={(id, value) =>
                          setValuesByForm((prev) => ({
                            ...prev,
                            [selectedTemplateId]: {
                              ...(prev[selectedTemplateId] ?? buildInitialValues(schema)),
                              [id]: value,
                            },
                          }))
                        }
                        readOnly={isClientSigner}
                      />
                    </div>
                  );
                })()
              : null}
            {selectedTemplateId
              ? (() => {
                  const template = templates.find((t) => t.value === selectedTemplateId);
                  const isClientSigner = template?.form?.requiredSigner === 'CLIENT';
                  if (isClientSigner) {
                    return (
                      <Primary
                        href="#"
                        text={sendingId === selectedTemplateId ? 'Sending...' : 'Send to parent'}
                        onClick={async () => {
                          if (!activeAppointment?.id || !selectedTemplateId || !template?.form)
                            return;
                          setSubmitError(null);
                          setSendingId(selectedTemplateId);
                          try {
                            const orgId = activeAppointment.organisationId;
                            if (!orgId) {
                              setSubmitError('Organisation not found.');
                              setSendingId(null);
                              return;
                            }
                            await linkAppointmentForms({
                              organisationId: orgId,
                              appointmentId: activeAppointment.id,
                              formIds: [template.form._id ?? template.value],
                            });
                            onFormLinked?.({
                              form: template.form,
                              submission: null,
                              status: 'pending',
                            });
                            setSelectedTemplateId('');
                            setSelectedTemplateLabel('');
                          } catch (e) {
                            console.error('Failed to send form to parent', e);
                            setSubmitError('Failed to send form. Please try again.');
                          } finally {
                            setSendingId(null);
                          }
                        }}
                      />
                    );
                  }
                  return (
                    <Primary
                      href="#"
                      text={submittingId === selectedTemplateId ? 'Saving...' : 'Save'}
                      onClick={async () => {
                        if (!activeAppointment?.id || !attributes?.sub || !selectedTemplateId)
                          return;
                        setSubmitError(null);
                        setSubmittingId(selectedTemplateId);
                        if (!template) {
                          setSubmitError('Template not found');
                          setSubmittingId(null);
                          return;
                        }
                        try {
                          const requiredSigner = template.form?.requiredSigner ?? '';
                          const requiresSignature =
                            requiredSigner === 'VET' && hasSignatureField(template.schema);
                          const companion = activeAppointment?.companion;
                          const submission: FormSubmission = {
                            _id: '',
                            formVersion: 1,
                            submittedAt: new Date(),
                            formId: template.value,
                            appointmentId: activeAppointment.id,
                            companionId: companion?.id ?? '',
                            parentId: companion?.parent?.id ?? '',
                            answers:
                              valuesByForm[selectedTemplateId] ??
                              buildInitialValues(template.schema),
                            submittedBy: attributes.sub,
                          };
                          const created = await createSubmission(submission);
                          const submissionWithSigning = requiresSignature
                            ? {
                                ...created,
                                signatureRequired: true,
                                signing: created.signing ?? {
                                  required: true,
                                  status: 'NOT_STARTED',
                                  provider: 'DOCUMENSO',
                                },
                              }
                            : created;
                          onSubmission?.({
                            form: template.form,
                            submission: submissionWithSigning,
                            status: 'completed',
                          });
                          setSelectedTemplateId('');
                          setSelectedTemplateLabel('');
                        } catch (e) {
                          console.error('Failed to submit form', e);
                          setSubmitError('Failed to submit form. Please try again.');
                        } finally {
                          setSubmittingId(null);
                        }
                      }}
                    />
                  );
                })()
              : null}
          </div>
        ) : null}

        {forms.map((entry, idx) => {
          const answers = entry.submission?.answers ?? {};
          const requiredSigner = entry.form.requiredSigner ?? '';
          const isClientSigner = requiredSigner === 'CLIENT';
          const isExplicitNone = requiredSigner === '';
          const signatureRequired =
            !isClientSigner &&
            !isExplicitNone &&
            requiredSigner === 'VET' &&
            hasSignatureField(entry.form.schema ?? []);
          const formId = entry.form._id ?? entry.form.name;
          const formValues = valuesByForm[formId] ?? buildInitialValues(entry.form.schema ?? []);
          const key = entry.submission?._id ?? `${formId}-${idx}`;
          const submissionWithMeta = entry.submission
            ? ({
                ...entry.submission,
                signatureRequired,
              } satisfies FormSubmission & { signatureRequired?: boolean })
            : null;
          const signingStatus = submissionWithMeta?.signing?.status;
          const isSigned =
            signingStatus === 'SIGNED' || Boolean(submissionWithMeta?.signing?.pdf?.url);
          const needsSignature = submissionWithMeta?.signatureRequired;
          const { label, badgeClass } = getFormBadge(
            entry,
            needsSignature,
            isSigned,
            isClientSigner
          );
          const shouldOpenByDefault = label === 'Signature Pending';
          const signatureActions = submissionWithMeta?.signatureRequired ? (
            <SignatureActions
              submission={submissionWithMeta}
              onStatusChange={(submissionId, updates) =>
                onSubmissionUpdate?.(submissionId, updates)
              }
            />
          ) : null;
          return (
            <Accordion
              key={key}
              title={entry.form.name}
              defaultOpen={shouldOpenByDefault}
              showEditIcon={false}
              isEditing
              rightElement={signatureActions ?? <FormBadge label={label} badgeClass={badgeClass} />}
            >
              {entry.submission ? (
                <div className="border border-card-border rounded-2xl p-4 flex flex-col gap-2">
                  <FormRenderer
                    fields={entry.form.schema ?? []}
                    values={answers as Record<string, unknown>}
                    onChange={() => {}}
                    readOnly
                  />
                  {submissionWithMeta?.signatureRequired ? (
                    <div className="mt-3">
                      <FormBadge label={label} badgeClass={badgeClass} />
                    </div>
                  ) : null}
                  {isClientSigner ? (
                    <div className="text-xs text-text-secondary">
                      {isSigned
                        ? 'Signed by pet parent.'
                        : 'Sent to pet parent. It will update when they sign the document.'}
                    </div>
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
                      readOnly={!canEdit || isClientSigner}
                    />
                  </div>
                  {canEdit && !isClientSigner && (
                    <Primary
                      href="#"
                      text={submittingId === formId ? 'Saving...' : 'Save'}
                      onClick={async () => {
                        if (!activeAppointment?.id || !attributes?.sub) return;
                        setSubmitError(null);
                        setSubmittingId(formId);
                        try {
                          const requiresSignature = signatureRequired;
                          const companion = activeAppointment?.companion;
                          const submission: FormSubmission = {
                            _id: '',
                            formVersion: entry.submission?.formVersion ?? 1,
                            submittedAt: new Date(),
                            formId: entry.form._id,
                            appointmentId: activeAppointment.id,
                            companionId: companion?.id ?? '',
                            parentId: companion?.parent?.id ?? '',
                            answers: valuesByForm[formId] ?? formValues,
                            submittedBy: attributes.sub,
                          };
                          const created = await createSubmission(submission);
                          const submissionWithSigning = requiresSignature
                            ? {
                                ...created,
                                signatureRequired: true,
                                signing: created.signing ?? {
                                  required: true,
                                  status: 'NOT_STARTED',
                                  provider: 'DOCUMENSO',
                                },
                              }
                            : created;
                          onSubmission?.({
                            form: entry.form,
                            submission: submissionWithSigning,
                            status: 'completed',
                          });
                        } catch (e) {
                          console.error('Failed to submit form', e);
                          setSubmitError('Failed to submit form. Please try again.');
                        } finally {
                          setSubmittingId(null);
                        }
                      }}
                    />
                  )}
                  {isClientSigner ? (
                    <div className="text-xs text-text-secondary">
                      Sent to pet parent. It will update when they sign the document.
                    </div>
                  ) : null}
                </div>
              )}
            </Accordion>
          );
        })}
        {forms.length === 0 ? (
          <Accordion
            title="Previous Submissions"
            defaultOpen={false}
            showEditIcon={false}
            isEditing
          >
            <div className="text-body-3 text-text-secondary">No past form submissions.</div>
          </Accordion>
        ) : null}
        {submitError ? <div className="text-error-main text-body-4">{submitError}</div> : null}
      </div>
    </Accordion>
  );
};

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v == null) return 0;
  return 0;
};

const getTaxPercent = (): number => {
  return 0;
};

type AppoitmentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment | null;
  initialViewIntent?: AppointmentViewIntent | null;
  canEditAppointments?: boolean;
  onReschedule?: (appointment: Appointment) => void;
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
  total: '',
  discount: '',
  subTotal: '',
  tax: '',
  lineItems: [],
});

type LabelKey = 'info' | 'prescription' | 'care' | 'tasks' | 'finance' | 'labs';

const normalizeInfoSubLabel = (label: string, subLabel?: string) => {
  if (label === 'info' && subLabel === 'overview') return 'history';
  return subLabel;
};

const resolveIntentLabel = (
  availableLabels: Array<{ key: string }>,
  label: string
): string | null => {
  if (availableLabels.some((item) => item.key === label)) return label;
  if (label === 'prescription' && availableLabels.some((item) => item.key === 'care')) {
    return 'care';
  }
  if (label === 'care' && availableLabels.some((item) => item.key === 'prescription')) {
    return 'prescription';
  }
  return null;
};

const hospitalLabels = [
  {
    key: 'info',
    name: 'Info',
    labels: [
      { key: 'appointment', name: 'Appointment' },
      { key: 'companion', name: 'Companion' },
      { key: 'history', name: 'Overview' },
    ],
  },
  {
    key: 'prescription',
    name: 'Medical Records',
    labels: [
      { key: 'forms', name: 'Templates' },
      { key: 'audit-trail', name: 'Audit trail' },
      { key: 'documents', name: 'Documents' },
      {
        key: 'merck-manuals',
        name: (
          <div className="flex items-center gap-2">
            <Image
              src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
              alt=""
              width={30}
              height={30}
              className="object-contain"
            />
            <span>MSD Veterinary Manual</span>
          </div>
        ),
        redirectHref: '/integrations/merck-manuals',
        redirectLabel: 'Open MSD Veterinary Manual',
      },
    ],
  },
  {
    key: 'tasks',
    name: 'Tasks',
    labels: [
      { key: 'parent-chat', name: 'Companion parent chat' },
      { key: 'task', name: 'Task' },
      { key: 'parent-task', name: 'Parent task' },
    ],
  },
  {
    key: 'finance',
    name: 'Finance',
    labels: [
      { key: 'summary', name: 'Summary' },
      { key: 'payment-details', name: 'Invoices' },
    ],
  },
  {
    key: 'labs',
    name: 'Labs',
    labels: [
      {
        key: 'idexx-labs',
        name: (
          <Image
            src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
            alt="IDEXX"
            width={94}
            height={40}
            className="object-contain h-4 w-auto"
          />
        ),
        redirectHref: '/appointments/idexx-workspace',
        redirectLabel: 'Open IDEXX Hub',
      },
    ],
  },
];

const AppoitmentInfo = ({
  showModal,
  setShowModal,
  activeAppointment,
  initialViewIntent,
  canEditAppointments = false,
  onReschedule,
}: AppoitmentInfoProps) => {
  const router = useRouter();
  const { can } = usePermissions();
  const appointmentStatus = normalizeAppointmentStatus(activeAppointment?.status);
  const canEdit = can(PERMISSIONS.PRESCRIPTION_EDIT_OWN) && appointmentStatus !== 'COMPLETED';
  const services = useServicesForPrimaryOrgSpecialities();
  const [activeLabel, setActiveLabel] = useState<LabelKey>(hospitalLabels[0].key as LabelKey);
  const [activeSubLabel, setActiveSubLabel] = useState<string>(hospitalLabels[0].labels[0].key);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastOpenedAppointmentIdRef = useRef<string | null>(null);

  const [customForms, setCustomForms] = useState<AppointmentFormEntry[]>([]);
  const [customFormsLoading, setCustomFormsLoading] = useState(false);
  const [customFormsError, setCustomFormsError] = useState<string | null>(null);
  const upsertCustomForm = useCallback((entry: AppointmentFormEntry) => {
    setCustomForms((prev) => {
      const existsIdx = prev.findIndex(
        (e) => (e.form._id ?? e.form.name) === (entry.form._id ?? entry.form.name)
      );
      if (existsIdx === -1) {
        return [entry, ...prev];
      }
      const next = [...prev];
      next[existsIdx] = entry;
      return next;
    });
  }, []);
  const updateCustomFormSubmission = (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean }
  ) => {
    setCustomForms((prev) =>
      prev.map((entry) =>
        entry.submission?._id === submissionId ||
        (entry.submission as { submissionId?: string } | null | undefined)?.submissionId ===
          submissionId
          ? { ...entry, submission: { ...entry.submission!, ...updates } }
          : entry
      )
    );
  };

  const orgsById = useOrgStore((s) => s.orgsById);
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE;
  const orgType =
    (orgTypeOverride as Organisation['type'] | undefined) ||
    (activeAppointment?.organisationId && orgsById[activeAppointment.organisationId]?.type) ||
    'HOSPITAL';
  const formsById = useFormsStore((s) => s.formsById);
  useLoadFormsForPrimaryOrg();
  const formIds = useFormsStore((s) => s.formIds);
  const allForms = formIds.map((id) => formsById[id]).filter(Boolean);
  const signingOverlayOpen = useSigningOverlayStore((s) => s.open);
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const templatesForOrg = useMemo(() => {
    const trimPrefix = (text?: string | null) =>
      (text ?? '').replace(/^(Boarder|Breeder|Groomer)\s*-\s*/i, '');
    const matchesAllowed = (category: string, allowed: string[]) => {
      const normalized = trimPrefix(category);
      return allowed.includes(category) || allowed.includes(normalized);
    };
    const allowedCategories = getAllowedCategories(orgType);
    return allForms
      .filter((f) => matchesAllowed(f.category, allowedCategories))
      .map((f) => ({
        value: f._id ?? f.name,
        label: trimPrefix(f.name),
        schema: f.schema ?? [],
        form: f,
      }));
  }, [allForms, orgType]);

  const labels = useMemo(() => {
    const base = getLabelsForOrgType(orgType, hospitalLabels).map((label: any) => {
      if (orgType === 'HOSPITAL' && label.key === 'prescription') {
        return {
          ...label,
          labels: (label.labels ?? []).map((subLabel: any) =>
            subLabel.key === 'forms' ? { ...subLabel, name: 'SOAP' } : subLabel
          ),
        };
      }
      return label;
    });
    if (merckEnabled) return base;
    return base.map((label: any) => {
      if (label.key !== 'prescription') return label;
      return {
        ...label,
        labels: (label.labels ?? []).filter(
          (item: { key: string }) => item.key !== 'merck-manuals'
        ),
      };
    });
  }, [orgType, merckEnabled]);
  const formsAccordionTitle =
    orgType === 'HOSPITAL' && activeLabel === 'prescription' ? 'SOAP' : 'Templates';
  const handleHistoryOpenAppointmentView = useCallback(
    (intent: AppointmentViewIntent) => {
      const resolvedLabelKey = resolveIntentLabel(labels, intent.label);
      if (!resolvedLabelKey) return;
      const targetLabel = labels.find((label) => label.key === resolvedLabelKey);
      if (!targetLabel) return;
      setActiveLabel(targetLabel.key as LabelKey);

      const preferredSubLabel = normalizeInfoSubLabel(resolvedLabelKey, intent.subLabel);
      if (!preferredSubLabel) {
        setActiveSubLabel(targetLabel.labels[0]?.key ?? '');
        return;
      }

      const hasPreferredSubLabel = targetLabel.labels.some(
        (label: { key: string }) => label.key === preferredSubLabel
      );
      setActiveSubLabel(
        hasPreferredSubLabel ? preferredSubLabel : (targetLabel.labels[0]?.key ?? '')
      );
    },
    [labels]
  );

  useEffect(() => {
    if (!showModal || !initialViewIntent) return;
    const resolvedLabelKey = resolveIntentLabel(labels, initialViewIntent.label);
    if (!resolvedLabelKey) return;
    const targetLabel = labels.find((label) => label.key === resolvedLabelKey);
    if (!targetLabel) return;
    setActiveLabel(targetLabel.key as LabelKey);
    const normalizedSubLabel = normalizeInfoSubLabel(resolvedLabelKey, initialViewIntent.subLabel);
    const hasTargetSubLabel = normalizedSubLabel
      ? targetLabel.labels.some((label: { key: string }) => label.key === normalizedSubLabel)
      : false;
    setActiveSubLabel(
      hasTargetSubLabel ? (normalizedSubLabel as string) : (targetLabel.labels[0]?.key ?? '')
    );
  }, [showModal, initialViewIntent, labels]);

  useEffect(() => {
    if (!showModal) return;
    const currentAppointmentId = activeAppointment?.id ?? null;
    const lastAppointmentId = lastOpenedAppointmentIdRef.current;
    const isDifferentAppointment =
      !!currentAppointmentId && !!lastAppointmentId && currentAppointmentId !== lastAppointmentId;

    if (isDifferentAppointment && !initialViewIntent) {
      const defaultLabel = labels[0];
      setActiveLabel(defaultLabel.key as LabelKey);
      setActiveSubLabel(defaultLabel.labels[0]?.key ?? '');
    }

    if (currentAppointmentId) {
      lastOpenedAppointmentIdRef.current = currentAppointmentId;
    }
  }, [showModal, activeAppointment?.id, initialViewIntent, labels]);

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
      'audit-trail': Audit,
      'discharge-summary': Discharge,
      forms: CustomFormsSection,
      documents: Documents,
      'merck-manuals': AppointmentMerckSearch,
    },
    care: {
      forms: CustomFormsSection,
      documents: Documents,
      'discharge-summary': Discharge,
    },
    tasks: {
      'parent-chat': Chat,
      task: Task,
      'parent-task': ParentTask,
    },
    finance: {
      summary: Summary,
      'payment-details': Details,
    },
    labs: {
      'idexx-labs': LabTests,
    },
  };

  const Content = COMPONENT_MAP[activeLabel]?.[activeSubLabel];
  const [formData, setFormData] = useState<FormDataProps>(createEmptyFormData());

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
      console.error('Failed to load appointment forms:', e);
      setCustomFormsError('Unable to load forms');
      setCustomForms([]);
    } finally {
      setCustomFormsLoading(false);
    }
  }, [activeAppointment?.id]);

  const resolveAppointmentFormEntry = useCallback(
    (submission: SoapNoteSubmission | FormSubmission | undefined) => {
      if (!submission) return undefined;
      const submissionId = submission._id || (submission as SoapNoteSubmission).submissionId;
      if (submissionId) {
        return customForms.find((entry) => {
          const entryId =
            entry.submission?._id ||
            (entry.submission as SoapNoteSubmission | undefined)?.submissionId;
          return entryId && String(entryId) === String(submissionId);
        });
      }
      if (submission.formId) {
        return customForms.find((entry) => entry.submission?.formId === submission.formId);
      }
      return undefined;
    },
    [customForms]
  );

  const withSignatureMeta = useCallback(
    (submissions: SoapNoteSubmission[] | FormSubmission[] | undefined): SoapNoteSubmission[] => {
      if (!submissions?.length) return [];
      return submissions.map((sub) => {
        const matchedEntry = resolveAppointmentFormEntry(sub);
        const matchedSubmission = matchedEntry?.submission;
        const form = formsById[sub.formId] ?? matchedEntry?.form;
        const schemaHasSignature = hasSignatureField(form?.schema ?? []);
        const mergedSigning = matchedSubmission?.signing ?? sub.signing;
        const hasSigningData = Boolean(
          mergedSigning?.status || mergedSigning?.pdf?.url || mergedSigning?.documentId
        );
        const requiredSigner = form?.requiredSigner ?? '';
        const isClientSigner = requiredSigner === 'CLIENT';
        const isExplicitNone = requiredSigner === '';
        const requiresSignature =
          !isClientSigner &&
          !isExplicitNone &&
          requiredSigner === 'VET' &&
          Boolean(
            (sub as SoapNoteSubmission).signatureRequired || schemaHasSignature || hasSigningData
          );
        let signing: SoapNoteSubmission['signing'] | undefined;
        if (requiresSignature) {
          signing = mergedSigning ?? {
            required: true,
            status: 'NOT_STARTED',
            provider: 'DOCUMENSO',
          };
        } else if (hasSigningData) {
          signing = mergedSigning;
        }
        return {
          ...(sub as SoapNoteSubmission),
          signatureRequired: requiresSignature,
          signing,
        };
      });
    },
    [formsById, resolveAppointmentFormEntry]
  );
  const withSignatureMetaRef = useRef(withSignatureMeta);
  useEffect(() => {
    withSignatureMetaRef.current = withSignatureMeta;
  }, [withSignatureMeta]);

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (!current) {
      setActiveLabel(labels[0].key as LabelKey);
      setActiveSubLabel(labels[0].labels[0].key);
      return;
    }
    const sub = current.labels.find((l: { key: string }) => l.key === activeSubLabel);
    if (!sub) {
      setActiveSubLabel(current.labels[0].key);
    }
  }, [labels, activeLabel, activeSubLabel]);

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (current && current.labels.length > 0) {
      setActiveSubLabel(current.labels[0].key);
    }
  }, [activeLabel, labels]);

  useEffect(() => {
    const appointmentId = activeAppointment?.id;
    if (!appointmentId) return;

    setFormData((prev) => {
      const itemsSubTotal = (prev.lineItems ?? []).reduce((sum, li) => sum + toNumber(li.total), 0);
      const serviceId = activeAppointment?.appointmentType?.id;
      const service = services.find((s) => s.id === serviceId);
      const serviceCost = service ? toNumber(service.cost) : 0;
      const subTotal = itemsSubTotal + serviceCost;
      const taxPercent = getTaxPercent();
      const taxTotal = (subTotal * taxPercent) / 100;
      const total = subTotal + taxTotal;
      return {
        ...prev,
        subTotal: String(subTotal),
        tax: String(taxTotal),
        total: String(total),
      };
    });
  }, [activeAppointment, services]);

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
        if (cancelled) return;
        const applySignatureMeta = withSignatureMetaRef.current;
        setFormData((prev) => ({
          ...prev,
          subjective: applySignatureMeta(soap?.soapNotes?.Subjective),
          objective: applySignatureMeta(soap?.soapNotes?.Objective),
          assessment: applySignatureMeta(soap?.soapNotes?.Assessment),
          plan: applySignatureMeta(soap?.soapNotes?.Plan),
          discharge: applySignatureMeta(soap?.soapNotes?.Discharge),
          // not present in GetSOAPResponse, keep as-is / empty
          total: prev.total ?? '',
          subTotal: prev.subTotal ?? '',
          tax: prev.tax ?? '',
          discount: prev.discount ?? '',
        }));
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to fetch submissions:', e);
        setFormData(createEmptyFormData());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeAppointment?.id]);

  useEffect(() => {
    void loadAppointmentForms();
  }, [activeAppointment?.id, loadAppointmentForms]);

  const prevSigningOverlayOpenRef = useRef(signingOverlayOpen);
  useEffect(() => {
    // When signing overlay closes, refresh forms so signature status updates without a full page reload.
    const wasOpen = prevSigningOverlayOpenRef.current;
    prevSigningOverlayOpenRef.current = signingOverlayOpen;
    if (!wasOpen || signingOverlayOpen) return;
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
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeLabel, activeSubLabel]);

  const companionImageSrc = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(
      activeAppointment?.companion as
        | (Appointment['companion'] & { photoUrl?: string | null })
        | undefined
    ),
    resolveCompanionImageType(activeAppointment?.companion?.species)
  );

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <SigningOverlay />
      <div className={`flex flex-col h-full ${activeLabel === 'labs' ? 'gap-1' : 'gap-3'}`}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex justify-center items-center gap-2">
              <Image
                alt="pet image"
                src={companionImageSrc}
                className="h-10 w-10 rounded-full object-cover border border-card-border bg-white"
                height={40}
                width={40}
              />
              <button
                type="button"
                className="text-body-1 text-text-primary cursor-pointer text-left hover:underline underline-offset-2"
                onClick={() => {
                  router.push(
                    buildAppointmentCompanionHistoryHref(
                      activeAppointment?.id,
                      activeAppointment?.companion?.id,
                      '/appointments'
                    )
                  );
                  setShowModal(false);
                }}
              >
                {formatCompanionNameWithOwnerLastName(
                  activeAppointment?.companion.name,
                  activeAppointment?.companion.parent
                )}
              </button>
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

        <div ref={scrollRef} className="flex flex-1 min-h-0 scrollbar-custom overflow-y-auto">
          {Content ? (
            <Content
              activeAppointment={activeAppointment}
              formData={formData}
              setFormData={setFormData}
              canEdit={canEdit}
              canEditAppointments={canEditAppointments}
              onReschedule={onReschedule}
              forms={customForms}
              loading={customFormsLoading}
              error={customFormsError}
              templates={templatesForOrg}
              accordionTitle={formsAccordionTitle}
              onSubmission={upsertCustomForm}
              onFormLinked={upsertCustomForm}
              onSubmissionUpdate={updateCustomFormSubmission}
              onOpenAppointmentView={handleHistoryOpenAppointmentView}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default AppoitmentInfo;
