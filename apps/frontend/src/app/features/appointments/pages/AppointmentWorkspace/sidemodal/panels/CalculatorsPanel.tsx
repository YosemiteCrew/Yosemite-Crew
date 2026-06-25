'use client';

import type { Appointment } from '@yosemite-crew/types';
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

  const species: CalculatorSpecies = companionRecord?.type === 'cat' ? 'cat' : 'dog';
  const weightLbs = companionRecord?.currentWeight;
  const weightKg = weightLbs == null ? undefined : lbsToKg(weightLbs);
  const initialValues = weightKg == null ? undefined : { weightKg: String(weightKg) };

  return (
    <div className="flex flex-col gap-3">
      {weightKg != null && (
        <Text variant="caption-1" className="text-text-secondary">
          Pre-filled from {companion.name}: {weightLbs} lbs ({weightKg} kg), {species}. Edit any
          value as needed.
        </Text>
      )}
      <CalculatorBrowser initialValues={initialValues} initialSpecies={species} />
    </div>
  );
};

export default CalculatorsPanel;
