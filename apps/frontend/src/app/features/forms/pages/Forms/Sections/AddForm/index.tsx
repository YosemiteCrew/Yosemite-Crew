import Modal from '@/app/ui/overlays/Modal';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import Labels from '@/app/ui/widgets/Labels/Labels';
import { useOrgStore } from '@/app/stores/orgStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import { shouldUseTemplateApi } from '@/app/lib/forms';

const LabelOptions = [
  {
    name: 'Form details',
    key: 'form-details',
  },
  {
    name: 'Build form',
    key: 'build-form',
  },
  {
    name: 'Review',
    key: 'review',
  },
  {
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
    key: 'merck-manuals',
  },
];

type AddFormProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  initialForm?: FormsProps | null;
  onClose?: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  draft?: FormsProps | null;
  onDraftChange?: (draft: FormsProps | null) => void;
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

const resolveActiveLabel = (label: string, merckEnabled: boolean) =>
  !merckEnabled && label === 'merck-manuals' ? 'form-details' : label;

const AddForm = ({
  showModal,
  setShowModal,
  initialForm,
  onClose,
  serviceOptions,
  draft,
  onDraftChange,
}: AddFormProps) => {
  const [activeLabel, setActiveLabel] = useState('form-details');
  const [formData, setFormData] = useState<FormsProps>(draft ?? initialForm ?? defaultForm());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Keep the last non-null handle so validation still applies while the step
  // is unmounted (e.g. checking Details validity from the Merck tab).
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
  const labelOptions = useMemo(
    () =>
      merckEnabled ? LabelOptions : LabelOptions.filter((label) => label.key !== 'merck-manuals'),
    [merckEnabled]
  );
  const visibleActiveLabel = resolveActiveLabel(activeLabel, merckEnabled);

  const selectActiveLabel = useCallback(
    (label: string) => {
      setActiveLabel(resolveActiveLabel(label, merckEnabled));
    },
    [merckEnabled]
  );
  const updateFormData = useCallback<React.Dispatch<React.SetStateAction<FormsProps>>>(
    (nextFormData) => {
      setFormData((previousFormData) => {
        const resolvedFormData =
          typeof nextFormData === 'function' ? nextFormData(previousFormData) : nextFormData;
        if (!initialForm) {
          onDraftChange?.(resolvedFormData);
        }
        return resolvedFormData;
      });
    },
    [initialForm, onDraftChange]
  );

  useLayoutEffect(() => {
    if (showModal && !wasOpenRef.current) {
      selectActiveLabel('form-details');
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
  }, [showModal, initialForm, draft, selectActiveLabel, onDraftChange]);

  const closeModal = () => {
    setFormData(defaultForm());
    onDraftChange?.(null);
    selectActiveLabel('form-details');
    setShowModal(false);
    onClose?.();
  };

  const goToNextStep = () => {
    if (visibleActiveLabel === 'form-details') {
      if (!(detailStepRef.current?.validate() ?? true)) return;
      selectActiveLabel('build-form');
    } else if (visibleActiveLabel === 'build-form') {
      if (!(buildStepRef.current?.validate() ?? true)) return;
      selectActiveLabel('review');
    }
  };

  const handleLabelClick = (target: string) => {
    if (target === visibleActiveLabel) return;
    if (target === 'build-form' || target === 'review') {
      if (!(detailStepRef.current?.validate() ?? true)) return;
    }
    if (target === 'review') {
      if (!(buildStepRef.current?.validate() ?? true)) return;
    }
    selectActiveLabel(target);
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
      selectActiveLabel('form-details');
      closeModal();
    } catch (err) {
      console.error('Failed to save draft', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
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
      selectActiveLabel('form-details');
      closeModal();
    } catch (err) {
      console.error('Failed to publish form', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [visibleActiveLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} onClose={onClose}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">
              {isEditing ? 'Edit form' : 'Add form'}
            </div>
          </div>
          <Close onClick={closeModal} />
        </div>

        <Labels
          labels={labelOptions}
          activeLabel={visibleActiveLabel}
          setActiveLabel={handleLabelClick}
        />

        <div ref={scrollRef} className="flex flex-1 min-h-0 scrollbar-hidden overflow-y-auto">
          {visibleActiveLabel === 'form-details' && (
            <Details
              formData={formData}
              setFormData={updateFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              ref={setDetailStepHandle}
            />
          )}
          {visibleActiveLabel === 'build-form' && (
            <Build
              formData={formData}
              setFormData={updateFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              ref={setBuildStepHandle}
            />
          )}
          {visibleActiveLabel === 'review' && (
            <Review
              formData={formData}
              onPublish={handlePublish}
              onSaveDraft={handleSaveDraft}
              serviceOptions={serviceOptions}
              loading={isSaving}
              isEditing={isEditing}
            />
          )}
          {merckEnabled && visibleActiveLabel === 'merck-manuals' && (
            <AppointmentMerckSearch activeAppointment={null} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddForm;
