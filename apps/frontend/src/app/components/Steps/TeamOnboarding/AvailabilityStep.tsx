import React from "react";
import { Primary } from "../../Buttons";
import Availability from "../../Availability/Availability";
import {
  AvailabilityState,
  convertAvailability,
  hasAtLeastOneAvailability,
  SetAvailability,
} from "../../Availability/utils";
import { upsertAvailability } from "@/app/services/availability";

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
  const handleClick = async () => {
    try {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log("No availability selected");
        return;
      }
      await upsertAvailability(converted, orgIdFromQuery);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="team-container">
      <div className="team-title">Availability</div>

      <Availability
        availability={availability}
        setAvailability={setAvailability}
      />

      <div className="team-buttons w-full justify-end!">
        <Primary
          href="#"
          text="Next"
          style={{ width: "160px" }}
          onClick={handleClick}
        />
      </div>
    </div>
  );
};

export default AvailabilityStep;
