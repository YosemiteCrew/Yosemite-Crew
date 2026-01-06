import { Team } from "@/app/types/team";
import React from "react";

type UserLabels = {
  team: Team[];
  currentDate: Date;
};

const UserLabels = ({ team, currentDate }: UserLabels) => {
  return (
    <div className="grid grid-flow-col auto-cols-[200px] gap-x-2 min-w-max border-b border-grey-light py-3">
      {team.map((user, idx) => {
        const weekday = currentDate.toLocaleDateString("en-US", {
          weekday: "short",
        });
        const dateNumber = currentDate.getDate();
        return (
          <div
            key={idx + currentDate.getDate()}
            className="flex gap-1 items-center justify-center font-satoshi text-[13px] text-[#747473] font-medium"
          >
            <div className="">{weekday}</div>
            <div className="">{dateNumber + " - "}</div>
            <div className="">{user.name || ""}</div>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
