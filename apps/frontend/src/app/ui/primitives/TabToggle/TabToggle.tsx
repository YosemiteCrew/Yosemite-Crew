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
        /* Tabs keep sharing the row equally, and a label still wraps inside its
           own button before the split goes uneven. That is deliberate: at 375px
           with "Vitals" beside "Observation Tool" it is the difference between
           an even strip and a lopsided one, and RecordPanel's phone story pins
           it. Forcing `whitespace-nowrap` here looked tidier and broke exactly
           that - the labels stayed on one line and the split went 18px out.

           What is new is the scroller. Once the labels cannot fit even after
           wrapping - four tabs in a side modal - the strip used to push its
           container sideways, and a side modal has nothing to absorb that. The
           overflow now stays inside the strip, and a tab clipped at the edge is
           the cue that there is more. It costs nothing where the tabs already
           fit, which is every call site today: all three pass exactly two. */
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
              className={`flex flex-1 items-center justify-center gap-1.5 px-6 py-3 leading-[120%] transition-colors duration-150 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
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
