import React, { useEffect, useRef, useState } from 'react';
import Parent from '@/app/features/companions/components/AddCompanion/Sections/Parent';
import type { ParentSectionRef } from '@/app/features/companions/components/AddCompanion/Sections/Parent';
import Companion from '@/app/features/companions/components/AddCompanion/Sections/Companion';
import Modal from '@/app/ui/overlays/Modal';
import {
  createEmptyStoredCompanion,
  EMPTY_STORED_PARENT,
  CompanionFormData,
} from '@/app/features/companions/components/AddCompanion/type';
import { StoredParent } from '@/app/features/companions/pages/Companions/types';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Labels from '@/app/ui/widgets/Labels/Labels';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const getLabelOptions = (terminologyText: (text: string) => string) => [
  {
    name: 'Parents details',
    key: 'parents',
  },
  {
    name: terminologyText('Companion information'),
    key: 'companion',
  },
];

type AddCompanionProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onCompanionCreated?: (companionId: string) => void;
  mode?: 'default' | 'fasttrack';
};

const AddCompanion = ({
  showModal,
  setShowModal,
  onCompanionCreated,
  mode = 'default',
}: AddCompanionProps) => {
  const terminologyText = useCompanionTerminologyText();
  const labelOptions = getLabelOptions(terminologyText);
  const [activeLabel, setActiveLabel] = useState<string>('parents');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const parentSectionRef = useRef<ParentSectionRef | null>(null);
  const [parentFormData, setParentFormData] = useState<StoredParent>(EMPTY_STORED_PARENT);
  const [companionFormData, setCompanionFormData] = useState<CompanionFormData>(
    createEmptyStoredCompanion()
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeLabel]);

  const handleLabelChange = (label: string) => {
    if (label === 'companion' && activeLabel === 'parents') {
      const isParentValid = parentSectionRef.current?.validateStep();
      if (isParentValid === false) {
        return;
      }
    }
    setActiveLabel(label);
  };

  const stepIndex = activeLabel === 'parents' ? 1 : 2;
  const stepSubtitle =
    activeLabel === 'parents'
      ? 'Step 1 of 2 · parent details'
      : terminologyText('Step 2 of 2 · patient details');

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      variant="centered"
      size="md"
      aria-label={terminologyText('Add companion')}
    >
      <div className="flex flex-col flex-auto min-h-0 gap-6">
        <ModalHeader
          title={terminologyText('Add companion')}
          meta={stepSubtitle}
          onClose={() => setShowModal(false)}
        />

        {/* Progress dots — mirror the two-step flow. Step 1 is always reached, so the
            first dot is always active; the second lights up on the companion step. */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-[5px] w-[22px] rounded-full bg-[var(--cta)]" />
          <span
            className={`h-[5px] w-[22px] rounded-full ${
              stepIndex >= 2 ? 'bg-[var(--cta)]' : 'bg-[var(--divider)]'
            }`}
          />
        </div>

        <Labels
          labels={labelOptions}
          activeLabel={activeLabel}
          setActiveLabel={handleLabelChange}
        />

        <div ref={scrollRef} className="flex overflow-y-auto flex-auto min-h-0 scrollbar-hidden">
          {activeLabel === 'parents' && (
            <Parent
              ref={parentSectionRef}
              setActiveLabel={setActiveLabel}
              formData={parentFormData}
              setFormData={setParentFormData}
            />
          )}
          {activeLabel === 'companion' && (
            <Companion
              setActiveLabel={setActiveLabel}
              formData={companionFormData}
              setFormData={setCompanionFormData}
              parentFormData={parentFormData}
              setParentFormData={setParentFormData}
              setShowModal={setShowModal}
              mode={mode}
              onCompanionCreated={(companion) => {
                onCompanionCreated?.(companion.id);
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddCompanion;
