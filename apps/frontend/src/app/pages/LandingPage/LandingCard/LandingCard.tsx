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
        <div className="LandingData">
          <div className="LeftLanding">
            <div className="landingTexed">
              <TextFade direction="up" className="landinginnerTexed">
                <TextFade direction="up" className="landingTop">
                  <div className="text-display-2 pb-2">{item.target}</div>
                </TextFade>
                <div className="text-display-1">{item.title}</div>
                <div className="text-body-2">{item.description}</div>
              </TextFade>
              <TextFade direction="up">
                <Primary size="large" text="Learn more" href={item.href} classname="w-fit" />
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
