'use client';

import type { Appointment, CompanionType } from '@yosemite-crew/types';
import { Text } from '@/app/ui';
import { useCompanionStore } from '@/app/stores/companionStore';
import { getAppointmentCompanion } from '@/app/lib/appointments';
import { lbsToKg } from '@/app/features/calculators/utils/units';
import type { CalculatorSpecies } from '@/app/features/calculators/utils/shared';
import CalculatorBrowser from '@/app/features/calculators/components/CalculatorBrowser';

type CalculatorsPanelProps = {
  appointment: Appointment;
};

// The app uses the clinical species terms (canine/feline/equine), not dog/cat/horse.
const SPECIES_LABEL: Record<CompanionType, string> = {
  dog: 'canine',
  cat: 'feline',
  horse: 'equine',
  other: 'other',
};

const CalculatorsPanel = ({ appointment }: CalculatorsPanelProps) => {
  const companion = getAppointmentCompanion(appointment);
  const companionRecord = useCompanionStore((s) => s.companionsById[companion.id]);

  const companionType: CompanionType | undefined = companionRecord?.type;
  const speciesSupported = companionType === 'dog' || companionType === 'cat';
  const species: CalculatorSpecies = companionType === 'cat' ? 'cat' : 'dog';
  const speciesLabel = companionType ? SPECIES_LABEL[companionType] : '';

  // currentWeight is recorded in pounds in the workspace; convert for the calculators.
  const weightLbs = companionRecord?.currentWeight;
  const weightKg = weightLbs == null ? undefined : lbsToKg(weightLbs);
  const initialValues = weightKg == null ? undefined : { weightKg: String(weightKg) };

  const speciesSuffix = speciesSupported ? `, ${speciesLabel}` : '';
  const prefillNote =
    weightKg == null
      ? null
      : `Pre-filled from ${companion.name}: ${weightLbs} lbs (${weightKg} kg)${speciesSuffix}. Edit any value as needed.`;

  const unsupportedNote =
    companionType != null && !speciesSupported
      ? `Calculators support canine and feline only; ${companion.name} is recorded as ${speciesLabel}. Confirm the species before using a result.`
      : null;

  return (
    <div className="flex flex-col gap-5">
      {prefillNote && (
        <div className="rounded-2xl bg-card-bg px-4 py-3">
          <Text variant="caption-1" className="text-text-secondary">
            {prefillNote}
          </Text>
        </div>
      )}
      {unsupportedNote && (
        <div className="rounded-2xl bg-warning-100 px-4 py-3">
          <Text variant="caption-1" className="text-warning-700">
            {unsupportedNote}
          </Text>
        </div>
      )}
      <CalculatorBrowser initialValues={initialValues} initialSpecies={species} />
    </div>
  );
};

export default CalculatorsPanel;
