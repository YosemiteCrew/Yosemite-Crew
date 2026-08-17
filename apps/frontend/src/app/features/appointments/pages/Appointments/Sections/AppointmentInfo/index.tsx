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
import { Appointment, FormSubmission, Organisation } from '@yosemite-crew/types';
import { createSubmission } from '@/app/features/appointments/services/soapService';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
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
import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/reviewUtils';
import { collectMissingRequiredFields } from '@/app/features/forms/pages/Forms/Sections/AddForm/validationUtils';
import { useAuthStore } from '@/app/stores/authStore';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { useFormsStore } from '@/app/stores/formsStore';
import { useLoadFormsForPrimaryOrg } from '@/app/hooks/useForms';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
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
  getClinicalNotesIntent,
  normalizeAppointmentStatus,
  toStatusLabel,
} from '@/app/lib/appointments';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import { buildWorkspaceHrefForIntent } from '@/app/lib/appointmentWorkspace';
import {
  IoCardOutline,
  IoDocumentTextOutline,
  IoFlaskOutline,
  IoPawOutline,
} from 'react-icons/io5';

const COMPANION_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const SPECIES_DISPLAY_TO_IMAGE_TYPE: Record<string, ImageType> = {
  canine: 'dog',
  feline: 'cat',
  equine: 'horse',
};

const getAppointmentStateSummary = (status?: string | null): string => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'CANCELLED') {
    return 'This appointment was cancelled. Scheduling actions are limited, but records and finance history remain available.';
  }
  if (normalized === 'NO_SHOW') {
    return 'This appointment was marked no-show. Use the record, finance, and lab tabs for any follow-up documentation.';
  }
  if (normalized === 'COMPLETED') {
    return 'This appointment is completed. Review finalized medical records, invoices, lab results, and summaries.';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'This appointment is in progress. Continue in the workspace for clinical records, labs, treatment, and billing.';
  }
  if (normalized === 'CHECKED_IN') {
    return 'This appointment is checked in and ready to continue in the workspace.';
  }
  if (normalized === 'UPCOMING') {
    return 'This appointment is upcoming. Confirm details or start the visit from the workspace.';
  }
  if (normalized === 'REQUESTED') {
    return 'This appointment request is waiting for confirmation.';
  }
  return 'Review appointment details and related records.';
};

const resolveCompanionImageType = (species?: string | null): ImageType => {
  const normalized = String(species ?? '')
    .trim()
    .toLowerCase();
  if (COMPANION_IMAGE_TYPES.has(normalized as ImageType)) return normalized as ImageType;
  return SPECIES_DISPLAY_TO_IMAGE_TYPE[normalized] ?? 'other';
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

const createSubmissionTimestamp = () => new Date();

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
  <StatusPill
    label={label}
    tone={badgeClass.startsWith('bg-[var(--status-completed-bg)]') ? 'success' : 'warning'}
  />
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
    isSigned || isCompleted
      ? 'bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]'
      : 'bg-[var(--status-requested-bg)] text-[var(--color-warning-900)]';
  return { label, badgeClass };
};

type SubmittedFormEntryProps = {
  entry: AppointmentFormEntry;
  idx: number;
  canEdit: boolean;
  activeAppointment: Appointment | null;
  attributes: ReturnType<typeof useAuthStore.getState>['attributes'];
  valuesByForm: Record<string, Record<string, any>>;
  setValuesByForm: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  submittingId: string | null;
  setSubmittingId: React.Dispatch<React.SetStateAction<string | null>>;
  setSubmitError: React.Dispatch<React.SetStateAction<string | null>>;
  onSubmission?: (entry: AppointmentFormEntry) => void;
  onSubmissionUpdate?: (
    submissionId: string,
    updates: Partial<FormSubmission> & { signatureRequired?: boolean }
  ) => void;
};

