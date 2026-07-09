import React from 'react';
import type { IconType } from 'react-icons';
import {
  LuActivity,
  LuActivitySquare,
  LuBookOpen,
  LuCalculator,
  LuClipboardList,
  LuFileText,
  LuMessageSquare,
} from 'react-icons/lu';
import type { SideAction } from '@/app/features/appointments/types/workspace';

type WorkspaceActionRailProps = {
  activeAction: SideAction | null;
  onSelect: (action: SideAction) => void;
};

const RAIL_ITEMS: { key: SideAction; label: string; icon: IconType }[] = [
  { key: 'RECORD', label: 'Record vitals', icon: LuActivitySquare },
  { key: 'TASKS', label: 'Tasks', icon: LuClipboardList },
  { key: 'DOCUMENTS', label: 'Documents', icon: LuFileText },
  { key: 'CHAT', label: 'Chat', icon: LuMessageSquare },
  { key: 'ACTIVITY', label: 'Activity', icon: LuActivity },
  { key: 'MSD', label: 'MSD Manual', icon: LuBookOpen },
  { key: 'CALCULATORS', label: 'Calculators', icon: LuCalculator },
];

/**
 * Persistent quick-actions rail docked to the right of the workspace step content
 * (design: the 58px icon strip beside the SOAP note). Each icon opens the matching
 * Quick Actions panel — the same targets previously reachable only via the header's
 * "Quick Actions" button, now always visible across every step.
 */
const WorkspaceActionRail = ({ activeAction, onSelect }: WorkspaceActionRailProps) => (
  <nav
    aria-label="Workspace quick actions"
    className="hidden w-[58px] shrink-0 flex-col items-center gap-1.5 self-stretch rounded-2xl border border-card-border bg-neutral-100 py-3.5 lg:flex"
  >
    {RAIL_ITEMS.map(({ key, label, icon: Icon }) => {
      const isActive = activeAction === key;
      return (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={isActive}
          onClick={() => onSelect(key)}
          className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
            isActive
              ? 'bg-primary-100 text-text-brand'
              : 'text-text-tertiary hover:bg-neutral-0 hover:text-text-primary'
          }`}
        >
          <Icon size={17} aria-hidden="true" />
        </button>
      );
    })}
  </nav>
);

export default WorkspaceActionRail;
