import Modal from '@/app/ui/overlays/Modal';
import React, { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Image from 'next/image';
import Details, {
  AddFormStepHandle,
} from '@/app/features/forms/pages/Forms/Sections/AddForm/Details';
import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import { normalizeServiceGroups } from '@/app/features/forms/pages/Forms/Sections/AddForm/serviceGroupHelpers';
import Review from '@/app/features/forms/pages/Forms/Sections/AddForm/Review';
import AppointmentMerckSearch from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch';
import { FormsCategory, FormsProps } from '@/app/features/forms/types/forms';
import { publishForm, saveFormDraft } from '@/app/features/forms/services/formService';
import {
  publishTemplateForm,
  saveTemplateFormDraft,
} from '@/app/features/forms/services/templateFormsService';
import Close from '@/app/ui/primitives/Icons/Close';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import { shouldUseTemplateApi } from '@/app/lib/forms';
import { IoCreateOutline, IoEyeOutline } from 'react-icons/io5';

type AddFormProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  initialForm?: FormsProps | null;
  onClose?: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  draft?: FormsProps | null;
  onDraftChange?: (draft: FormsProps | null) => void;
};

/** Single-screen builder views. The palette/canvas/settings builder is the default. */
type BuilderView = 'build' | 'preview' | 'merck';

// Builder chrome: which pane is showing and whether the details panel is open.
// These always reset together, so they are one snapshot with one RESET action.
type BuilderUiState = { view: BuilderView; showDetails: boolean };

type BuilderUiAction =
  | { type: 'RESET' }
  | { type: 'TOGGLE_VIEW'; view: Exclude<BuilderView, 'build'> }
  | { type: 'SET_DETAILS'; showDetails: boolean }
  | { type: 'TOGGLE_DETAILS' };

const INITIAL_BUILDER_UI: BuilderUiState = { view: 'build', showDetails: false };

const builderUiReducer = (state: BuilderUiState, action: BuilderUiAction): BuilderUiState => {
  switch (action.type) {
    case 'RESET':
      return state.view === 'build' && !state.showDetails ? state : INITIAL_BUILDER_UI;
    // Each of these panes toggles against the builder, so re-selecting the active
    // pane returns to 'build'.
    case 'TOGGLE_VIEW':
      return { ...state, view: state.view === action.view ? 'build' : action.view };
    case 'SET_DETAILS':
      return state.showDetails === action.showDetails
        ? state
        : { ...state, showDetails: action.showDetails };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: !state.showDetails };
  }
};

const defaultForm = (): FormsProps => {
  const primaryOrg = useOrgStore.getState().getPrimaryOrg?.();
  return {
    name: '',
    category: '' as FormsCategory,
    usage: 'Internal',
    requiredSigner: '',
    updatedBy: '',
    lastUpdated: '',
    status: 'Draft',
    schema: [],
    businessType: primaryOrg?.type,
    // New templates default to the YC-default (structure-locked) type so the builder lands on
    // the curated, content-only presets; switching to "Custom" unlocks full structural editing.
    templateSource: 'YC_LIBRARY',
    isTemplateBacked: true,
  };
};