const SubmittedFormEntry = ({
  entry,
  idx,
  canEdit,
  activeAppointment,
  attributes,
  valuesByForm,
  setValuesByForm,
  submittingId,
  setSubmittingId,
  setSubmitError,
  onSubmission,
  onSubmissionUpdate,
}: SubmittedFormEntryProps) => {
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
  const isSigned = signingStatus === 'SIGNED' || Boolean(submissionWithMeta?.signing?.pdf?.url);
  const needsSignature = submissionWithMeta?.signatureRequired;
  const { label, badgeClass } = getFormBadge(entry, needsSignature, isSigned, isClientSigner);
  const shouldOpenByDefault = label === 'Signature Pending';
  const signatureActions = submissionWithMeta?.signatureRequired ? (
    <SignatureActions
      submission={submissionWithMeta}
      onStatusChange={(submissionId, updates) => onSubmissionUpdate?.(submissionId, updates)}
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
                  const valuesToSubmit = valuesByForm[formId] ?? formValues;
                  const missingRequired = collectMissingRequiredFields(
                    entry.form.schema ?? [],
                    valuesToSubmit
                  );
                  if (missingRequired.length > 0) {
                    setSubmitError(
                      `Please complete the required field(s): ${missingRequired.join(', ')}`
                    );
                    setSubmittingId(null);
                    return;
                  }
                  const submission: FormSubmission = {
                    _id: '',
                    /* v8 ignore next -- this Save handler only renders in the `!entry.submission` branch, so formVersion always falls back to 1 */
                    formVersion: entry.submission?.formVersion ?? 1,
                    submittedAt: createSubmissionTimestamp(),
                    formId: entry.form._id,
                    appointmentId: activeAppointment.id,
                    companionId: companion?.id ?? '',
                    parentId: companion?.parent?.id ?? '',
                    answers: valuesToSubmit,
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
};

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
                          const valuesToSubmit =
                            valuesByForm[selectedTemplateId] ?? buildInitialValues(template.schema);
                          const missingRequired = collectMissingRequiredFields(
                            template.schema ?? [],
                            valuesToSubmit
                          );
                          if (missingRequired.length > 0) {
                            setSubmitError(
                              `Please complete the required field(s): ${missingRequired.join(', ')}`
                            );
                            setSubmittingId(null);
                            return;
                          }
                          const submission: FormSubmission = {
                            _id: '',
                            formVersion: 1,
                            submittedAt: createSubmissionTimestamp(),
                            formId: template.value,
                            appointmentId: activeAppointment.id,
                            companionId: companion?.id ?? '',
                            parentId: companion?.parent?.id ?? '',
                            answers: valuesToSubmit,
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
          const formId = entry.form._id ?? entry.form.name;
          const key = entry.submission?._id ?? `${formId}-${idx}`;
          return (
            <SubmittedFormEntry
              key={key}
              entry={entry}
              idx={idx}
              canEdit={canEdit}
              activeAppointment={activeAppointment}
              attributes={attributes}
              valuesByForm={valuesByForm}
              setValuesByForm={setValuesByForm}
              submittingId={submittingId}
              setSubmittingId={setSubmittingId}
              setSubmitError={setSubmitError}
              onSubmission={onSubmission}
              onSubmissionUpdate={onSubmissionUpdate}
            />
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

type AppoitmentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment | null;
  initialViewIntent?: AppointmentViewIntent | null;
  canEditAppointments?: boolean;
  onReschedule?: (appointment: Appointment) => void;
};

export type {
  ServiceEdit,
  FormDataProps,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
export { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import { useAppointmentFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/useAppointmentFormData';

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

const buildInfoLabels = (orgType: string | undefined, merckEnabled: boolean) => {
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
      labels: (label.labels ?? []).filter((item: { key: string }) => item.key !== 'merck-manuals'),
    };
  });
};

const useAppointmentCustomForms = (appointmentId?: string | null) => {
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
  const loadAppointmentForms = useCallback(async () => {
    if (!appointmentId) {
      setCustomForms([]);
      setCustomFormsError(null);
      setCustomFormsLoading(false);
      return;
    }
    setCustomFormsLoading(true);
    setCustomFormsError(null);
    try {
      const res = await fetchAppointmentForms(appointmentId);
      setCustomForms(res.forms);
    } catch (e) {
      console.error('Failed to load appointment forms:', e);
      setCustomFormsError('Unable to load forms');
      setCustomForms([]);
    } finally {
      setCustomFormsLoading(false);
    }
  }, [appointmentId]);
  return {
    customForms,
    customFormsLoading,
    customFormsError,
    upsertCustomForm,
    updateCustomFormSubmission,
    loadAppointmentForms,
  };
};

const useSubmissionSignatureMeta = (
  customForms: AppointmentFormEntry[],
  formsById: Record<string, { schema?: FormField[]; requiredSigner?: string }>
) => {
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
  return { withSignatureMeta, withSignatureMetaRef };
};

type AppointmentInfoModalHeaderProps = {
  companionImageSrc: string;
  companion: NonNullable<Appointment['companion']>;
  activeAppointment: Appointment | null;
  canEditAppointments: boolean;
  statusLabel: string;
  statusSummary: string;
  router: ReturnType<typeof useRouter>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  openWorkspaceIntent: (intent: AppointmentViewIntent) => void;
  clinicalWorkspaceIntent: AppointmentViewIntent;
  labels: typeof hospitalLabels;
  resolvedActiveLabel: LabelKey;
  handleActiveLabelChange: (label: LabelKey) => void;
  resolvedActiveSubLabel: string;
  setActiveSubLabel: React.Dispatch<React.SetStateAction<string>>;
};

const HeaderLinkButton = ({
  label,
  ariaLabel,
  icon,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onClick}
    className="inline-flex h-9 items-center gap-2 rounded-2xl border border-card-border px-3 text-caption-1 font-medium text-text-primary hover:bg-card-hover"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const AppointmentInfoModalHeader = ({
  companionImageSrc,
  companion,
  activeAppointment,
  canEditAppointments,
  statusLabel,
  statusSummary,
  router,
  setShowModal,
  openWorkspaceIntent,
  clinicalWorkspaceIntent,
  labels,
  resolvedActiveLabel,
  handleActiveLabelChange,
  resolvedActiveSubLabel,
  setActiveSubLabel,
}: AppointmentInfoModalHeaderProps) => (
  <div className="flex flex-col gap-3">
    <ModalHeader
      title={formatCompanionNameWithOwnerLastName(companion.name, companion.parent)}
      meta={companion.breed}
      onClose={() => setShowModal(false)}
      icon={
        <Image
          alt="pet image"
          src={companionImageSrc}
          className="size-10 shrink-0 rounded-full object-cover border border-card-border bg-neutral-0"
          height={40}
          width={40}
        />
      }
      actions={
        activeAppointment ? (
          <AppointmentStatusPill appointment={activeAppointment} canEdit={canEditAppointments} />
        ) : null
      }
    />

    <div className="max-w-3xl rounded-2xl border border-card-border bg-card-bg px-3 py-2 text-caption-1 text-text-secondary">
      <span className="font-medium text-text-primary">{statusLabel}:</span> {statusSummary}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <HeaderLinkButton
        label="Companion history"
        ariaLabel="Open companion history"
        icon={<IoPawOutline size={16} aria-hidden="true" />}
        onClick={() => {
          router.push(
            buildAppointmentCompanionHistoryHref(
              activeAppointment?.id,
              companion.id,
              '/appointments'
            )
          );
          setShowModal(false);
        }}
      />
      <HeaderLinkButton
        label="Medical records"
        ariaLabel="Open medical records in workspace"
        icon={<IoDocumentTextOutline size={16} aria-hidden="true" />}
        onClick={() => openWorkspaceIntent(clinicalWorkspaceIntent)}
      />
      <HeaderLinkButton
        label="Finance"
        ariaLabel="Open finance in workspace"
        icon={<IoCardOutline size={16} aria-hidden="true" />}
        onClick={() => openWorkspaceIntent({ label: 'finance', subLabel: 'summary' })}
      />
      <HeaderLinkButton
        label="Labs"
        ariaLabel="Open labs in workspace"
        icon={<IoFlaskOutline size={16} aria-hidden="true" />}
        onClick={() => openWorkspaceIntent({ label: 'labs', subLabel: 'idexx-labs' })}
      />
    </div>

    <Labels
      labels={labels}
      activeLabel={resolvedActiveLabel}
      setActiveLabel={handleActiveLabelChange}
      activeSubLabel={resolvedActiveSubLabel}
      setActiveSubLabel={setActiveSubLabel}
    />
  </div>
);

const useAppointmentOrgType = (activeAppointment: Appointment | null | undefined) => {
  const orgsById = useOrgStore((s) => s.orgsById);
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE;
  return (
    (orgTypeOverride as Organisation['type'] | undefined) ||
    (activeAppointment?.organisationId && orgsById[activeAppointment.organisationId]?.type) ||
    'HOSPITAL'
  );
};

const useTemplatesForOrg = (orgType: Organisation['type']) => {
  const formsById = useFormsStore((s) => s.formsById);
  useLoadFormsForPrimaryOrg();
  const formIds = useFormsStore((s) => s.formIds);
  const allForms = formIds.flatMap((id) => {
    const form = formsById[id];
    return form ? [form] : [];
  });

  return useMemo(() => {
    const trimPrefix = (text?: string | null) =>
      (text ?? '').replace(/^(Boarder|Breeder|Groomer)\s*-\s*/i, '');
    const matchesAllowed = (category: string, allowed: string[]) => {
      const normalized = trimPrefix(category);
      return allowed.includes(category) || allowed.includes(normalized);
    };
    const allowedCategories = getAllowedCategories(orgType);
    return allForms.flatMap((f) =>
      matchesAllowed(f.category, allowedCategories)
        ? [{ value: f._id ?? f.name, label: trimPrefix(f.name), schema: f.schema ?? [], form: f }]
        : []
    );
  }, [allForms, orgType]);
};

type AppointmentTabSelection = {
  label: LabelKey;
  subLabel: string;
};

const useSyncAppointmentInfoTabs = ({
  showModal,
  activeAppointmentId,
  initialViewIntent,
  appliedIntent,
  lastOpenedAppointmentId,
  labels,
  setAppliedIntent,
  setLastOpenedAppointmentId,
  resolveTabSelection,
  applyTabSelection,
}: {
  showModal: boolean;
  activeAppointmentId: string | null;
  initialViewIntent: AppointmentViewIntent | null | undefined;
  appliedIntent: AppointmentViewIntent | null;
  lastOpenedAppointmentId: string | null;
  labels: ReturnType<typeof buildInfoLabels>;
  setAppliedIntent: React.Dispatch<React.SetStateAction<AppointmentViewIntent | null>>;
  setLastOpenedAppointmentId: React.Dispatch<React.SetStateAction<string | null>>;
  resolveTabSelection: (
    labelKey: string,
    requestedSubLabel?: string | null
  ) => AppointmentTabSelection | null;
  applyTabSelection: (selection: AppointmentTabSelection) => void;
}) => {
  if (!showModal) {
    if (appliedIntent) setAppliedIntent(null);
    return;
  }

  if (initialViewIntent && initialViewIntent !== appliedIntent) {
    setAppliedIntent(initialViewIntent);
    const selection = resolveTabSelection(initialViewIntent.label);
    if (selection) applyTabSelection(selection);
  }

  if (!activeAppointmentId || activeAppointmentId === lastOpenedAppointmentId) return;

  if (lastOpenedAppointmentId && !initialViewIntent) {
    const selection = resolveTabSelection(labels[0].key);
    if (selection) applyTabSelection(selection);
  }

  setLastOpenedAppointmentId(activeAppointmentId);
};

const useAppointmentInfoTabs = (
  labels: ReturnType<typeof buildInfoLabels>,
  showModal: boolean,
  activeAppointment: Appointment | null | undefined,
  initialViewIntent: AppointmentViewIntent | null | undefined
) => {
  const [activeLabel, setActiveLabel] = useState<LabelKey>(hospitalLabels[0].key as LabelKey);
  const [activeSubLabel, setActiveSubLabel] = useState<string>(hospitalLabels[0].labels[0].key);
  const [appliedIntent, setAppliedIntent] = useState<AppointmentViewIntent | null>(null);
  const [lastOpenedAppointmentId, setLastOpenedAppointmentId] = useState<string | null>(null);

  const resolveTabSelection = useCallback(
    (labelKey: string, requestedSubLabel?: string | null) => {
      const resolvedLabelKey = resolveIntentLabel(labels, labelKey);
      if (!resolvedLabelKey) return null;
      const targetLabel = labels.find((label) => label.key === resolvedLabelKey);
      if (!targetLabel) return null;
      const normalizedSubLabel = normalizeInfoSubLabel(
        resolvedLabelKey,
        requestedSubLabel ?? undefined
      );
      const hasTargetSubLabel = normalizedSubLabel
        ? targetLabel.labels.some((label: { key: string }) => label.key === normalizedSubLabel)
        : false;
      return {
        label: targetLabel.key as LabelKey,
        subLabel: hasTargetSubLabel
          ? (normalizedSubLabel as string)
          : (targetLabel.labels[0]?.key ?? ''),
      };
    },
    [labels]
  );
  const applyTabSelection = useCallback((selection: AppointmentTabSelection) => {
    setActiveLabel(selection.label);
    setActiveSubLabel(selection.subLabel);
  }, []);
  const handleActiveLabelChange = useCallback(
    (label: LabelKey) => {
      const selection = resolveTabSelection(label);
      if (selection) applyTabSelection(selection);
    },
    [applyTabSelection, resolveTabSelection]
  );
  const handleHistoryOpenAppointmentView = useCallback(
    (intent: AppointmentViewIntent) => {
      const selection = resolveTabSelection(intent.label, intent.subLabel);
      if (selection) applyTabSelection(selection);
    },
    [applyTabSelection, resolveTabSelection]
  );

  useSyncAppointmentInfoTabs({
    showModal,
    activeAppointmentId: activeAppointment?.id ?? null,
    initialViewIntent,
    appliedIntent,
    lastOpenedAppointmentId,
    labels,
    setAppliedIntent,
    setLastOpenedAppointmentId,
    resolveTabSelection,
    applyTabSelection,
  });

  return {
    activeLabel,
    activeSubLabel,
    setActiveSubLabel,
    handleActiveLabelChange,
    handleHistoryOpenAppointmentView,
  };
};

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    customForms,
    customFormsLoading,
    customFormsError,
    upsertCustomForm,
    updateCustomFormSubmission,
    loadAppointmentForms,
  } = useAppointmentCustomForms(activeAppointment?.id);

  const orgType = useAppointmentOrgType(activeAppointment);
  const statusSummary = getAppointmentStateSummary(activeAppointment?.status);
  const statusLabel = toStatusLabel(activeAppointment?.status);
  const clinicalWorkspaceIntent = getClinicalNotesIntent(orgType);
  const activeAppointmentId = activeAppointment?.id;
  const openWorkspaceIntent = useCallback(
    (intent: AppointmentViewIntent) => {
      if (!activeAppointmentId) return;
      router.push(buildWorkspaceHrefForIntent(activeAppointmentId, intent));
      setShowModal(false);
    },
    [activeAppointmentId, router, setShowModal]
  );
  const formsById = useFormsStore((s) => s.formsById);
  const signingOverlayOpen = useSigningOverlayStore((s) => s.open);
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const templatesForOrg = useTemplatesForOrg(orgType);
  const labels = useMemo(() => buildInfoLabels(orgType, merckEnabled), [orgType, merckEnabled]);
  const {
    activeLabel,
    activeSubLabel,
    setActiveSubLabel,
    handleActiveLabelChange,
    handleHistoryOpenAppointmentView,
  } = useAppointmentInfoTabs(labels, showModal, activeAppointment, initialViewIntent);

  const { withSignatureMeta, withSignatureMetaRef } = useSubmissionSignatureMeta(
    customForms,
    formsById
  );

  const activeLabelConfig = labels.find((label) => label.key === activeLabel) ?? labels[0];
  const resolvedActiveLabel = activeLabelConfig.key as LabelKey;
  const resolvedActiveSubLabel = activeLabelConfig.labels.some(
    (label: { key: string }) => label.key === activeSubLabel
  )
    ? activeSubLabel
    : (activeLabelConfig.labels[0]?.key ?? '');
  const formsAccordionTitle =
    orgType === 'HOSPITAL' && resolvedActiveLabel === 'prescription' ? 'SOAP' : 'Templates';
  const Content = COMPONENT_MAP[resolvedActiveLabel]?.[resolvedActiveSubLabel];

  const { setFormData, formDataWithTotals } = useAppointmentFormData({
    activeAppointment,
    services,
    resolvedActiveLabel,
    resolvedActiveSubLabel,
    customForms,
    formsById,
    withSignatureMeta,
    withSignatureMetaRef,
  });

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
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [resolvedActiveLabel, resolvedActiveSubLabel]);

  if (!activeAppointment) {
    return null;
  }

  const companion = activeAppointment.companion ?? activeAppointment.patient;
  const companionImageSrc = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(companion),
    resolveCompanionImageType(companion.species)
  );

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} size="lg">
      <SigningOverlay />
      <div className={`flex flex-col h-full ${resolvedActiveLabel === 'labs' ? 'gap-1' : 'gap-3'}`}>
        <AppointmentInfoModalHeader
          companionImageSrc={companionImageSrc}
          companion={companion}
          activeAppointment={activeAppointment}
          canEditAppointments={canEditAppointments}
          statusLabel={statusLabel}
          statusSummary={statusSummary}
          router={router}
          setShowModal={setShowModal}
          openWorkspaceIntent={openWorkspaceIntent}
          clinicalWorkspaceIntent={clinicalWorkspaceIntent}
          labels={labels}
          resolvedActiveLabel={resolvedActiveLabel}
          handleActiveLabelChange={handleActiveLabelChange}
          resolvedActiveSubLabel={resolvedActiveSubLabel}
          setActiveSubLabel={setActiveSubLabel}
        />

        <div ref={scrollRef} className="flex flex-1 min-h-0 scrollbar-custom overflow-y-auto">
          {Content ? (
            <Content
              activeAppointment={activeAppointment}
              formData={formDataWithTotals}
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
