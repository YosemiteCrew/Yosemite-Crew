'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Text, Textarea } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';

type InpatientMonitoringPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  readOnly: boolean;
};

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const sortedNewestFirst = (records: HospitalizationObservation[]) =>
  [...records].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

const display = (value: number | string | null | undefined, unit = '') =>
  value === null || value === undefined || value === '' ? '—' : `${value}${unit}`;

const formatObservedAt = (value: string) =>
  `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`;

const numericValue = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() ? Number(value) : undefined;
};

const InpatientMonitoringPanel = ({
  organisationId,
  patientId,
  encounterId,
  readOnly,
}: InpatientMonitoringPanelProps) => {
  const [records, setRecords] = useState<HospitalizationObservation[]>([]);
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const ready = Boolean(organisationId && patientId && encounterId);
  const requestKey = ready ? `${organisationId}:${patientId}:${encounterId}:${refresh}` : '';
  const isLoading = ready && completedRequestKey !== requestKey;

  useEffect(() => {
    if (!ready || !organisationId || !patientId || !encounterId) {
      return;
    }
    let active = true;
    listHospitalizationObservations(organisationId, patientId, encounterId)
      .then((items) => {
        if (active) {
          setRecords(sortedNewestFirst(items));
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load observations. Please try again.');
      })
      .finally(() => {
        if (active) setCompletedRequestKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [encounterId, organisationId, patientId, ready, requestKey]);

  const saveObservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !patientId || !encounterId) return;
    const form = new FormData(event.currentTarget);
    const observedAt = form.get('observedAt');
    if (typeof observedAt !== 'string' || !observedAt) return;
    const temperature = numericValue(form, 'temperature');
    const heartRate = numericValue(form, 'heartRate');
    const respiratoryRate = numericValue(form, 'respiratoryRate');
    const painScore = numericValue(form, 'painScore');
    const inputMl = numericValue(form, 'inputMl');
    const outputMl = numericValue(form, 'outputMl');

    setIsSaving(true);
    setError(null);
    try {
      const entry = await recordHospitalizationObservation({
        organisationId,
        patientId,
        encounterId,
        observedAt: new Date(observedAt).toISOString(),
        ...(temperature !== undefined ? { temperature, temperatureUnit: 'C' as const } : {}),
        ...(heartRate !== undefined ? { heartRate } : {}),
        ...(respiratoryRate !== undefined ? { respiratoryRate } : {}),
        ...(painScore !== undefined ? { painScore } : {}),
        ...(inputMl !== undefined ? { inputMl } : {}),
        ...(outputMl !== undefined ? { outputMl } : {}),
        ...(String(form.get('notes') ?? '').trim()
          ? { notes: String(form.get('notes')).trim() }
          : {}),
      });
      setRecords((current) => sortedNewestFirst([entry, ...current]));
      setShowForm(false);
    } catch {
      setError('Unable to save this observation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionContainer title="Inpatient monitoring" className="min-w-0">
      <div className="flex flex-col gap-4">
        {!ready && (
          <Text as="p" variant="body-4" className="text-text-secondary">
            Monitoring is available when the patient and inpatient encounter are loaded.
          </Text>
        )}

        {isLoading && ready && (
          <Text as="p" variant="body-4" role="status" className="text-text-secondary">
            Loading observations…
          </Text>
        )}

        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <Text as="p" variant="body-4" role="alert" className="text-text-error">
              {error}
            </Text>
            {!isSaving && !showForm && (
              <Button
                text="Refresh"
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setRefresh((value) => value + 1);
                }}
              />
            )}
          </div>
        )}

        {!isLoading && ready && records.length === 0 && !error && (
          <Text as="p" variant="body-4" className="text-text-secondary">
            No monitoring observations recorded for this stay.
          </Text>
        )}

        {records.length > 0 && (
          <ol className="divide-y divide-card-border">
            {records.map((record) => {
              const net =
                record.inputMl !== null && record.outputMl !== null
                  ? record.inputMl - record.outputMl
                  : null;
              return (
                <li key={record.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
                      <time dateTime={record.observedAt}>
                        {formatObservedAt(record.observedAt)}
                      </time>
                    </Text>
                    <Text as="span" variant="caption-1" className="text-text-tertiary">
                      Recorded observation
                    </Text>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {[
                      [
                        'Temperature',
                        display(
                          record.temperature,
                          record.temperatureUnit ? ` °${record.temperatureUnit}` : ''
                        ),
                      ],
                      ['Heart rate', display(record.heartRate, ' bpm')],
                      ['Respiratory rate', display(record.respiratoryRate, ' /min')],
                      ['Pain score', display(record.painScore, ' /10')],
                      ['Intake', display(record.inputMl, ' mL')],
                      ['Output', display(record.outputMl, ' mL')],
                      ...(net !== null ? [['Net recorded', `${net > 0 ? '+' : ''}${net} mL`]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-card-bg px-3 py-2">
                        <dt className="text-caption-2 text-text-tertiary">{label}</dt>
                        <dd className="mt-0.5 text-body-4 font-semibold tabular-nums text-text-primary">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {record.notes && (
                    <Text
                      as="p"
                      variant="body-4"
                      className="mt-3 whitespace-pre-wrap text-text-secondary"
                    >
                      {record.notes}
                    </Text>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {!readOnly && ready && !showForm && (
          <Button text="Record observation" variant="secondary" onClick={() => setShowForm(true)} />
        )}

        {showForm && ready && (
          <form
            onSubmit={saveObservation}
            className="grid grid-cols-1 gap-3 rounded-xl border border-card-border p-4 sm:grid-cols-2"
          >
            <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
              Observed at
              <input
                required
                name="observedAt"
                type="datetime-local"
                defaultValue={localDateTime(new Date())}
                className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
              />
            </label>
            {[
              { name: 'temperature', label: 'Temperature (°C)', min: -100, max: 100, step: '0.1' },
              { name: 'heartRate', label: 'Heart rate (bpm)', min: 1, step: '1' },
              { name: 'respiratoryRate', label: 'Respiratory rate (/min)', min: 1, step: '1' },
              { name: 'painScore', label: 'Pain score (0–10)', min: 0, max: 10, step: '1' },
              { name: 'inputMl', label: 'Fluid intake (mL)', min: 0, step: 'any' },
              { name: 'outputMl', label: 'Fluid output (mL)', min: 0, step: 'any' },
            ].map(({ name, label, min, max, step }) => (
              <label
                key={name}
                className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary"
              >
                {label}
                <input
                  name={name}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
                />
              </label>
            ))}
            <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
              Notes
              <Textarea
                name="notes"
                maxLength={2000}
                rows={3}
                className="bg-[var(--screen)] text-body-4"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                text={isSaving ? 'Saving…' : 'Save observation'}
                type="submit"
                isDisabled={isSaving}
              />
              <Button
                text="Cancel"
                variant="secondary"
                onClick={() => setShowForm(false)}
                isDisabled={isSaving}
              />
            </div>
          </form>
        )}
      </div>
    </SectionContainer>
  );
};

export default InpatientMonitoringPanel;
