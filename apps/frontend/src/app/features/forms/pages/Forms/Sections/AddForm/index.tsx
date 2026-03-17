import Modal from '@/app/ui/overlays/Modal';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Details from '@/app/features/forms/pages/Forms/Sections/AddForm/Details';
import Build from '@/app/features/forms/pages/Forms/Sections/AddForm/Build';
import Review from '@/app/features/forms/pages/Forms/Sections/AddForm/Review';
import AppointmentMerckSearch from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch';
import { FormsCategory, FormsProps } from '@/app/features/forms/types/forms';
import { publishForm, saveFormDraft } from '@/app/features/forms/services/formService';
import Close from '@/app/ui/primitives/Icons/Close';
import Labels from '@/app/ui/widgets/Labels/Labels';
import { useOrgStore } from '@/app/stores/orgStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';

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
      <Image
        src={MEDIA_SOURCES.futureAssets.merckLogoUrl}
        alt="Merck Manuals"
        width={74}
        height={28}
        className="object-contain"
      />
    ),
    key: 'merck-manuals',
  },
];

type AddFormProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  initialForm?: FormsProps | null;
  onClose?: () => void;
  serviceOptions: { label: string; value: string }[];
  draft?: FormsProps | null;
  onDraftChange?: (draft: FormsProps | null) => void;
};

const defaultForm = (): FormsProps => {
  const primaryOrg = useOrgStore.getState().getPrimaryOrg?.();
  return {
    name: '',
    category: '' as FormsCategory,
    usage: 'Internal',
    requiredSigner: undefined,
    updatedBy: '',
    lastUpdated: '',
    status: 'Draft',
    schema: [],
    businessType: primaryOrg?.type,
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
  const [activeLabel, setActiveLabel] = useState('form-details');
  const [formData, setFormData] = useState<FormsProps>(draft ?? initialForm ?? defaultForm());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const detailValidatorRef = useRef<() => boolean>(() => true);
  const buildValidatorRef = useRef<() => boolean>(() => true);
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenRef = useRef(false);
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();

  const isEditing = useMemo(() => Boolean(initialForm?._id), [initialForm]);
  const labelOptions = useMemo(
    () =>
      merckEnabled ? LabelOptions : LabelOptions.filter((label) => label.key !== 'merck-manuals'),
    [merckEnabled]
  );

  useEffect(() => {
    if (showModal && !wasOpenRef.current) {
      setActiveLabel('form-details');
      const next = {
        ...(initialForm ?? draft ?? defaultForm()),
        businessType:
          initialForm?.businessType ??
          draft?.businessType ??
          useOrgStore.getState().getPrimaryOrg?.()?.type,
      };
      setFormData(next);
      wasOpenRef.current = true;
    }
    if (!showModal) {
      wasOpenRef.current = false;
    }
  }, [showModal, initialForm, draft]);

  useEffect(() => {
    if (!initialForm) {
      onDraftChange?.(formData);
    }
  }, [formData, onDraftChange, initialForm]);

  const closeModal = () => {
    setFormData(defaultForm());
    setActiveLabel('form-details');
    onDraftChange?.(null);
    setActiveLabel('form-details');
    setShowModal(false);
    onClose?.();
  };

  const goToNextStep = () => {
    if (activeLabel === 'form-details') {
      if (!detailValidatorRef.current()) return;
      setActiveLabel('build-form');
    } else if (activeLabel === 'build-form') {
      if (!buildValidatorRef.current()) return;
      setActiveLabel('review');
    }
  };

  const handleLabelClick = (target: string) => {
    if (target === activeLabel) return;
    if (target === 'build-form' || target === 'review') {
      if (!detailValidatorRef.current()) return;
    }
    if (target === 'review') {
      if (!buildValidatorRef.current()) return;
    }
    setActiveLabel(target);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const saved = await saveFormDraft({
        ...formData,
        status: 'Draft',
      });
      setFormData(saved);
      onDraftChange?.(null);
      setFormData(defaultForm());
      setActiveLabel('form-details');
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
      const saved = await saveFormDraft(formData);
      if (saved._id) {
        await publishForm(saved._id);
        setFormData({ ...saved, status: 'Published' });
      }
      onDraftChange?.(null);
      setFormData(defaultForm());
      setActiveLabel('form-details');
      closeModal();
    } catch (err) {
      console.error('Failed to publish form', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeLabel]);

  useEffect(() => {
    if (!merckEnabled && activeLabel === 'merck-manuals') {
      setActiveLabel('form-details');
    }
  }, [merckEnabled, activeLabel]);

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

        <Labels labels={labelOptions} activeLabel={activeLabel} setActiveLabel={handleLabelClick} />

        <div
          ref={scrollRef}
          className={`flex flex-1 min-h-0 scrollbar-hidden ${
            activeLabel === 'merck-manuals' ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {activeLabel === 'form-details' && (
            <Details
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              registerValidator={(fn) => {
                detailValidatorRef.current = fn;
              }}
            />
          )}
          {activeLabel === 'build-form' && (
            <Build
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              registerValidator={(fn) => {
                buildValidatorRef.current = fn;
              }}
            />
          )}
          {activeLabel === 'review' && (
            <Review
              formData={formData}
              onPublish={handlePublish}
              onSaveDraft={handleSaveDraft}
              serviceOptions={serviceOptions}
              loading={isSaving}
              isEditing={isEditing}
            />
          )}
          {merckEnabled && activeLabel === 'merck-manuals' && (
            <AppointmentMerckSearch activeAppointment={null} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddForm;
