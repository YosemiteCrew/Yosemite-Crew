import React from 'react';

export type TabOption = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

type TabToggleProps = {
  tabs: TabOption[];
  activeKey: string;
  onChange: (key: string) => void;
  panelId?: (key: string) => string;
};

const TabToggle = ({ tabs, activeKey, onChange, panelId }: TabToggleProps) => {
  return (
    /* The hairline lives on this wrapper, not on the tablist, because the
       tablist is the scroll container: the active tab's `-mb-px` indicator has
       to overlap a border that does not scroll away underneath it. */
    <div className="w-full border-b border-card-border">
      <div
        role="tablist"
        /* Tabs share the row equally while they fit, which is every call site
           today - all three pass exactly two. When they stop fitting the strip
           scrolls at its natural width instead of pushing its container: this
           lives in the workspace side modal, which has nothing to absorb a
           sideways shove, and a tab clipped at the edge is the cue that there
           is more. */
        className="-mb-px flex overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={panelId?.(tab.key)}
              id={`tab-${tab.key}`}
              onClick={() => onChange(tab.key)}
              /* `whitespace-nowrap`: a label that breaks mid-phrase ("All /
               documents") reads worse than a scroll, and the second line pushes
               this tab's underline below its neighbours'. Nowrap is also what
               gives the row a real min-content width to overflow at, which is
               what the scroller above is there to catch. */
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-6 py-3 leading-[120%] transition-colors duration-150 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
                isActive
                  ? 'border-[var(--blue)] text-[var(--blue-text)] text-[16px] font-bold'
                  : 'border-transparent text-neutral-700 text-[16px] font-medium hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabToggle;
