"use client";
import React, { useState } from "react";
import { Carousel } from "react-bootstrap";
import Image from "next/image";
import { Icon } from "@iconify/react";

import Footer from "@/app/components/Footer/Footer";
import LandingCard from "./LandingCard/LandingCard";
import { Primary } from "@/app/components/Buttons";
import { InfoCards, SlidesData } from "./data";
import { TextFade } from "@/app/components/Animations/TextFade";

import "./LandingPage.css";

const LandingPage = () => {
  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setIndex(selectedIndex);
  };

  return (
    <>
      <section className="HeroSection">
        <div className="HeroContainer">
          <div className="LeftHeroSection">
            <TextFade direction="up" className="LeftHeroText">
              <h2>Open source operating system for animal health</h2>
              <p>
                Designed for pet businesses, pet parents, and developers to
                collaborate in improving animal care. Streamline workflows while
                enhancing health outcomes, in one unified system.
              </p>
            </TextFade>
            <TextFade direction="up" className="LeftHeroButtons">
              <Primary
                style={{ width: "211px" }}
                text="Book demo"
                href="/book-demo"
              />
            </TextFade>
          </div>

          <div className="RightHeroSection">
            <Carousel
              activeIndex={index}
              onSelect={handleSelect}
              controls={true}
              indicators={true}
              nextIcon={
                <span className="custom-arrow">
                  <Icon
                    icon="solar:round-alt-arrow-right-outline"
                    width="48"
                    height="48"
                  />
                </span>
              }
              prevIcon={
                <span className="custom-arrow">
                  <Icon
                    icon="solar:round-alt-arrow-left-outline"
                    width="48"
                    height="48"
                  />
                </span>
              }
            >
              {SlidesData.map((slide) => (
                <Carousel.Item key={slide.id}>
                  <div className="LandingCarouselDiv">
                    <Image
                      src={slide.image}
                      alt={slide.alt}
                      width={887}
                      height={565}
                    />
                    <div className="carousel-text">
                      <h4>{slide.text}</h4>
                    </div>
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          </div>
        </div>
      </section>

      <div className="flex flex-col pb-8!">
        {InfoCards.map((item, idx) => (
          <LandingCard key={idx + item.title} item={item} />
        ))}
      </div>

      <Footer />
    </>
  );
};

export default LandingPage;
