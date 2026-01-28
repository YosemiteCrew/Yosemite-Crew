import React from "react";
import { SpecialityWeb } from "@/app/types/speciality";
import SpecialitySearchBase from "./SpecialitySearchBase";

type SpecialitySearchProps = {
  specialities: SpecialityWeb[];
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
  multiple?: boolean;
  currentSpecialities: SpecialityWeb[];
};

const SpecialitySearchWeb = ({
  specialities,
  setSpecialities,
  multiple = true,
  currentSpecialities,
}: SpecialitySearchProps) => (
  <SpecialitySearchBase
    specialities={specialities}
    setSpecialities={setSpecialities}
    multiple={multiple}
    currentSpecialities={currentSpecialities}
  />
);

export default SpecialitySearchWeb;
