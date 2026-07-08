import React, { useEffect, useMemo, useRef, useState } from 'react';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { LuClipboardList } from 'react-icons/lu';
import SoapNotesList, {
  type SoapNoteListItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapNotesList';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import {
  formatStampDate,
  formatStampTime,
  resolveSectionLock,
} from '@/app/lib/appointmentWorkspace';
import { saveSoapNote } from '@/app/features/appointments/services/workspaceClinicalService';
import {
  getWorkspaceTemplateById,
  resolveSoapTemplate,
  templateToSoapTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { collectMissingRequiredFields } from '@/app/features/forms/pages/Forms/Sections/AddForm/validationUtils';
import { EMPTY_SOAP, isPersistedSoapId, hasNativeSoapContent, isCustomSoap } from './soapStepUtils';
import { SoapSignActions, SoapContextField, ChiefComplaintField } from './SoapPresentational';
import SoapTemplateSearch from './SoapTemplateSearch';
import NativeSoapFields from './NativeSoapFields';

type SoapStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  appointmentReason: string;
  appointmentService?: string;
  appointmentSpeciality?: string;
  encounter: AppointmentEncounter;
  onRecordVitals: () => void;
  onSaveAndNext: () => void;
};

/**
 * SOAP step: appointment reason, template search, and four rich-text sections
 * (Subjective / Objective / Assessment / Plan). Record Vitals lives in the
 * workspace header next to Quick Actions so it stays available across steps.
 * The completed note appears in the read-only "All SOAP notes" list.
 */
