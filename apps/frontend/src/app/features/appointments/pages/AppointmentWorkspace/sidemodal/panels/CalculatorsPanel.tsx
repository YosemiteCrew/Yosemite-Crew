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

const CalculatorsPanel = ({ appointment }: CalculatorsPanelProps) => {
  const companion = getAppointmentCompanion(appointment);
  const companionRecord = useCompanionStore((s) => s.companionsById[companion.id]);

  const companionType: CompanionType | undefined = companionRecord?.type;
  const speciesSupported = companionType === 'dog' || companionType === 'cat';
  const species: CalculatorSpecies = companionType === 'cat' ? 'cat' : 'dog';

  // currentWeight is recorded in pounds in the workspace; convert for the calculators.
  const weightLbs = companionRecord?.currentWeight;
  const weightKg = weightLbs == null ? undefined : lbsToKg(weightLbs);
  const initialValues = weightKg == null ? undefined : { weightKg: String(weightKg) };

  return (
    <div className="flex flex-col gap-3">
      {weightKg != null && (
        <Text variant="caption-1" className="text-text-secondary">
          Pre-filled from {companion.name}: {weightLbs} lbs ({weightKg} kg)
          {speciesSupported ? `, ${species}` : ''}. Edit any value as needed.
        </Text>
      )}
      {companionType != null && !speciesSupported && (
        <Text variant="caption-1" className="text-warning-700">
          Calculators support dog and cat only; {companion.name} is recorded as {companionType}.
          Confirm the species before using a result.
        </Text>
      )}
      <CalculatorBrowser initialValues={initialValues} initialSpecies={species} />
    </div>
  );
};

export default CalculatorsPanel;
