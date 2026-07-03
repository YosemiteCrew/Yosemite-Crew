'use client';
import React, { useState } from 'react';
import { LuArrowRight, LuEye, LuEyeOff } from 'react-icons/lu';
import { Primary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { OBSERVATION_TOOLS } from '@/app/features/appointments/services/workspaceInitialData';
import type { ObservationRecord } from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import { createPmsObservationSubmission } from '@/app/features/appointments/services/workspaceClinicalService';

type ObservationToolFormProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  companionId?: string;
  filledBy?: string;
  filledByName?: string;
  observations: ObservationRecord[];
};

const ObservationRow = ({ entry }: { entry: ObservationRecord }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col leading-[120%]">
          <span className="text-[12px] font-medium text-pill-success-text">
            {formatStampDate(entry.recordedAt)}
          </span>
          <span className="text-body-4 font-medium text-text-primary">{entry.toolName}</span>
          <span className="text-[12px] text-text-secondary">{entry.code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-neutral-100 px-3 py-1 text-body-4 text-text-primary">
            {entry.recordedByName}
          </span>
          <CircleIconButton
            icon={
              open ? (
                <LuEyeOff size={16} aria-hidden="true" />
              ) : (
                <LuEye size={16} aria-hidden="true" />
              )
            }
            label={open ? `Hide ${entry.code}` : `View ${entry.code}`}
            variant="dark"
            onClick={() => setOpen((v) => !v)}
          />
        </div>
      </div>
      {open && (
        <div className="rounded-2xl border border-card-border p-3 text-body-4 text-text-primary">
          {entry.total != null && <p className="font-medium">Total score: {entry.total}</p>}
          {Object.entries(entry.scores).map(([key, value]) => (
            <p key={key} className="flex justify-between gap-3">
              <span className="text-text-secondary">{key}</span>
              <span>{value}</span>
            </p>
          ))}
        </div>
      )}
    </li>
  );
};

/**
 * Observation Tool tab: choose a scoring tool (FGS / CSU-CAP), read its intro,
 * Start to score and review recorded observations.
 */
const ObservationToolForm = ({
  appointmentId,
  organisationId,
  encounterId,
  companionId,
  filledBy,
  filledByName,
  observations,
}: ObservationToolFormProps) => {
  const addObservationRecord = useAppointmentWorkspaceStore((s) => s.addObservationRecord);
  const [activeToolKey, setActiveToolKey] = useState(OBSERVATION_TOOLS[0]?.key ?? 'FGS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTool =
    OBSERVATION_TOOLS.find((tool) => tool.key === activeToolKey) ?? OBSERVATION_TOOLS[0];

  // The scoring submission needs the encounter context + a clinician to attribute
  // it to. Without them we cannot record a real, backend-scored observation, so the
  // action is disabled with a reason instead of writing a fabricated local row.
  const canRecord = Boolean(organisationId && companionId && filledBy);
  const disabledReason = canRecord
    ? undefined
    : 'Recording is available once the encounter and clinician are loaded.';

  const handleStart = async () => {
    if (!activeTool || isSubmitting) return;
    if (!organisationId || !companionId || !filledBy) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // The backend computes the score from the tool definition; we submit the
      // selected tool + context and render the authoritative result it returns.
      const record = await createPmsObservationSubmission({
        organisationId,
        appointmentId,
        encounterId,
        companionId,
        toolId: activeTool.key,
        filledBy,
        answers: {},
      });
      // Prefer the clinician's display name we already hold for the recorded row;
      // the backend resolves it too, but this keeps the UI correct immediately.
      addObservationRecord(appointmentId, {
        ...record,
        recordedByName: filledByName ?? record.recordedByName,
      });
    } catch (submitError) {
      console.error('Failed to record observation submission:', submitError);
      setError('Unable to record the observation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {OBSERVATION_TOOLS.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {OBSERVATION_TOOLS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-pressed={tool.key === activeToolKey}
              onClick={() => setActiveToolKey(tool.key)}
              className={`rounded-2xl border px-3 py-1.5 text-body-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
                tool.key === activeToolKey
                  ? 'border-text-brand bg-primary-100 text-text-brand'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {tool.name}
            </button>
          ))}
        </div>
      )}

      {activeTool && (
        <div className="flex flex-col gap-3">
          <h3 className="text-body-2 font-bold text-text-primary">{activeTool.name}</h3>
          <p className="text-body-4 leading-[150%] text-text-secondary">{activeTool.intro}</p>
          <div className="flex flex-col items-center gap-2">
            <Primary
              text={isSubmitting ? 'Recording…' : 'Start'}
              icon={<LuArrowRight aria-hidden="true" />}
              iconPosition="right"
              onClick={() => void handleStart()}
              isDisabled={!canRecord || isSubmitting}
            />
            {disabledReason && (
              <p className="text-center text-[12px] text-text-secondary">{disabledReason}</p>
            )}
            {error && (
              <p role="alert" className="text-center text-[12px] text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <ul className="rounded-2xl border border-card-border px-4">
          {observations.map((entry) => (
            <ObservationRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ObservationToolForm;
