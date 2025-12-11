import AccordionButton from "@/app/components/Accordion/AccordionButton";
import SpecialitiesTable from "@/app/components/DataTable/SpecialitiesTable";
import React, { useEffect, useState } from "react";
import AddSpeciality from "./AddSpeciality";
import SpecialityInfo from "./SpecialityInfo";
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { SpecialityWeb } from "@/app/types/speciality";

const Specialities = () => {
  const specialities = useSpecialitiesWithServiceNamesForPrimaryOrg();
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeSpeciality, setActiveSpeciality] =
    useState<SpecialityWeb | null>(specialities[0] ?? null);

    console.log(specialities)

  useEffect(() => {
    setActiveSpeciality((prev) => {
      if (specialities.length === 0) return null;
      if (prev?._id) {
        const updated = specialities.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return specialities[0];
    });
  }, [specialities]);

  return (
    <>
      <AccordionButton
        title="Specialties & Services"
        buttonTitle="Add"
        buttonClick={setAddPopup}
      >
        <SpecialitiesTable
          filteredList={specialities}
          setActive={setActiveSpeciality}
          setView={setViewPopup}
        />
      </AccordionButton>
      <AddSpeciality
        showModal={addPopup}
        setShowModal={setAddPopup}
        specialities={specialities}
      />
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
