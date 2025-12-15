import React from "react";
import { MdDeleteForever } from "react-icons/md";
import { Speciality } from "@yosemite-crew/types";

import "./SpecialityCard.css";

type SpecialityCardProps = {
  speciality: Speciality;
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
};

const SpecialityCard = ({
  speciality,
  setSpecialities,
}: SpecialityCardProps) => {
  const handleDelete = () => {
    setSpecialities((prev) => prev.filter((s) => s.name !== speciality.name));
  };

  return (
    <div className="speciality-container">
      <div className="speciality-title-container">
        <div className="speciality-title">{speciality.name}</div>
        <MdDeleteForever
          size={24}
          color="#EA3729"
          className="speciality-delete"
          onClick={handleDelete}
        />
      </div>
    </div>
  );
};

export default SpecialityCard;
