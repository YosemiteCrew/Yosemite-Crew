import React from 'react';
import SubLabels from '@/app/ui/widgets/Labels/SubLabels';

type LabelItem = {
  key: string;
  name: React.ReactNode;
  labels?: {
    key: string;
    name: React.ReactNode;
    redirectHref?: string;
    redirectLabel?: string;
  }[];
};

type LabelsProps = {
  labels: LabelItem[];
  activeLabel: string;
  setActiveLabel: any;
  activeSubLabel?: string;
  setActiveSubLabel?: any;
  statuses?: Record<string, 'valid' | 'error' | undefined>;
  disableClicking?: boolean;
};

const Labels = ({
  labels,
  activeLabel,
  setActiveLabel,
  activeSubLabel,
  setActiveSubLabel,
  statuses = {},
  disableClicking = false,
}: LabelsProps) => {
  const active = labels.find((l) => l.key === activeLabel);
  const subLabels = active ? active.labels : [];
  const useCenteredLayout = labels.length <= 3;

  return (
    <div className="mx-auto inline-flex w-full flex-col gap-2">
      <div
        className={`flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 ${
          useCenteredLayout ? 'justify-center' : 'justify-start px-1 sm:px-2'
        }`}
        role="tablist"
        aria-label="Section navigation"
      >
        {labels.map((label) => (
          <button
            key={label.key}
            type="button"
            role="tab"
            aria-selected={label.key === activeLabel}
            disabled={disableClicking}
            onClick={() => setActiveLabel(label.key)}
            className={`shrink-0 min-w-20 h-9 text-body-4 px-3 text-text-secondary rounded-2xl! border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text ${
              label.key === activeLabel
                ? 'bg-blue-light text-blue-text! border-text-brand!'
                : 'border-card-border! hover:bg-card-hover!'
            } ${disableClicking ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5 text-center w-full">
              {label.name}
              {statuses[label.key] === 'valid' && <span className="text-green-600 text-sm">•</span>}
              {statuses[label.key] === 'error' && <span className="text-red-500 text-sm">•</span>}
            </span>
          </button>
        ))}
      </div>
      {subLabels && subLabels.length > 0 && (
        <SubLabels
          labels={subLabels}
          activeLabel={activeSubLabel}
          setActiveLabel={setActiveSubLabel}
          disableClicking={disableClicking}
          statuses={statuses}
        />
      )}
    </div>
  );
};

export default Labels;
