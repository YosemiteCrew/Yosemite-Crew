import { Team } from "@/app/types/team";
import React from "react";

type UserLabels = {
  team: Team[];
  currentDate: Date;
};

const UserLabels = ({ team, currentDate }: UserLabels) => {
  return (
    <div className="grid grid-flow-col auto-cols-[200px] min-w-max border-b border-grey-light py-3">
      {team.map((user, idx) => {
        const weekday = currentDate.toLocaleDateString("en-US", {
          weekday: "short",
        });
        const dateNumber = currentDate.getDate();
        return (
          <div
            key={idx + currentDate.getDate()}
            className="flex items-center justify-center flex-col"
          >
            <div className="text-body-3-emphasis text-text-primary">
              {user.name || ""}
            </div>
            <div className="text-body-4 text-text-brand">{weekday}</div>
            <div className="text-body-4-emphasis text-white h-12 w-12 flex items-center justify-center rounded-full bg-text-brand">
              {dateNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
