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
    ? 'inline-flex justify-center items-center w-fit mx-auto pb-2'
    : 'inline-flex gap-2 justify-center flex-wrap items-center rounded-2xl p-1 border border-card-border bg-card-hover w-fit mx-auto';

  return (
    <div className={containerClassName}>
      {labels.map((label) => {
        const disabledClass = disableClicking ? 'opacity-70 cursor-not-allowed' : '';
        const activeClass =
          activeLabel === label.key
            ? 'bg-white! text-blue-text! border-text-brand!'
            : 'text-black-text border-transparent hover:bg-white';
        const isLogoOnlyWithRedirect = isLogoOnlyIdexx && Boolean(label.redirectHref);
        const hasEmbeddedRedirect = Boolean(label.redirectHref);
        const pillClassName = isLogoOnlyWithRedirect
          ? `transition-all duration-200 h-9 flex items-center rounded-2xl! border border-card-border bg-white my-1 pl-1.5 pr-1.5 gap-0 ${disabledClass}`
          : hasEmbeddedRedirect
            ? `transition-all duration-200 h-9 flex items-center rounded-2xl! border focus-within:ring-2 focus-within:ring-blue-text ${activeClass} ${disabledClass}`
            : '';
        let buttonClassName: string;
        if (isLogoOnlyWithRedirect) {
          buttonClassName =
            'transition-all duration-200 flex items-center py-1.5 pl-2 pr-0.5 focus-visible:outline-none rounded-l-2xl!';
        } else if (isLogoOnlyIdexx) {
          buttonClassName = `transition-all duration-200 flex items-center py-1.5 px-2 rounded-2xl! border border-card-border bg-white focus-visible:outline-none ${disabledClass}`;
        } else if (hasEmbeddedRedirect) {
          buttonClassName =
            'h-full pl-3 pr-2 flex items-center focus-visible:outline-none rounded-l-2xl!';
        } else {
          buttonClassName = `transition-all duration-200 text-body-4 h-9 px-3 flex items-center rounded-2xl! border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text ${activeClass} ${disabledClass}`;
        }
        return (
          <div
            key={label.key}
            className={
              hasEmbeddedRedirect
                ? pillClassName
                : isLogoOnlyIdexx
                  ? 'flex items-center gap-1.5 my-1'
                  : 'flex items-center gap-1.5'
            }
          >
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
                className={
                  isLogoOnlyWithRedirect
                    ? 'h-7 px-1 text-text-secondary hover:text-text-brand transition-colors inline-flex items-center justify-center focus-visible:outline-none'
                    : hasEmbeddedRedirect
                      ? 'h-full pr-3 pl-1 inline-flex items-center justify-center text-text-secondary hover:text-text-brand focus-visible:outline-none rounded-r-2xl!'
                      : 'h-6 w-6 rounded-full border border-card-border bg-white text-text-secondary hover:text-text-brand hover:border-text-brand transition-colors inline-flex items-center justify-center'
                }
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
