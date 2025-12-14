import AccordionButton from "@/app/components/Accordion/AccordionButton";
import AvailabilityTable from "@/app/components/DataTable/AvailabilityTable";
import React, { useEffect, useState } from "react";
import AddTeam from "./AddTeam";
import TeamInfo from "./TeamInfo";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team as TeamProp } from "@/app/types/team";

const Team = () => {
  const teams = useTeamForPrimaryOrg();
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(
    teams[0] ?? null
  );

  useEffect(() => {
    setActiveTeam((prev) => {
      if (teams.length === 0) return null;
      if (prev?._id) {
        const updated = teams.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return teams[0];
    });
  }, [teams]);

  return (
    <>
      <AccordionButton title="Team" buttonTitle="Add" buttonClick={setAddPopup}>
        <AvailabilityTable
          filteredList={teams}
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
