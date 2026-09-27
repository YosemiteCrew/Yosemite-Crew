'use client';
import React, { useState } from 'react';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import VitalsForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/VitalsForm';
import ObservationToolForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/ObservationToolForm';
import DentalExaminationForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/DentalExaminationForm';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

type RecordPanelProps = {
  appointmentId: string;
  organisationId: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  companionId?: string;
  species?: string;
  /** Which tab to open on. Defaults to Vitals. */
  initialTab?: RecordTab;
};

export type RecordTab = 'VITALS' | 'OBSERVATION' | 'DENTAL';

const TABS = [
  { key: 'VITALS', label: 'Vitals' },
  { key: 'OBSERVATION', label: 'Observation Tool' },
  { key: 'DENTAL', label: 'Dental' },
];

/** Record panel: Vitals, Observation Tool, and Dental tabs. */
const RecordPanel = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  authorName,
  companionId,
  species,
  initialTab = 'VITALS',
}: RecordPanelProps) => {
  const [tab, setTab] = useState<RecordTab>(initialTab);
  const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[appointmentId]);

  if (!encounter) return null;

  const renderPanel = () => {
    if (tab === 'VITALS') {
      return (
        <div id="record-panel-VITALS" role="tabpanel" aria-labelledby="tab-VITALS">
          <VitalsForm
            appointmentId={appointmentId}
            organisationId={organisationId}
            encounterId={encounterId}
            authorId={authorId}
            authorName={authorName}
            vitals={encounter.vitals}
          />
        </div>
      );
    }
    if (tab === 'OBSERVATION') {
      return (
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
      );
    }
    return (
      <div id="record-panel-DENTAL" role="tabpanel" aria-labelledby="tab-DENTAL">
        <DentalExaminationForm
          organisationId={organisationId}
          patientId={companionId}
          encounterId={encounterId}
          species={species}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as RecordTab)}
        panelId={(key) => `record-panel-${key}`}
      />
      {renderPanel()}
    </div>
  );
};

export default RecordPanel;
