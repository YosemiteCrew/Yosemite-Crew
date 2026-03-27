import React from 'react';
import { flushSync } from 'react-dom';
import { Primary } from '@/app/ui/primitives/Buttons';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import {
  AvailabilityState,
  convertAvailability,
  hasAtLeastOneAvailability,
  SetAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import { upsertAvailability } from '@/app/features/organization/services/availabilityService';

type AvailabilityStepProps = {
  prevStep: () => void;
  orgIdFromQuery: string | null;
  availability: AvailabilityState;
  setAvailability: SetAvailability;
};

const AvailabilityStep = ({
  prevStep,
  orgIdFromQuery,
  availability,
  setAvailability,
}: AvailabilityStepProps) => {
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false);

  const handleClick = async () => {
    if (isSavingAvailability) return;
    try {
      flushSync(() => {
        setIsSavingAvailability(true);
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log('No availability selected');
        return;
      }
      await upsertAvailability(converted, orgIdFromQuery);
    } catch (error) {
      console.log(error);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  return (
    <div className="team-container">
      <div className="team-title">Availability</div>

      <Availability availability={availability} setAvailability={setAvailability} />

      <div className="team-buttons w-full justify-end!">
        <Primary
          href="#"
          text={isSavingAvailability ? 'Saving...' : 'Next'}
          style={{ width: '160px' }}
          onClick={handleClick}
          isDisabled={isSavingAvailability}
        />
      </div>
    </div>
  );
};

export default AvailabilityStep;
