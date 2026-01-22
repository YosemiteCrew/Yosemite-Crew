import AccordionButton from "@/app/components/Accordion/AccordionButton";
import SpecialitiesTable from "@/app/components/DataTable/SpecialitiesTable";
import React, { useEffect, useState } from "react";
import AddSpeciality from "./AddSpeciality";
import SpecialityInfo from "./SpecialityInfo";
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { SpecialityWeb } from "@/app/types/speciality";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import { usePermissions } from "@/app/hooks/usePermissions";

const Specialities = () => {
  const specialities = useSpecialitiesWithServiceNamesForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSpecialities = can(PERMISSIONS.SPECIALITIES_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeSpeciality, setActiveSpeciality] =
    useState<SpecialityWeb | null>(specialities[0] ?? null);

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
    <PermissionGate allOf={[PERMISSIONS.SPECIALITIES_VIEW_ANY]}>
      <AccordionButton
        title="Specialties & Services"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditSpecialities}
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
          canEditSpecialities={canEditSpecialities}
        />
      )}
    </PermissionGate>
  );
};

export default Specialities;
