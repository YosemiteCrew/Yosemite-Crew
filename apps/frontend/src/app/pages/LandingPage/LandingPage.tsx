"use client";
import React, { useState } from "react";
import { Carousel } from "react-bootstrap";
import Image from "next/image";
import { Icon } from "@iconify/react";

import Footer from "@/app/components/Footer/Footer";
import LandingCard from "./LandingCard/LandingCard";
import { Primary, Secondary } from "@/app/components/Buttons";
import { InfoCards, SlidesData } from "./data";

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
            <div className="LeftHeroText">
              <h2>Open Source Operating System for Animal Health</h2>
              <p>
                Designed for veterinarians, pet owners, and developers to
                collaborate in improving animal care. Streamline workflows while
                enhancing health outcomes, all in one unified system
              </p>
            </div>
            <div className="LeftHeroButtons">
              <Primary
                style={{ width: "211px" }}
                text="Book demo"
                href="/book-demo"
              />
              <Secondary
                style={{ width: "211px" }}
                href="/pms"
                text="Learn more"
              />
            </div>
          </div>

          <div className="RightHeroSection">
            <Carousel
              activeIndex={index}
              onSelect={handleSelect}
              controls={true}
              indicators={true}
              // interval={3000}

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

      {InfoCards.map((item, idx) => (
        <LandingCard key={idx + item.title} item={item} />
      ))}

      <Footer />
    </>
  );
};

export default LandingPage;
