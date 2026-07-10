import { useImperativeHandle, useState, type Dispatch, type SetStateAction, type Ref } from 'react';
import { IoArrowForward } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import {
  AvailabilityState,
  convertAvailability,
  hasAtLeastOneAvailability,
  SetAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import { upsertAvailability } from '@/app/features/organization/services/availabilityService';
import type { StepHandle } from './PersonalStep';

type AvailabilityStepProps = Readonly<{
  prevStep: () => void;
  orgIdFromQuery: string | null;
  availability: AvailabilityState;
  setAvailability: SetAvailability;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setIsRedirecting: Dispatch<SetStateAction<boolean>>;
  ref?: Ref<StepHandle>;
}>;

function AvailabilityStep({
  prevStep,
  orgIdFromQuery,
  availability,
  setAvailability,
  isSaving,
  setIsSaving,
  setIsRedirecting,
  ref,
}: AvailabilityStepProps) {
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        setAvailabilityError('Please enable at least one day with a valid time slot');
        return false;
      }
      setAvailabilityError(null);
      return true;
    },
  }));

  const handleSaveAvailability = async () => {
    if (isSaving) return;

    const converted = convertAvailability(availability);
    if (!hasAtLeastOneAvailability(converted)) {
      setAvailabilityError('Please enable at least one day with a valid time slot');
      return;
    }
    setAvailabilityError(null);

    try {
      setIsSaving(true);
      await upsertAvailability(converted, orgIdFromQuery);
      setIsRedirecting(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 rounded-[22px] border border-[var(--hairline)] bg-[var(--screen)] px-[30px] py-[28px] shadow-[0_2px_6px_var(--sh05),0_20px_55px_var(--sh10)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[17px] font-bold leading-tight tracking-[-0.34px] text-[var(--ink)]">
            Weekly availability
          </span>
        </div>

        <Availability availability={availability} setAvailability={setAvailability} />

        {availabilityError && (
          <div className="text-caption-2 text-text-error">{availabilityError}</div>
        )}

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-[18px]">
          <Secondary href="#" text="Back" onClick={prevStep} />
          <Primary
            href="#"
            text={isSaving ? 'Saving...' : 'Finish · open dashboard'}
            icon={<IoArrowForward aria-hidden="true" />}
            iconPosition="right"
            onClick={handleSaveAvailability}
            isDisabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

export default AvailabilityStep;
