import AccordionButton from "@/app/ui/primitives/Accordion/AccordionButton";
import AvailabilityTable from "@/app/ui/tables/AvailabilityTable";
import React, { useEffect, useState } from "react";
import AddTeam from "@/app/features/organization/pages/Organization/Sections/Team/AddTeam";
import TeamInfo from "@/app/features/organization/pages/Organization/Sections/Team/TeamInfo";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team as TeamProp } from "@/app/features/organization/types/team";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions";
import { usePermissions } from "@/app/hooks/usePermissions";

const Team = () => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
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
    <PermissionGate allOf={[PERMISSIONS.TEAMS_VIEW_ANY]}>
      <AccordionButton
        title="Team"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditTeam}
      >
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
          canEditTeam={canEditTeam}
        />
      )}
    </PermissionGate>
  );
};

export default Team;
