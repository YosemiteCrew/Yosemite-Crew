import React from "react";
import { Primary, Secondary } from "../../Buttons";

import "./Step.css";

const SpecialityStep = ({ prevStep }: any) => {
  return (
    <div className="step-container">
      <div className="step-title">Specialties</div>

      <div className="step-buttons">
        <Secondary
          href="#"
          text="Back"
          style={{ width: "160px" }}
          onClick={() => prevStep()}
        />
        <Primary
          href="#"
          text="Next"
          style={{ width: "160px" }}
        />
      </div>
    </div>
  );
};

export default SpecialityStep;
