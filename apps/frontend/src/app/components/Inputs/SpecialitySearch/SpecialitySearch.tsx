import React from "react";
import { Speciality } from "@yosemite-crew/types";
import SpecialitySearchBase from "./SpecialitySearchBase";

type SpecialitySearchProps = {
  specialities: Speciality[];
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
  multiple?: boolean;
};

const SpecialitySearch = ({
  specialities,
  setSpecialities,
  multiple = true,
}: SpecialitySearchProps) => (
  <SpecialitySearchBase
    specialities={specialities}
    setSpecialities={setSpecialities}
    multiple={multiple}
  />
);

export default SpecialitySearch;