const SoapStep = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  authorName,
  appointmentReason,
  appointmentService,
  appointmentSpeciality,
  encounter,
  onRecordVitals,
  onSaveAndNext,
}: SoapStepProps) => {
  const terminologyText = useCompanionTerminologyText();
  const upsertSoap = useAppointmentWorkspaceStore((s) => s.upsertSoap);
  const applySoapTemplate = useAppointmentWorkspaceStore((s) => s.applySoapTemplate);
  const signSoap = useAppointmentWorkspaceStore((s) => s.signSoap);
  const [templateQuery, setTemplateQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isApplyingTemplateRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const persistedDraftIdRef = useRef<string | undefined>(undefined);

  // Work on the active draft (first not-yet-signed note); once a note is signed
  // it moves to "All SOAP notes" history and the form clears for a new entry.
  const note = encounter.soap.find((entry) => entry.status !== 'COMPLETED') ?? EMPTY_SOAP;
  // Prefer the backend-owned SOAP section lock when the workspace bootstrap supplies
  // it; otherwise fall back to the clinical `viewOnly` flag (lock-window/discharge).
  const soapLock = resolveSectionLock(encounter, 'soap', encounter.viewOnly);
  const readOnly = soapLock.locked;
  const lockReason = soapLock.reason;

  useEffect(() => {
    persistedDraftIdRef.current = isPersistedSoapId(note.id) ? note.id : undefined;
  }, [note.id]);

  // Auto-load the SOAP template linked to the encounter's service/package when the active draft
  // is still empty, so the clinician lands on the preloaded content. Runs once per encounter and
  // never overwrites typed content; the search box below still lets them override the default.
  const autoResolvedSoapRef = useRef(false);
  const encounterMode = encounter.mode;
  const encounterServices = encounter.services;
  useEffect(() => {
    if (!organisationId || readOnly || autoResolvedSoapRef.current) return;
    if (note.templateId || hasNativeSoapContent(note) || isCustomSoap(note)) return;
    autoResolvedSoapRef.current = true;
    let cancelled = false;
    const serviceLine = encounterServices?.find((item) => item.kind === 'SERVICE');
    const packageLine = encounterServices?.find((item) => item.kind === 'PACKAGE');
    resolveSoapTemplate({
      organisationId,
      appointmentId,
      encounterId,
      serviceId: serviceLine?.refId,
      packageId: packageLine?.refId,
      mode: encounterMode,
    })
      .then((resolved) => {
        if (cancelled || !resolved) return;
        applySoapTemplate(appointmentId, resolved);
      })
      .catch((error) => console.error('Unable to resolve SOAP template:', error));
    return () => {
      cancelled = true;
    };
  }, [
    appointmentId,
    applySoapTemplate,
    encounterId,
    encounterMode,
    encounterServices,
    note,
    organisationId,
    readOnly,
  ]);

  const templateSearchRef = useRef<HTMLDivElement>(null);
  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return encounter.soapTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templateQuery, encounter.soapTemplates]);

  const applySelectedTemplate = async (templateId: string): Promise<void> => {
    if (!organisationId || isApplyingTemplateRef.current) return;
    isApplyingTemplateRef.current = true;
    try {
      const selectedTemplate = encounter.soapTemplates.find((tpl) => tpl.id === templateId);
      const fullTemplate =
        selectedTemplate && (selectedTemplate.content || selectedTemplate.customSchema)
          ? selectedTemplate
          : templateToSoapTemplate(await getWorkspaceTemplateById(organisationId, templateId));
      applySoapTemplate(appointmentId, fullTemplate, { replaceContent: true });
      setTemplateQuery('');
    } catch (error) {
      console.error('Unable to apply SOAP template:', error);
    } finally {
      isApplyingTemplateRef.current = false;
    }
  };

  const pastNotes: SoapNoteListItem[] = useMemo(
    () =>
      encounter.soap.flatMap((entry) =>
        entry.status === 'COMPLETED'
          ? [
              {
                id: entry.id,
                signedByName: entry.signedByName ?? encounter.leadName ?? 'Clinician',
                signedOffline: entry.signedOffline,
                date: entry.signedAt ? formatStampDate(entry.signedAt) : undefined,
                time: entry.signedAt ? formatStampTime(entry.signedAt) : undefined,
                fields: [
                  { label: 'Chief complaint', text: appointmentReason },
                  { label: 'Subjective (History)', html: entry.subjective },
                  { label: 'Objective (Examination)', html: entry.objective },
                  { label: 'Assessment (Differential)', html: entry.assessment },
                  { label: 'Plan', html: entry.plan },
                ],
              },
            ]
          : []
      ),
    [appointmentReason, encounter.leadName, encounter.soap]
  );

  const customMode = isCustomSoap(note);

  const handleCustomAnswerChange = (fieldId: string, value: unknown) =>
    upsertSoap(appointmentId, {
      customAnswers: { ...note.customAnswers, [fieldId]: value },
    });

  const handleSaveAndNext = async () => {
    if (isSaving) return;
    // Native SOAP with nothing typed simply advances; a custom template always persists its
    // structured answers (validation below gates required fields).
    if (!customMode && !hasNativeSoapContent(note)) {
      onSaveAndNext();
      return;
    }
    if (customMode) {
      const missing = collectMissingRequiredFields(
        note.customSchema ?? [],
        note.customAnswers ?? {}
      );
      if (missing.length > 0) {
        setSaveError(`Please complete required field(s): ${missing.join(', ')}`);
        return;
      }
    }
    setIsSaving(true);
    setSaveError(null);
    let persistedId: string | undefined;
    try {
      if (organisationId) {
        const noteForSave =
          persistedDraftIdRef.current && !isPersistedSoapId(note.id)
            ? { ...note, id: persistedDraftIdRef.current }
            : note;
        const saved = await saveSoapNote(
          {
            organisationId,
            appointmentId,
            encounterId,
            authorId,
            authorName,
            templateId: note.templateId,
            // Forward full template provenance so the saved artifact records the exact
            // template version that prefilled/structured it (parity with discharge).
            templateVersion: note.templateVersion,
            templateVersionId: note.templateVersionId,
          },
          noteForSave
        );
        persistedId = (saved as { id?: string } | undefined)?.id;
        const savedSignedByName = (saved as { signedByName?: string } | undefined)?.signedByName;
        const signerName = savedSignedByName?.trim() || authorName?.trim() || encounter.leadName;
        signSoap(appointmentId, signerName ?? 'Clinician', false, persistedId);
      } else {
        signSoap(appointmentId, authorName?.trim() || encounter.leadName || 'Clinician', false);
      }
    } catch (error) {
      // Do NOT advance or mark COMPLETED on a failed save — that would show an
      // unsaved clinical note as signed. Surface the backend error and stop.
      console.error('Unable to persist SOAP note:', error);
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save the SOAP note. Please try again.'
      );
      setIsSaving(false);
      return;
    }
    // Only reached when the save succeeded (or there was nothing to persist).
    setIsSaving(false);
    onSaveAndNext();
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="w-full lg:max-w-125 lg:flex-1">
          <ChiefComplaintField value={appointmentReason} />
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center lg:w-auto lg:shrink-0 lg:justify-end lg:gap-3">
          <div className="w-full sm:w-52">
            <SoapContextField label="Speciality" value={appointmentSpeciality} />
          </div>
          <div className="w-full sm:w-52">
            <SoapContextField label="Service" value={appointmentService} />
          </div>
        </div>
      </div>

      {!readOnly && (
        <>
          <SoapTemplateSearch
            templateSearchRef={templateSearchRef}
            templateQuery={templateQuery}
            setTemplateQuery={setTemplateQuery}
            templateMatches={templateMatches}
            onSelectTemplate={(templateId) => {
              void applySelectedTemplate(templateId);
            }}
          />

          {customMode ? (
            // A custom template overrides the native structure: render its typed fields via the
            // shared FormRenderer and capture answers keyed by field id.
            <SectionContainer
              titleClassName="text-yc-20-b-primary"
              title="Clinical note"
              compactTop
            >
              <FormRenderer
                fields={note.customSchema ?? []}
                values={note.customAnswers ?? {}}
                onChange={handleCustomAnswerChange}
              />
              <div className="mt-3 flex justify-end">
                <Secondary
                  text="Record Vitals"
                  onClick={onRecordVitals}
                  icon={<LuClipboardList aria-hidden="true" />}
                />
              </div>
            </SectionContainer>
          ) : (
            <NativeSoapFields
              subjective={note.subjective}
              objective={note.objective}
              assessment={note.assessment}
              plan={note.plan}
              terminologyText={terminologyText}
              onSubjectiveChange={(html) => upsertSoap(appointmentId, { subjective: html })}
              onObjectiveChange={(html) => upsertSoap(appointmentId, { objective: html })}
              onAssessmentChange={(html) => upsertSoap(appointmentId, { assessment: html })}
              onPlanChange={(html) => upsertSoap(appointmentId, { plan: html })}
              onRecordVitals={onRecordVitals}
            />
          )}

          {saveError && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
              {saveError}
            </p>
          )}
          <div className="flex justify-end">
            <SoapSignActions disabled={isSaving} onSaveAndNext={handleSaveAndNext} />
          </div>
        </>
      )}
      {readOnly && lockReason && (
        <p className="rounded-2xl bg-neutral-100 p-3 text-body-4 text-text-secondary">
          {lockReason}
        </p>
      )}

      <SoapNotesList items={pastNotes} />
    </div>
  );
};

export default SoapStep;
