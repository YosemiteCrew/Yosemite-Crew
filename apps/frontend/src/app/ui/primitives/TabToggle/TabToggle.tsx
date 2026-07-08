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
    <div role="tablist" className="flex w-full border-b border-card-border">
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
            className={`flex flex-1 items-center justify-center gap-1.5 px-6 py-3 leading-[120%] transition-colors duration-150 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
              isActive
                ? 'border-[#006AE0] text-[#006AE0] text-[16px] font-bold'
                : 'border-transparent text-neutral-700 text-[16px] font-medium hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default TabToggle;
