import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import Labels from '@/app/ui/widgets/Labels/Labels';
import Modal from '@/app/ui/overlays/Modal';
import { Companion, Parent, Core, History } from '@/app/features/companions/components/Sections';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

type CompanionInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent | null;
  canEditCompanionStatus?: boolean;
  initialLabel?: LabelKey;
};
type LabelKey = 'info' | 'history';
type SubLabelKey = 'companion-information' | 'parent-information' | 'history';

const getLabels = (terminologyText: (text: string) => string) => [
  {
    key: 'info',
    name: 'Info',
    labels: [
      { key: 'companion-information', name: terminologyText('Patient information') },
      { key: 'parent-information', name: 'Parent information' },
    ],
  },
  {
    key: 'history',
    name: 'Overview',
  },
];

const COMPONENT_MAP: Record<string, Record<string, React.FC<any>>> = {
  info: {
    'companion-information': Companion,
    'parent-information': Parent,
    'core-information': Core,
  },
  history: {
    history: History,
  },
};

const CompanionInfo = ({
  showModal,
  setShowModal,
  activeCompanion,
  canEditCompanionStatus = false,
  initialLabel = 'info',
}: CompanionInfoProps) => {
  const terminologyText = useCompanionTerminologyText();
  const labels = useMemo(() => getLabels(terminologyText), [terminologyText]);
  const router = useRouter();
  const [activeLabel, setActiveLabel] = useState<LabelKey>(labels[0].key as LabelKey);
  const [activeSubLabel, setActiveSubLabel] = useState<SubLabelKey>(
    labels[0].labels?.[0]?.key as SubLabelKey
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeLabelConfig = labels.find((label) => label.key === activeLabel);
  const Content =
    activeLabelConfig?.labels && activeLabelConfig.labels.length > 0
      ? COMPONENT_MAP[activeLabel]?.[activeSubLabel]
      : COMPONENT_MAP[activeLabel]?.[activeLabel];

  const selectActiveLabel = useCallback(
    (labelKey: LabelKey) => {
      const current = labels.find((l) => l.key === labelKey);
      setActiveLabel(labelKey);
      if (current?.labels && current.labels.length > 0) {
        setActiveSubLabel(current.labels[0].key as SubLabelKey);
        return;
      }
      if (current?.key) {
        setActiveSubLabel(current.key as SubLabelKey);
      }
    },
    [labels]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeLabel, activeSubLabel]);

  useEffect(() => {
    if (!showModal) return;
    selectActiveLabel(initialLabel);
  }, [showModal, initialLabel, activeCompanion?.companion.id, selectActiveLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col gap-3">
          <ModalHeader
            title={formatCompanionNameWithOwnerLastName(
              activeCompanion?.companion.name,
              activeCompanion?.parent
            )}
            meta={activeCompanion?.companion.breed}
            icon={
              <CompanionAvatar
                alt={terminologyText('pet image')}
                photoUrl={activeCompanion?.companion.photoUrl}
                name={activeCompanion?.companion.name}
                speciesType={activeCompanion?.companion.type}
                seed={activeCompanion?.companion.id}
                size={40}
                textClassName="text-body-2"
              />
            }
            actions={
              <Secondary
                href="#"
                size="compact"
                text="Open overview"
                onClick={() => {
                  router.push(
                    buildCompanionOverviewHref(
                      activeCompanion?.companion?.id,
                      activeCompanion?.companion?.id
                        ? `/companions?${new URLSearchParams({
                            companionId: activeCompanion.companion.id,
                          }).toString()}`
                        : ''
                    )
                  );
                  setShowModal(false);
                }}
              />
            }
            onClose={() => setShowModal(false)}
          />

          <Labels
            labels={labels}
            activeLabel={activeLabel}
            setActiveLabel={selectActiveLabel}
            activeSubLabel={activeSubLabel}
            setActiveSubLabel={setActiveSubLabel}
          />
        </div>

        <div ref={scrollRef} className="flex overflow-y-auto flex-1 scrollbar-hidden">
          {Content ? (
            <Content companion={activeCompanion} canEditCompanionStatus={canEditCompanionStatus} />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default CompanionInfo;
