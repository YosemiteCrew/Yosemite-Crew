import React from "react";
import { Primary, Secondary } from "../../Buttons";
import Availability from "../../Availability/Availability";

type AvailabilityStepProps = {
  prevStep: () => void;
};

const AvailabilityStep = ({ prevStep }: AvailabilityStepProps) => {
  return (
    <div className="team-container">
      <div className="team-title">Availability</div>

      <Availability />

      <div className="team-buttons">
        <Secondary
          href="#"
          text="Back"
          style={{ width: "160px" }}
          onClick={() => prevStep()}
        />
        <Primary href="/dashboard" text="Next" style={{ width: "160px" }} />
      </div>
    </div>
  );
};

export default AvailabilityStep;
