import React, { useEffect, useRef, useState } from 'react';
import Parent from '@/app/features/companions/components/AddCompanion/Sections/Parent';
import type { ParentSectionRef } from '@/app/features/companions/components/AddCompanion/Sections/Parent';
import Companion from '@/app/features/companions/components/AddCompanion/Sections/Companion';
import Modal from '@/app/ui/overlays/Modal';
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from '@/app/features/companions/components/AddCompanion/type';
import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';
import Close from '@/app/ui/primitives/Icons/Close';
import Labels from '@/app/ui/widgets/Labels/Labels';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const LabelOptions = [
  {
    name: 'Parents details',
    key: 'parents',
  },
  {
    name: 'Companion information',
    key: 'companion',
  },
];

type AddCompanionProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddCompanion = ({ showModal, setShowModal }: AddCompanionProps) => {
  const terminologyText = useCompanionTerminologyText();
  const [activeLabel, setActiveLabel] = useState<string>('parents');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const parentSectionRef = useRef<ParentSectionRef | null>(null);
  const [parentFormData, setParentFormData] = useState<StoredParent>(EMPTY_STORED_PARENT);
  const [companionFormData, setCompanionFormData] =
    useState<StoredCompanion>(EMPTY_STORED_COMPANION);

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

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">{terminologyText('Add companion')}</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <Labels
          labels={LabelOptions}
          activeLabel={activeLabel}
          setActiveLabel={handleLabelChange}
        />

        <div ref={scrollRef} className="flex overflow-y-auto flex-1 scrollbar-hidden">
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
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddCompanion;
