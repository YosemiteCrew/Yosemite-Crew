import React from 'react';
import { IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5';
import SubLabels from '@/app/ui/widgets/Labels/SubLabels';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';

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

const DEFAULT_STATUSES: Record<string, 'valid' | 'error' | undefined> = {};

const Labels = ({
  labels,
  activeLabel,
  setActiveLabel,
  activeSubLabel,
  setActiveSubLabel,
  statuses = DEFAULT_STATUSES,
  disableClicking = false,
}: LabelsProps) => {
  const active = labels.find((l) => l.key === activeLabel);
  const subLabels = active ? active.labels : [];
  const useCenteredLayout = labels.length <= 3;
  const onWheelHorizontal = useWheelToHorizontalScroll();

  return (
    <div className="mx-auto inline-flex w-full flex-col gap-2">
      <div
        className={`flex w-full items-center gap-2 overflow-x-auto scrollbar-x-float whitespace-nowrap pb-1 ${
          useCenteredLayout ? 'justify-center' : 'justify-start px-1 sm:px-2'
        }`}
        onWheel={onWheelHorizontal}
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
            className={`shrink-0 min-w-20 h-9 text-body-4 px-3 rounded-full! border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
              label.key === activeLabel
                ? 'bg-[var(--color-pill-neutral-bg)] text-[var(--ink)]! border-[var(--color-pill-neutral-border)]! font-bold'
                : 'text-[var(--ink-soft)] border-[var(--hairline)]! font-semibold hover:bg-card-hover!'
            } ${disableClicking ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5 text-center w-full">
              {label.name}
              {/* Shape, not just hue: --success and --danger differ by 0.0005 in
                  relative luminance, so in greyscale (or to a red-green
                  colourblind user) a saved section and a failed one were the
                  same dot. */}
              {statuses[label.key] === 'valid' && (
                <IoCheckmarkCircle
                  role="img"
                  title="Section complete"
                  aria-label="Section complete"
                  className="size-4 shrink-0 text-[var(--color-pill-success-text)]"
                />
              )}
              {statuses[label.key] === 'error' && (
                <IoAlertCircle
                  role="img"
                  title="Section has errors"
                  aria-label="Section has errors"
                  className="size-4 shrink-0 text-[var(--color-pill-danger-text)]"
                />
              )}
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
