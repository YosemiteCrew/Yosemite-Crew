import React from "react";
import Image from "next/image";

import "./FeatureCard.css";

interface FeatureCardProps {
  title?: string;
  description?: string;
  svg?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  svg,
}) => {
  return (
    <div className="card">
      <div>
        {svg && (
          <Image
            src={svg}
            alt={title + "icon"}
            width={100}
            height={100}
            className="icon"
          />
        )}
      </div>

      <div className="textContainer">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default FeatureCard;
