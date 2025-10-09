import React from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

import "./StatCard.css";

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
}

const StatCard = ({ icon, title, value }: Readonly<StatCardProps>) => {
  return (
    <div className="StatCardDiv">
      <div className="StatIcon">
        {/* <Image src={icon} alt={title} width={32} height={32} /> */}
        <Icon icon={icon} width={32} height={32} />
      </div>
      <div className="StateTexed">
        <p>{title}</p>
        <h4>{value}</h4>
      </div>
    </div>
  );
};

export default StatCard;
