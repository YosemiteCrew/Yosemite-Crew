import React from "react";
import { SpecialityWeb } from "@/app/features/organization/types/speciality";
import SpecialitySearchBase from "@/app/ui/inputs/SpecialitySearch/SpecialitySearchBase";

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
