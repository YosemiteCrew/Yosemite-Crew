import React from "react";
import Image from "next/image";

import { Primary } from "@/app/components/Buttons";
import { InfoCard } from "../data";
import { TextFade } from "@/app/components/Animations/TextFade";

import "./LandingCard.css";

const LandingCard = ({ item }: { item: InfoCard }) => {
  return (
    <section className="landingSection" style={{ background: item.background }}>
      <div className="landingContainer">
        <TextFade direction="up" className="landingTop">
          <span>{item.target}</span>
        </TextFade>
        <div className="LandingData">
          <div className="LeftLanding">
            <div className="landingTexed">
              <TextFade direction="up" className="landinginnerTexed">
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </TextFade>
              <TextFade direction="up">
                <Primary
                  style={{ width: "211px" }}
                  text="Learn more"
                  href={item.href}
                />
              </TextFade>
            </div>
          </div>
          <TextFade direction="up" className="RightLanding">
            <Image
              aria-hidden
              src={item.image}
              alt="landingimg1"
              width={884}
              height={600}
            />
          </TextFade>
        </div>
      </div>
    </section>
  );
};

export default LandingCard;
