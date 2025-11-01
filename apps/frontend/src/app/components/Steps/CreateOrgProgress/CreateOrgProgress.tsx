import React from "react";
import { HiShoppingBag } from "react-icons/hi2";
import { IoLocationSharp } from "react-icons/io5";
import { FaSuitcaseMedical } from "react-icons/fa6";
import classNames from "classnames";

import "./CreateOrgProgress.css";

const steps = [
  {
    title: "Organisation",
    logo: <HiShoppingBag color="#fff" size={20} />,
  },
  {
    title: "Address",
    logo: <IoLocationSharp color="#fff" size={20} />,
  },
  {
    title: "Specialties",
    logo: <FaSuitcaseMedical color="#fff" size={18} />,
  },
];

const CreateOrgSteps = ({ activeStep }: any) => {
  return (
    <div className="steps-container">
      {steps.map((step, index) => (
        <div className="step" key={step.title}>
          <div className="step-info">
            <div
              className={classNames("step-logo", {
                activestepbackground: activeStep === index,
              })}
            >
              {step.logo}
            </div>
            <div
              className={classNames("step-heading", {
                activestep: activeStep === index,
              })}
            >
              {step.title}
            </div>
          </div>
          {steps.length - 1 !== index && (
            <div
              className={classNames("step-dash", {
                activestepbackground: activeStep === index,
              })}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default CreateOrgSteps;
