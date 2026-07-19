import { useImperativeHandle, useState, type Dispatch, type SetStateAction, type Ref } from 'react';
import type { IconType } from 'react-icons';
import { IoArrowForward, IoBusinessOutline, IoCarOutline, IoChevronDown } from 'react-icons/io5';
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

const CONSULTATION_SLOT_OPTIONS = ['15 min', '20 min', '30 min', '45 min', '60 min'];

const CONSULTATION_TYPES: ReadonlyArray<{ id: string; label: string; icon: IconType }> = [
  { id: 'in-clinic', label: 'In clinic', icon: IoBusinessOutline },
  { id: 'home-visits', label: 'Home visits', icon: IoCarOutline },
];

/**
 * `POST /fhir/v1/availability/:orgId/base` accepts only `{ availabilities: [{ dayOfWeek, slots }] }`
 * — the controller destructures nothing else and `BaseAvailability` has no column for slot length
 * or visit modality. These controls are therefore rendered disabled at the values the backend
 * actually applies, so a practitioner cannot pick something onboarding would silently discard.
 * Re-enable them (and extend `ApiAvailability`) once the API persists these fields.
 */
const DEFAULT_CONSULTATION_SLOT = '30 min';
const DEFAULT_CONSULTATION_TYPES: ReadonlyArray<string> = ['in-clinic'];
const CONSULTATION_UNSUPPORTED_HINT =
  'Not configurable yet - saved availability always uses these defaults';

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14.5px] font-bold leading-tight" style={{ color: 'var(--ink)' }}>
            Weekly availability
          </span>
          <span
            className="flex items-center gap-2 text-[12.5px] opacity-70"
            style={{ color: 'var(--ink-muted)' }}
            title={CONSULTATION_UNSUPPORTED_HINT}
          >
            {'Consultation slot'}
            <span
              className="flex h-[34px] items-center gap-1.5 rounded-[10px] border-[1.5px] px-3"
              style={{
                background: 'var(--field-bg)',
                borderColor: 'var(--hairline)',
              }}
            >
              <select
                aria-label="Consultation slot"
                defaultValue={DEFAULT_CONSULTATION_SLOT}
                disabled
                className="cursor-not-allowed appearance-none bg-transparent text-[12.5px] font-semibold outline-none"
                style={{ color: 'var(--ink-body)' }}
              >
                {CONSULTATION_SLOT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <IoChevronDown size={12} aria-hidden="true" style={{ color: 'var(--ink-faint)' }} />
            </span>
          </span>
        </div>

        <Availability availability={availability} setAvailability={setAvailability} />

        {availabilityError && (
          <div className="text-caption-2 text-text-error">{availabilityError}</div>
        )}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-[18px]">
          <div className="flex gap-2 opacity-70" title={CONSULTATION_UNSUPPORTED_HINT}>
            {CONSULTATION_TYPES.map(({ id, label, icon: Icon }) => {
              const isOn = DEFAULT_CONSULTATION_TYPES.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isOn}
                  disabled
                  className={`flex cursor-not-allowed items-center gap-[7px] rounded-full px-[15px] py-2 text-[12.5px] ${
                    isOn ? 'border-[1.5px] font-bold' : 'border font-semibold'
                  }`}
                  style={
                    isOn
                      ? {
                          borderColor: 'var(--blue)',
                          background: 'var(--nav-active-bg)',
                          color: 'var(--nav-active)',
                        }
                      : { borderColor: 'var(--hairline)', color: 'var(--ink-muted)' }
                  }
                >
                  <Icon size={13} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5">
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
    </div>
  );
}

export default AvailabilityStep;
