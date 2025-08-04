
import Image from "next/image";
import "./StatCard.css"
import { Icon } from "@iconify/react/dist/iconify.js";

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
}

export default function StatCard({ icon, title, value }: StatCardProps) {
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
}
