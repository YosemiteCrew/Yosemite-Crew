import React from 'react';
import { IoTrash } from 'react-icons/io5';
import { Speciality } from '@yosemite-crew/types';

import './SpecialityCard.css';

type SpecialityCardProps = {
  speciality: Speciality;
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
};

const SpecialityCard = ({ speciality, setSpecialities }: SpecialityCardProps) => {
  const handleDelete = () => {
    setSpecialities((prev) => prev.filter((s) => s.name !== speciality.name));
  };

  return (
    <div className="speciality-container">
      <div className="speciality-title-container">
        <div className="speciality-title">{speciality.name}</div>
        <IoTrash
          size={20}
          color="var(--color-danger-600)"
          className="speciality-delete"
          onClick={handleDelete}
        />
      </div>
    </div>
  );
};

export default SpecialityCard;
