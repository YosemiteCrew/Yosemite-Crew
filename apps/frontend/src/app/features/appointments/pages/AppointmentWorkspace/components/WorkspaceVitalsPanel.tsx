import React from 'react';
import { LuActivity, LuChevronRight } from 'react-icons/lu';
import type { ObservationRecord, Vitals } from '@/app/features/appointments/types/workspace';
import { formatStampTime } from '@/app/lib/appointmentWorkspace';

type WorkspaceVitalsPanelProps = {
  vitals: Vitals[];
  observations: ObservationRecord[];
  onRecordVitals: () => void;
  onOpenObservations: () => void;
  canRecord?: boolean;
};

const dash = (value: React.ReactNode) =>
  value === undefined || value === null || value === '' ? '—' : value;

const latestOf = <T extends { recordedAt: string }>(items: T[]): T | undefined =>
  items.length === 0
    ? undefined
    : [...items].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];

const VitalCell = ({
  label,
  value,
  withLeftBorder,
  withBottomBorder,
}: {
  label: string;
  value: React.ReactNode;
  withLeftBorder?: boolean;
  withBottomBorder?: boolean;
}) => (
  <div
    className={`px-4 py-2.5 ${withBottomBorder ? 'border-b border-card-border' : ''} ${
      withLeftBorder ? 'border-l border-card-border' : ''
    }`}
  >
    <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
      {label}
    </span>
    <span className="text-body-3-emphasis tabular-nums text-text-primary">{value}</span>
  </div>
);

/**
 * Persistent clinical right-rail for the SOAP step: a live summary of the most
 * recently recorded vitals and observation tools, matching the design's two-card
 * rail. Recording still happens through the shared Quick Actions flow — this panel
 * surfaces the results so they are always visible beside the note (previously they
 * were only reachable inside the side modal).
 */
const WorkspaceVitalsPanel = ({
  vitals,
  observations,
  onRecordVitals,
  onOpenObservations,
  canRecord = true,
}: WorkspaceVitalsPanelProps) => {
  const latest = latestOf(vitals);
  const painBcs =
    latest?.painScore === undefined && latest?.bcs === undefined
      ? '—'
      : `${dash(latest?.painScore)}/10 · ${dash(latest?.bcs)}/9`;
  const crtMm =
    !latest?.crtSec && !latest?.mucousMembrane
      ? '—'
      : `${dash(latest?.crtSec)} · ${dash(latest?.mucousMembrane)}`;

  return (
    <div className="flex w-full flex-col gap-3 lg:max-w-[360px]">
      <section
        aria-label="Vitals"
        className="overflow-hidden rounded-[14px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
      >
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3">
          <span className="text-body-3-emphasis text-text-primary">Vitals</span>
          {canRecord && (
            <button
              type="button"
              onClick={onRecordVitals}
              className="text-caption-1 font-semibold text-text-brand hover:underline"
            >
              + Record
            </button>
          )}
        </div>
        {latest ? (
          <>
            <div className="grid grid-cols-2 border-t border-card-border">
              <VitalCell
                label="Weight"
                value={latest.weightLbs === undefined ? '—' : `${latest.weightLbs} lbs`}
                withBottomBorder
              />
              <VitalCell
                label="Temp"
                value={latest.tempF === undefined ? '—' : `${latest.tempF} °F`}
                withLeftBorder
                withBottomBorder
              />
              <VitalCell
                label="Heart rate"
                value={latest.heartRateBpm === undefined ? '—' : `${latest.heartRateBpm} bpm`}
                withBottomBorder
              />
              <VitalCell
                label="Resp rate"
                value={latest.respRateBpm === undefined ? '—' : `${latest.respRateBpm} /min`}
                withLeftBorder
                withBottomBorder
              />
              <VitalCell label="CRT · MM" value={crtMm} />
              <VitalCell label="Pain · BCS" value={painBcs} withLeftBorder />
            </div>
            <div className="border-t border-card-border px-4 py-2.5 text-caption-2 text-text-tertiary">
              Recorded by {latest.recordedByName || 'Clinician'}
              {latest.recordedAt ? ` · ${formatStampTime(latest.recordedAt)}` : ''}
            </div>
          </>
        ) : (
          <div className="border-t border-card-border px-4 py-4 text-body-4 text-text-secondary">
            No vitals recorded yet.
          </div>
        )}
      </section>

      <section
        aria-label="Observation tools"
        className="overflow-hidden rounded-[14px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
      >
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3">
          <span className="text-body-3-emphasis text-text-primary">Observation tools</span>
          {canRecord && (
            <button
              type="button"
              onClick={onOpenObservations}
              className="text-caption-1 font-semibold text-text-brand hover:underline"
            >
              + New
            </button>
          )}
        </div>
        {observations.length > 0 ? (
          <ul className="border-t border-card-border">
            {observations.map((obs) => (
              <li
                key={obs.id}
                className="flex items-center gap-3 border-b border-card-border px-4 py-3 last:border-b-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-primary-100 text-text-brand">
                  <LuActivity size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-4 font-bold text-text-primary">
                    {obs.toolName}
                  </span>
                  <span className="block truncate text-caption-2 text-text-tertiary">
                    {obs.total !== undefined ? `Score ${obs.total}` : 'Recorded'} ·{' '}
                    {obs.recordedByName || 'Clinician'}
                    {obs.recordedAt ? ` · ${formatStampTime(obs.recordedAt)}` : ''}
                  </span>
                </span>
                <LuChevronRight
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-text-tertiary"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-t border-card-border px-4 py-4 text-body-4 text-text-secondary">
            No observation scores yet.
          </div>
        )}
      </section>
    </div>
  );
};

export default WorkspaceVitalsPanel;
