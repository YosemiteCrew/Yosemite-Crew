import AccordionButton from "@/app/components/Accordion/AccordionButton";
import SpecialitiesTable from "@/app/components/DataTable/SpecialitiesTable";
import React, { useEffect, useState } from "react";
import { demoSpecialities } from "../../demo";
import AddSpeciality from "./AddSpeciality";
import SpecialityInfo from "./SpecialityInfo";

const Specialities = () => {
  const [specialties] = useState(demoSpecialities);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeSpeciality, setActiveSpeciality] = useState<any>(
    demoSpecialities[0] ?? null
  );

  useEffect(() => {
    if (specialties.length > 0) {
      setActiveSpeciality(specialties[0]);
    } else {
      setActiveSpeciality(null);
    }
  }, [specialties]);

  return (
    <>
      <AccordionButton
        title="Specialties"
        buttonTitle="Add"
        buttonClick={setAddPopup}
      >
        <SpecialitiesTable
          filteredList={specialties}
          setActive={setActiveSpeciality}
          setView={setViewPopup}
        />
      </AccordionButton>
      <AddSpeciality showModal={addPopup} setShowModal={setAddPopup} />
      {activeSpeciality && (
        <SpecialityInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeSpeciality={activeSpeciality}
        />
      )}
    </>
  );
};

export default Specialities;
