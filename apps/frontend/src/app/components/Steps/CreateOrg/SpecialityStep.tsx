import React, { useMemo } from "react";
import { Primary, Secondary } from "../../Buttons";
import SpecialitySearch from "../../Inputs/SpecialitySearch/SpecialitySearch";
import SpecialityCard from "../../Cards/SpecialityCard/SpecialityCard";
import { useRouter } from "next/navigation";

import "./Step.css";

const SpecialityStep = ({ prevStep, specialities, setSpecialities }: any) => {
  const router = useRouter();

  const activeSpecialities = useMemo(() => {
    return specialities.filter((s: any) => s.active);
  }, [specialities]);

  const hasActiveSpecialityAndService = () => {
    if (!Array.isArray(specialities)) return false;
    return specialities.some(
      (speciality) =>
        speciality.active &&
        Array.isArray(speciality.services) &&
        speciality.services.some((service: any) => service.active)
    );
  };

  const handleSubmit = () => {
    if (hasActiveSpecialityAndService()) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="step-container">
      <div className="step-title-container">
        <div className="step-title">Specialties</div>
        <SpecialitySearch
          specialities={specialities}
          setSpecialities={setSpecialities}
        />
      </div>

      {activeSpecialities.length === 0 && (
        <div className="specilities-container-empty">
          Search and add specialities from the search bar above
        </div>
      )}

      <div className="specialities-container">
        {activeSpecialities.map((speciality: any) => (
          <SpecialityCard
            key={speciality.key}
            speciality={speciality}
            setSpecialities={setSpecialities}
          />
        ))}
      </div>

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
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
};

export default SpecialityStep;