const AddForm = ({
  showModal,
  setShowModal,
  initialForm,
  onClose,
  serviceOptions,
  draft,
  onDraftChange,
}: AddFormProps) => {
  const [formData, setFormData] = useState<FormsProps>(draft ?? initialForm ?? defaultForm());
  // `view` and `showDetails` are both builder chrome and are always reset together
  // when the modal opens or closes, so they move as one snapshot rather than as
  // separate setState calls fired from the same effect.
  const [builderUi, dispatchBuilderUi] = useReducer(builderUiReducer, INITIAL_BUILDER_UI);
  const { view, showDetails } = builderUi;
  // Keep the last non-null handle so validation still applies while the step
  // is unmounted (e.g. validating Details/schema from the preview tab).
  const detailStepRef = useRef<AddFormStepHandle | null>(null);
  const buildStepRef = useRef<AddFormStepHandle | null>(null);
  const setDetailStepHandle = (handle: AddFormStepHandle | null) => {
    if (handle) detailStepRef.current = handle;
  };
  const setBuildStepHandle = (handle: AddFormStepHandle | null) => {
    if (handle) buildStepRef.current = handle;
  };
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenRef = useRef(false);
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();

  const isEditing = useMemo(() => Boolean(initialForm?._id), [initialForm]);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const fieldCount = formData.schema?.length ?? 0;
  const serviceCount = formData.services?.length ?? 0;
  const detailsSummary = `${formData.category || 'Uncategorised'} · ${fieldCount} field${
    fieldCount === 1 ? '' : 's'
  } · linked to ${serviceCount} service${serviceCount === 1 ? '' : 's'}`;

  useLayoutEffect(() => {
    if (showModal && !wasOpenRef.current) {
      dispatchBuilderUi({ type: 'RESET' });
      const next = {
        ...(initialForm ?? draft ?? defaultForm()),
        businessType:
          initialForm?.businessType ??
          draft?.businessType ??
          useOrgStore.getState().getPrimaryOrg?.()?.type,
      };
      setFormData(next);
      if (!initialForm) {
        onDraftChange?.(next);
      }
      wasOpenRef.current = true;
    }
    if (!showModal) {
      wasOpenRef.current = false;
    }
  }, [showModal, initialForm, draft, onDraftChange]);

  const closeModal = () => {
    setFormData(defaultForm());
    dispatchBuilderUi({ type: 'RESET' });
    onDraftChange?.(null);
    setShowModal(false);
    onClose?.();
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const draftData = {
        ...formData,
        schema: normalizeServiceGroups(formData.schema ?? [], serviceOptions),
        status: 'Draft' as const,
      };
      const saved =
        shouldUseTemplateApi(draftData) && primaryOrgId
          ? await saveTemplateFormDraft(draftData, primaryOrgId)
          : await saveFormDraft(draftData);
      setFormData(saved);
      onDraftChange?.(null);
      setFormData(defaultForm());
      closeModal();
    } catch (err) {
      console.error('Failed to save draft', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    // Single-screen: validate the details and the field schema before publishing.
    // Invalid details reveal the details panel so the inline errors are visible.
    if (!(detailStepRef.current?.validate() ?? true)) {
      dispatchBuilderUi({ type: 'SET_DETAILS', showDetails: true });
      return;
    }
    if (!(buildStepRef.current?.validate() ?? true)) {
      return;
    }
    setIsSaving(true);
    try {
      const publishData = {
        ...formData,
        schema: normalizeServiceGroups(formData.schema ?? [], serviceOptions),
      };
      const saved =
        shouldUseTemplateApi(publishData) && primaryOrgId
          ? await saveTemplateFormDraft(publishData, primaryOrgId)
          : await saveFormDraft(publishData);
      if (saved._id) {
        const published =
          saved.isTemplateBacked && primaryOrgId
            ? await publishTemplateForm(saved, primaryOrgId)
            : await publishForm(saved._id).then(() => ({ ...saved, status: 'Published' as const }));
        setFormData(published);
      }
      onDraftChange?.(null);
      setFormData(defaultForm());
      closeModal();
    } catch (err) {
      console.error('Failed to publish form', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Coerce a stale 'merck' view back to 'build' while rendering when the MSD
  // integration is disabled — deriving this avoids the extra render a useEffect
  // sync would cost.
  const effectiveView = view === 'merck' && !merckEnabled ? 'build' : view;

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} onClose={onClose}>
      <div className="flex h-full flex-col gap-4">
        {/* Header: title + details summary + preview / MSD / close actions */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--hairline)] pb-3">
          <div className="flex flex-col gap-0.5">
            <div className="text-body-1 text-text-primary">
              {isEditing ? 'Edit template' : 'Add template'}
              {formData.name ? ` · ${formData.name}` : ''}
            </div>
            <div className="text-caption-2 text-text-secondary">{detailsSummary}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={view === 'preview'}
              onClick={() => dispatchBuilderUi({ type: 'TOGGLE_VIEW', view: 'preview' })}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-caption-2 font-semibold transition-colors ${
                view === 'preview'
                  ? 'border-[var(--blue)] text-[var(--blue-text)]'
                  : 'border-[var(--divider)] text-text-secondary'
              }`}
            >
              <IoEyeOutline size={15} aria-hidden="true" />
              {view === 'preview' ? 'Back to builder' : 'Preview as parent'}
            </button>
            {merckEnabled && (
              <button
                type="button"
                aria-pressed={view === 'merck'}
                onClick={() => dispatchBuilderUi({ type: 'TOGGLE_VIEW', view: 'merck' })}
                className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-caption-2 font-semibold transition-colors ${
                  view === 'merck'
                    ? 'border-[var(--blue)] text-[var(--blue-text)]'
                    : 'border-[var(--divider)] text-text-secondary'
                }`}
              >
                <Image
                  src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                />
                MSD Veterinary Manual
              </button>
            )}
            <Close onClick={closeModal} />
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col">
          {effectiveView === 'merck' && (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden">
              <AppointmentMerckSearch activeAppointment={null} />
            </div>
          )}

          {effectiveView === 'preview' && (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden">
              <Review
                formData={formData}
                onPublish={handlePublish}
                onSaveDraft={handleSaveDraft}
                serviceOptions={serviceOptions}
                loading={isSaving}
                isEditing={isEditing}
              />
            </div>
          )}

          {effectiveView === 'build' && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {/* Template details fold — always mounted so validation runs; toggled open on demand. */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen-2)] px-4 py-2.5">
                <span className="text-caption-2 text-text-secondary">
                  Template details ·{' '}
                  <span className="text-text-primary">{formData.name || 'Untitled template'}</span>
                </span>
                <button
                  type="button"
                  aria-expanded={showDetails}
                  onClick={() => dispatchBuilderUi({ type: 'TOGGLE_DETAILS' })}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--divider)] px-3 py-1 text-caption-2 font-semibold text-text-secondary"
                >
                  <IoCreateOutline size={14} aria-hidden="true" />
                  {showDetails ? 'Hide details' : 'Edit details'}
                </button>
              </div>

              <div
                className={
                  showDetails
                    ? 'max-h-[40%] overflow-y-auto scrollbar-hidden rounded-2xl border border-[var(--hairline)] p-3'
                    : 'hidden'
                }
              >
                <Details
                  formData={formData}
                  setFormData={setFormData}
                  onNext={
                    /* v8 ignore next -- dead no-op leftover from the old wizard: Details renders with hideNext, so onNext is never invoked */ () =>
                      dispatchBuilderUi({ type: 'SET_DETAILS', showDetails: false })
                  }
                  serviceOptions={serviceOptions}
                  ref={setDetailStepHandle}
                  hideNext
                />
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--hairline)]">
                <Build
                  formData={formData}
                  setFormData={setFormData}
                  serviceOptions={serviceOptions}
                  ref={setBuildStepHandle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: Save / Cancel (preview view uses Review's own action buttons). */}
        {effectiveView !== 'preview' && (
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--hairline)] pt-3">
            <Primary
              href="#"
              text={isEditing ? 'Update & publish' : 'Save template'}
              className="w-full max-h-12! text-lg! tracking-[-0.36px]!"
              onClick={handlePublish}
              isDisabled={isSaving}
            />
            <Secondary
              href="#"
              text={isEditing ? 'Update draft' : 'Save as draft'}
              className="w-full max-h-12! text-lg! tracking-[-0.36px]!"
              onClick={handleSaveDraft}
              isDisabled={isSaving}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AddForm;
