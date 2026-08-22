'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import type { IconType } from 'react-icons';
import {
  IoCalculatorOutline,
  IoChatboxOutline,
  IoClipboardOutline,
  IoDocumentTextOutline,
  IoPulseOutline,
} from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import type { Appointment } from '@yosemite-crew/types';
import type { SideAction } from '@/app/features/appointments/types/workspace';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getAppointmentCompanion } from '@/app/lib/appointments';

// Panels are heavy (vitals forms, document packets, the calculator registry) and
// only one is ever mounted, so each ships as its own chunk and is fetched when
// its tab is first opened rather than with the workspace route.
const PanelSkeleton = () => (
  <div className="h-full min-h-50 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

import type { RecordTab } from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/RecordPanel';

const RecordPanel = dynamic(
  () =>
    import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/RecordPanel'),
  { loading: () => <PanelSkeleton /> }
);
const TasksPanel = dynamic(
  () =>
    import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/TasksPanel'),
  { loading: () => <PanelSkeleton /> }
);
const DocumentsPanel = dynamic(
  () =>
    import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel'),
  { loading: () => <PanelSkeleton /> }
);
const ChatPanel = dynamic(
  () => import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/ChatPanel'),
  { loading: () => <PanelSkeleton /> }
);
const ActivityPanel = dynamic(
  () =>
    import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/ActivityPanel'),
  { loading: () => <PanelSkeleton /> }
);
const MsdPanel = dynamic(
  () => import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/MsdPanel'),
  { loading: () => <PanelSkeleton /> }
);
const CalculatorsPanel = dynamic(
  () =>
    import('@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/CalculatorsPanel'),
  { loading: () => <PanelSkeleton /> }
);

type QuickActionsModalProps = {
  appointment: Appointment;
  appointmentId: string;
  organisationId: string;
  encounterId?: string;
  authorId?: string;
  activeAction: SideAction | null;
  /** Which Record tab to open on when activeAction is RECORD. */
  recordTab?: RecordTab;
  onChangeAction: (action: SideAction) => void;
  onClose: () => void;
};

type NavItem = {
  key: SideAction;
  label: string;
  icon: IconType;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'RECORD', label: 'Record', icon: IoPulseOutline },
  { key: 'TASKS', label: 'Tasks', icon: IoClipboardOutline },
  { key: 'DOCUMENTS', label: 'Documents', icon: IoDocumentTextOutline },
  { key: 'CHAT', label: 'Chat', icon: IoChatboxOutline },
  { key: 'ACTIVITY', label: 'Activity', icon: IoPulseOutline },
];

/** MSD/Merck nav item — icon is the branded glyph, rendered separately. */
const MSD_LABEL = 'MSD';

/** Calculators nav item — rendered after MSD using the shared NavButton. */
const CALCULATORS_ITEM: NavItem = {
  key: 'CALCULATORS',
  label: 'Calculators',
  icon: IoCalculatorOutline,
};

const NavButton = ({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`flex size-11 items-center justify-center rounded-full border transition-colors duration-150 ${
          active ? 'border-text-brand text-blue-text' : 'border-neutral-300 text-neutral-700'
        }`}
      >
        <Icon size={20} />
      </span>
      <span
        className={`text-caption-2 ${active ? 'font-bold text-blue-text' : 'text-neutral-700'}`}
      >
        {item.label}
      </span>
    </button>
  );
};

/**
 * Quick-actions side modal — reuses the shared right-docked `Modal` drawer (same
 * size/styling as the Organization/Tasks side modals) with a top row of round
 * icon tabs (Record / Tasks / Documents / Chat / Activity / MSD). The active tab
 * routes to its panel below.
 */
const QuickActionsModal = ({
  appointment,
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  activeAction,
  recordTab,
  onChangeAction,
  onClose,
}: QuickActionsModalProps) => {
  const open = activeAction != null;
  const companion = getAppointmentCompanion(appointment);

  return (
    <Modal
      showModal={open}
      setShowModal={(next) => {
        if (!next) onClose();
      }}
      onClose={onClose}
      size="lg"
    >
      <div className="flex h-full flex-col gap-4">
        <ModalHeader title="Quick actions" onClose={onClose} />

        <nav
          aria-label="Quick actions"
          className="flex items-start justify-between gap-2 border-b border-card-border px-2 pb-4"
        >
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeAction === item.key}
              onClick={() => onChangeAction(item.key)}
            />
          ))}
          <button
            type="button"
            aria-pressed={activeAction === 'MSD'}
            onClick={() => onChangeAction('MSD')}
            className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className={`flex size-11 items-center justify-center rounded-full border transition-colors duration-150 ${
                activeAction === 'MSD'
                  ? 'border-text-brand bg-primary-100'
                  : 'border-neutral-300 bg-neutral-0'
              }`}
            >
              <Image
                src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
                alt=""
                width={30}
                height={30}
                className="size-7 object-contain"
              />
            </span>
            <span
              className={`text-caption-2 ${
                activeAction === 'MSD' ? 'font-bold text-blue-text' : 'text-neutral-700'
              }`}
            >
              {MSD_LABEL}
            </span>
          </button>
          <NavButton
            item={CALCULATORS_ITEM}
            active={activeAction === 'CALCULATORS'}
            onClick={() => onChangeAction('CALCULATORS')}
          />
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden pr-1">
          {activeAction === 'RECORD' && (
            <RecordPanel
              appointmentId={appointmentId}
              organisationId={organisationId}
              encounterId={encounterId}
              authorId={authorId}
              authorName={appointment.lead?.name}
              companionId={companion.id}
              initialTab={recordTab}
            />
          )}
          {activeAction === 'TASKS' && (
            <TasksPanel
              appointmentId={appointmentId}
              companionId={companion.id}
              parentOptions={
                companion.parent?.id
                  ? [{ label: companion.parent.name || 'Pet parent', value: companion.parent.id }]
                  : []
              }
            />
          )}
          {activeAction === 'DOCUMENTS' && (
            <DocumentsPanel
              appointmentId={appointmentId}
              companionId={companion.id}
              organisationId={organisationId}
              encounterId={encounterId}
              appointmentStatus={appointment.status}
            />
          )}
          {activeAction === 'CHAT' && <ChatPanel appointment={appointment} />}
          {activeAction === 'ACTIVITY' && <ActivityPanel appointment={appointment} />}
          {activeAction === 'MSD' && <MsdPanel appointment={appointment} />}
          {activeAction === 'CALCULATORS' && <CalculatorsPanel appointment={appointment} />}
        </div>
      </div>
    </Modal>
  );
};

export default QuickActionsModal;
