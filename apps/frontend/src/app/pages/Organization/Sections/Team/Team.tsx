import AccordionButton from "@/app/components/Accordion/AccordionButton";
import AvailabilityTable from "@/app/components/DataTable/AvailabilityTable";
import React, { useEffect, useState } from "react";
import { DemoTeam } from "../../demo";
import AddTeam from "./AddTeam";
import TeamInfo from "./TeamInfo";

const Team = () => {
  const [team] = useState(DemoTeam);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<any>(DemoTeam[0] ?? null);

  useEffect(() => {
    if (team.length > 0) {
      setActiveTeam(team[0]);
    } else {
      setActiveTeam(null);
    }
  }, [team]);

  return (
    <>
      <AccordionButton title="Team" buttonTitle="Add" buttonClick={setAddPopup}>
        <AvailabilityTable
          filteredList={team}
          setActive={setActiveTeam}
          setView={setViewPopup}
        />
      </AccordionButton>
      <AddTeam showModal={addPopup} setShowModal={setAddPopup} />
      {activeTeam && (
        <TeamInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeTeam={activeTeam}
        />
      )}
    </>
  );
};

export default Team;
