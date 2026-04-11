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

const getContainerClassName = (isLogoOnlyIdexx: boolean): string => {
  if (isLogoOnlyIdexx) {
    return 'inline-flex justify-center items-center w-fit mx-auto pb-2';
  }
  return 'inline-flex gap-2 justify-center flex-wrap items-center rounded-2xl p-1 border border-card-border bg-card-hover w-fit mx-auto';
};

const getPillClassName = ({
  isLogoOnlyWithRedirect,
  hasEmbeddedRedirect,
  activeClass,
  disabledClass,
}: {
  isLogoOnlyWithRedirect: boolean;
  hasEmbeddedRedirect: boolean;
  activeClass: string;
  disabledClass: string;
}): string => {
  if (isLogoOnlyWithRedirect) {
    return `transition-all duration-200 h-9 flex items-center rounded-2xl! border border-card-border bg-white my-1 pl-1.5 pr-1.5 gap-0 ${disabledClass}`;
  }
  if (hasEmbeddedRedirect) {
    return `transition-all duration-200 h-9 flex items-center rounded-2xl! border focus-within:ring-2 focus-within:ring-blue-text ${activeClass} ${disabledClass}`;
  }
  return '';
};

const getButtonClassName = ({
  isLogoOnlyWithRedirect,
  isLogoOnlyIdexx,
  hasEmbeddedRedirect,
  activeClass,
  disabledClass,
}: {
  isLogoOnlyWithRedirect: boolean;
  isLogoOnlyIdexx: boolean;
  hasEmbeddedRedirect: boolean;
  activeClass: string;
  disabledClass: string;
}): string => {
  if (isLogoOnlyWithRedirect) {
    return 'transition-all duration-200 flex items-center py-1.5 pl-2 pr-0.5 focus-visible:outline-none rounded-l-2xl!';
  }
  if (isLogoOnlyIdexx) {
    return `transition-all duration-200 flex items-center py-1.5 px-2 rounded-2xl! border border-card-border bg-white focus-visible:outline-none ${disabledClass}`;
  }
  if (hasEmbeddedRedirect) {
    return 'h-full pl-3 pr-2 flex items-center focus-visible:outline-none rounded-l-2xl!';
  }
  return `transition-all duration-200 text-body-4 h-9 px-3 flex items-center rounded-2xl! border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text ${activeClass} ${disabledClass}`;
};

const getItemClassName = (isLogoOnlyIdexx: boolean, hasEmbeddedRedirect: boolean): string => {
  if (hasEmbeddedRedirect) return '';
  return isLogoOnlyIdexx ? 'flex items-center gap-1.5 my-1' : 'flex items-center gap-1.5';
};

const getRedirectClassName = (
  isLogoOnlyWithRedirect: boolean,
  hasEmbeddedRedirect: boolean
): string => {
  if (isLogoOnlyWithRedirect) {
    return 'h-7 px-1 text-text-secondary hover:text-text-brand transition-colors inline-flex items-center justify-center focus-visible:outline-none';
  }
  if (hasEmbeddedRedirect) {
    return 'h-full pr-3 pl-1 inline-flex items-center justify-center text-text-secondary hover:text-text-brand focus-visible:outline-none rounded-r-2xl!';
  }
  return 'h-6 w-6 rounded-full border border-card-border bg-white text-text-secondary hover:text-text-brand hover:border-text-brand transition-colors inline-flex items-center justify-center';
};

const SubLabels = ({
  labels,
  activeLabel,
  setActiveLabel,
  statuses = {},
  disableClicking = false,
}: SubLabelsProps) => {
  const isLogoOnlyIdexx = labels.length === 1 && labels[0]?.key === 'idexx-labs';
  const containerClassName = getContainerClassName(isLogoOnlyIdexx);

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
        const pillClassName = getPillClassName({
          isLogoOnlyWithRedirect,
          hasEmbeddedRedirect,
          activeClass,
          disabledClass,
        });
        const buttonClassName = getButtonClassName({
          isLogoOnlyWithRedirect,
          isLogoOnlyIdexx,
          hasEmbeddedRedirect,
          activeClass,
          disabledClass,
        });
        const itemClassName = hasEmbeddedRedirect
          ? pillClassName
          : getItemClassName(isLogoOnlyIdexx, hasEmbeddedRedirect);
        const redirectClassName = getRedirectClassName(isLogoOnlyWithRedirect, hasEmbeddedRedirect);
        return (
          <div key={label.key} className={itemClassName}>
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
                className={redirectClassName}
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
