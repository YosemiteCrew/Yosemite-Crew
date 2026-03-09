import React from 'react';
import Link from 'next/link';
import { MdOpenInNew } from 'react-icons/md';

type SubLabelItem = {
  key: string;
  name: React.ReactNode;
  redirectHref?: string;
  redirectLabel?: string;
};

type SubLabelsProps = {
  labels: SubLabelItem[];
  activeLabel?: string;
  setActiveLabel?: any;
  statuses?: Record<string, 'valid' | 'error' | undefined>;
  disableClicking?: boolean;
};

const SubLabels = ({
  labels,
  activeLabel,
  setActiveLabel,
  statuses = {},
  disableClicking = false,
}: SubLabelsProps) => {
  const isLogoOnlyIdexx = labels.length === 1 && labels[0]?.key === 'idexx-labs';
  const containerClassName = isLogoOnlyIdexx
    ? 'inline-flex justify-center items-center w-fit mx-auto'
    : 'inline-flex gap-2 justify-center flex-wrap items-center rounded-2xl p-1 border border-card-border bg-card-hover w-fit mx-auto';

  return (
    <div className={containerClassName}>
      {labels.map((label) => {
        const disabledClass = disableClicking ? 'opacity-70 cursor-not-allowed' : '';
        const activeClass =
          activeLabel === label.key
            ? 'bg-white! text-blue-text! border-text-brand!'
            : 'text-black-text border-transparent hover:bg-white';
        const buttonClassName = isLogoOnlyIdexx
          ? `transition-all duration-200 flex items-center focus-visible:outline-none ${disabledClass}`
          : `transition-all duration-200 text-body-4 h-9 px-3 flex items-center rounded-2xl! border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text ${activeClass} ${disabledClass}`;
        return (
          <div key={label.key} className="flex items-center gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={activeLabel === label.key}
              disabled={disableClicking}
              onClick={() => setActiveLabel?.(label.key)}
              className={buttonClassName}
            >
              <span className="flex items-center justify-center gap-2 text-center w-full">
                {label.name}
                {statuses[label.key] === 'valid' && (
                  <span className="text-green-600 text-sm">•</span>
                )}
                {statuses[label.key] === 'error' && <span className="text-red-500 text-sm">•</span>}
              </span>
            </button>
            {label.redirectHref && !disableClicking && (
              <Link
                href={label.redirectHref}
                aria-label={label.redirectLabel ?? 'Open linked page'}
                className="h-6 w-6 rounded-full border border-card-border bg-white text-text-secondary hover:text-text-brand hover:border-text-brand transition-colors inline-flex items-center justify-center"
              >
                <MdOpenInNew size={13} />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SubLabels;
