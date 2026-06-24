'use client';
import React, { useState } from 'react';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import VitalsForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/VitalsForm';
import ObservationToolForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/ObservationToolForm';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

type RecordPanelProps = {
  appointmentId: string;
  organisationId: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  companionId?: string;
};

type RecordTab = 'VITALS' | 'OBSERVATION';

const TABS = [
  { key: 'VITALS', label: 'Vitals' },
  { key: 'OBSERVATION', label: 'Observation Tool' },
];

/** Record panel: Vitals + Observation Tool tabs, each with a form + recorded list. */
const RecordPanel = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  authorName,
  companionId,
}: RecordPanelProps) => {
  const [tab, setTab] = useState<RecordTab>('VITALS');
  const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[appointmentId]);

  if (!encounter) return null;

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as RecordTab)}
        panelId={(key) => `record-panel-${key}`}
      />
      {tab === 'VITALS' ? (
        <div id="record-panel-VITALS" role="tabpanel" aria-labelledby="tab-VITALS">
          <VitalsForm
            appointmentId={appointmentId}
            organisationId={organisationId}
            encounterId={encounterId}
            authorId={authorId}
            vitals={encounter.vitals}
          />
        </div>
      ) : (
        <div id="record-panel-OBSERVATION" role="tabpanel" aria-labelledby="tab-OBSERVATION">
          <ObservationToolForm
            appointmentId={appointmentId}
            organisationId={organisationId}
            encounterId={encounterId}
            companionId={companionId}
            filledBy={authorId}
            filledByName={authorName}
            observations={encounter.observations}
          />
        </div>
      )}
    </div>
  );
};

export default RecordPanel;
