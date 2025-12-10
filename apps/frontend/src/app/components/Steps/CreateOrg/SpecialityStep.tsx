import React from "react";
import { Primary, Secondary } from "../../Buttons";
import SpecialitySearch from "../../Inputs/SpecialitySearch/SpecialitySearch";
import SpecialityCard from "../../Cards/SpecialityCard/SpecialityCard";
import { useRouter } from "next/navigation";
import { Speciality } from "@yosemite-crew/types";
import { createSpeciality } from "@/app/services/specialityService";

import "./Step.css";

type SpecialityStepProps = {
  prevStep: any;
  specialities: Speciality[];
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
};

const SpecialityStep = ({
  prevStep,
  specialities,
  setSpecialities,
}: SpecialityStepProps) => {
  const router = useRouter();

  const hasValidSpecialities = (): boolean => {
    if (!specialities || specialities.length === 0) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!hasValidSpecialities()) return;
    try {
      const results = await Promise.allSettled(
        specialities.map((s) => createSpeciality(s))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled");
      if (succeeded.length === 0) {
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to save specialities:", err);
    }
  };

  return (
    <div className="step-container">
      <div className="step-title-container">
        <div className="step-title">Specialties</div>
        <div className="w-[300px] sm:w-[400px] xl:w-[500px]">
          <SpecialitySearch
            specialities={specialities}
            setSpecialities={setSpecialities}
          />
        </div>
      </div>

      {specialities.length === 0 && (
        <div className="specilities-container-empty">
          Search and add specialities from the search bar above
        </div>
      )}

      <div className="specialities-container">
        {specialities.map((speciality: any) => (
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
