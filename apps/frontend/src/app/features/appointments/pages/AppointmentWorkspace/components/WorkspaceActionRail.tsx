import React, { useMemo } from 'react';
import type { IconType } from 'react-icons';
import {
  IoBookOutline,
  IoCalculatorOutline,
  IoChatboxOutline,
  IoClipboardOutline,
  IoFolderOpenOutline,
  IoPulseOutline,
  IoReaderOutline,
} from 'react-icons/io5';
import type { SideAction } from '@/app/features/appointments/types/workspace';
import { useExtensionPoint } from '@/app/features/plugins';
import type { AppointmentWorkspaceActionRailItemExtension } from '@/app/features/plugins/types';

type WorkspaceActionRailProps = {
  activeAction: SideAction | null;
  onSelect: (action: SideAction) => void;
  appointmentId: string;
  organisationId: string;
};

type RailItem = { key: string; label: string; icon: IconType };

const RAIL_ITEMS: RailItem[] = [
  { key: 'RECORD', label: 'Record vitals', icon: IoPulseOutline },
  { key: 'TASKS', label: 'Tasks', icon: IoClipboardOutline },
  { key: 'DOCUMENTS', label: 'Documents', icon: IoFolderOpenOutline },
  { key: 'CHAT', label: 'Chat', icon: IoChatboxOutline },
  { key: 'ACTIVITY', label: 'Activity', icon: IoReaderOutline },
  { key: 'MSD', label: 'MSD Manual', icon: IoBookOutline },
  { key: 'CALCULATORS', label: 'Calculators', icon: IoCalculatorOutline },
];

/**
 * Persistent quick-actions rail docked to the right of the workspace step content
 * (design: the 58px icon strip beside the SOAP note). Each icon opens the matching
 * Quick Actions panel — the same targets previously reachable only via the header's
 * "Quick Actions" button, now always visible across every step.
 */
const WorkspaceActionRail = ({
  activeAction,
  onSelect,
  appointmentId,
  organisationId,
}: WorkspaceActionRailProps) => {
  const context = useMemo(
    () => ({ type: 'appointment', appointmentId, organisationId }),
    [appointmentId, organisationId]
  );

  const { extensions: pluginExtensions } =
    useExtensionPoint<AppointmentWorkspaceActionRailItemExtension>(
      'appointment.workspace.actionRail.items',
      context
    );

  const pluginRailItems = useMemo<RailItem[]>(
    () =>
      pluginExtensions.map((ext) => ({
        key: ext.id,
        label: ext.extension.component.displayName || ext.id,
        icon: ext.extension.component.icon || IoPulseOutline,
      })),
    [pluginExtensions]
  );

  const allItems = [...RAIL_ITEMS, ...pluginRailItems];

  return (
    <nav
      aria-label="Workspace quick actions"
      className="hidden w-[58px] shrink-0 flex-col items-center gap-1.5 self-stretch rounded-2xl border border-card-border bg-neutral-100 py-3.5 lg:flex"
    >
      {allItems.map(({ key, label, icon: Icon }) => {
        const isActive = activeAction === key;
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onSelect(key as SideAction)}
            className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-neutral-0"
            style={
              isActive
                ? { background: 'var(--blue-soft)', color: 'var(--blue-text)' }
                : { color: 'var(--ink-faint)' }
            }
          >
            <Icon size={17} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
};

export default WorkspaceActionRail;
