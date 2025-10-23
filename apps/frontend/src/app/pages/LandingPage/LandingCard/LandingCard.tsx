import React from "react";
import Image from "next/image";

import { Primary } from "@/app/components/Buttons";
import { InfoCard } from "../data";

import "./LandingCard.css";

const LandingCard = ({ item }: { item: InfoCard }) => {
  return (
    <section className="landingSection" style={{ background: item.background }}>
      <div className="landingContainer">
        <div className="landingTop">
          <span>{item.target}</span>
        </div>
        <div className="LandingData">
          <div className="LeftLanding">
            <div className="landingTexed">
              <div className="landinginnerTexed">
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <Primary
                style={{ width: "211px" }}
                text="Learn more"
                href={item.href}
              />
            </div>
          </div>
          <div className="RightLanding">
            <Image
              aria-hidden
              src={item.image}
              alt="landingimg1"
              width={884}
              height={600}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingCard;
