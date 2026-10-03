'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  buildDateInPreferredTimeZone,
  buildPreferredTimeZoneDayInstant,
  getDatePartsInPreferredTimeZone,
} from '@/app/lib/timezone';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';
import { MEASUREMENT_FIELDS, type MeasurementName } from './inpatientObservationFields';

export type ReadyObservationContext = {
  organisationId: string;
  patientId: string;
  encounterId: string;
};

const sortedNewestFirst = (records: HospitalizationObservation[]) =>
  [...records].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

export const useHospitalizationObservationFeed = (context: ReadyObservationContext) => {
  const [records, setRecords] = useState<HospitalizationObservation[]>([]);
  const [loadedRefresh, setLoadedRefresh] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const isLoading = loadedRefresh !== refresh;

  useEffect(() => {
    let active = true;
    listHospitalizationObservations(context.organisationId, context.patientId, context.encounterId)
      .then((items) => {
        if (active) {
          setRecords(sortedNewestFirst(items));
          setLoadError(null);
        }
      })
      .catch(() => {
        if (active) setLoadError('Unable to load observations. Please try again.');
      })
      .finally(() => {
        if (active) setLoadedRefresh(refresh);
      });
    return () => {
      active = false;
    };
  }, [context.encounterId, context.organisationId, context.patientId, refresh]);

  const retry = () => {
    setLoadError(null);
    setRefresh((value) => value + 1);
  };
  const addObservation = (entry: HospitalizationObservation) =>
    setRecords((current) => sortedNewestFirst([entry, ...current]));

  return { records, isLoading, loadError, retry, addObservation };
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const toClinicDateTimeInput = (date: Date) => {
  const { year, month, day, hour, minute } = getDatePartsInPreferredTimeZone(date);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
};

const fromClinicDateTimeInput = (value: FormDataEntryValue | null): Date | null => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return buildDateInPreferredTimeZone(
    buildPreferredTimeZoneDayInstant(year, month, day),
    hour * 60 + minute
  );
};

const readMeasurements = (form: FormData) => {
  const values: Partial<Record<MeasurementName, number>> = {};
  for (const { name } of MEASUREMENT_FIELDS) {
    const value = form.get(name);
    if (typeof value === 'string' && value.trim()) values[name] = Number(value);
  }
  return values;
};

export const useInpatientObservationEntry = ({
  organisationId,
  patientId,
  encounterId,
  onSaved,
}: ReadyObservationContext & { onSaved: (entry: HospitalizationObservation) => void }) => {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formObservedAt, setFormObservedAt] = useState<string | null>(null);

  const saveObservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const observedAt = fromClinicDateTimeInput(form.get('observedAt'));
    if (!observedAt) return;
    if (observedAt.getTime() > Date.now() + 60_000) {
      setFormError('The observation time cannot be in the future.');
      return;
    }
    const measurements = readMeasurements(form);
    const notesEntry = form.get('notes');
    const notes = typeof notesEntry === 'string' ? notesEntry.trim() : '';
    if (Object.keys(measurements).length === 0 && !notes) {
      setFormError('Enter at least one measurement or a note.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const entry = await recordHospitalizationObservation({
        organisationId,
        patientId,
        encounterId,
        observedAt: observedAt.toISOString(),
        ...measurements,
        ...(measurements.temperature === undefined ? {} : { temperatureUnit: 'C' as const }),
        ...(notes ? { notes } : {}),
      });
      onSaved(entry);
      setFormObservedAt(null);
    } catch {
      setFormError('Unable to save this observation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const openForm = () => setFormObservedAt(toClinicDateTimeInput(new Date()));
  const closeForm = () => {
    setFormError(null);
    setFormObservedAt(null);
  };

  return { formError, isSaving, formObservedAt, openForm, closeForm, saveObservation };
};
