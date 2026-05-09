import React from 'react';
import { Speciality } from '@yosemite-crew/types';
import SpecialitySearchBase from '@/app/ui/inputs/SpecialitySearch/SpecialitySearchBase';

type SpecialitySearchProps = {
  organisationId?: string | null;
  specialities: Speciality[];
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
  multiple?: boolean;
};

const SpecialitySearch = ({
  organisationId,
  specialities,
  setSpecialities,
  multiple = true,
}: SpecialitySearchProps) => (
  <SpecialitySearchBase
    organisationId={organisationId}
    specialities={specialities}
    setSpecialities={setSpecialities}
    multiple={multiple}
  />
);

export default SpecialitySearch;
