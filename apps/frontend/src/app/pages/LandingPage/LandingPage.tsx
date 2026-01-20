"use client";
import React, { useState } from "react";
import { Carousel } from "react-bootstrap";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

import Footer from "@/app/components/Footer/Footer";
import LandingCard from "./LandingCard/LandingCard";
import { Primary } from "@/app/components/Buttons";
import { InfoCards, SlidesData } from "./data";
import { TextFade } from "@/app/components/Animations/TextFade";
import StarRipple from "./StarRipple";
import { useAuthStore } from "@/app/stores/authStore";

import "./LandingPage.css";

// Feature flag to toggle between old and new hero section
const USE_NEW_HERO = true;

const NewHeroSection = () => {
  const { user, role } = useAuthStore();

  const getCtaHref = () => {
    if (user) {
      return role === "developer" ? "/developers/home" : "/organizations";
    }
    return "/signup";
  };

  return (
    <section className="new-hero-section">
      <StarRipple />
      <div className="new-hero-content">
        <motion.div
          className="text-display-1 text-text-primary text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          Open source operating system for animal health
        </motion.div>
        <motion.div
          className="text-body-2 text-text-primary text-center max-w-[640px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          Designed for pet businesses, pet parents, and developers to
          collaborate in improving animal care. Streamline workflows while
          enhancing health outcomes, in one unified system.
        </motion.div>
        <motion.div
          className="new-hero-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
          <Primary
            text={user ? "Go to app" : "Get started free"}
            href={getCtaHref()}
            size="large"
          />
        </motion.div>
      </div>

      {/* Dog image - center of viewport */}
      <motion.div
        className="hero-dog-image"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      >
        <Image
          src="https://d2il6osz49gpup.cloudfront.net/MainLanding/landingDog.png"
          alt="Dog"
          width={200}
          height={200}
          style={{ objectFit: "contain" }}
        />
      </motion.div>

      {/* Horse image - bottom left of viewport */}
      <motion.div
        className="hero-horse-image"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
      >
        <Image
          src="https://d2il6osz49gpup.cloudfront.net/MainLanding/landingHorse.png"
          alt="Horse"
          width={250}
          height={250}
          style={{ objectFit: "contain" }}
        />
      </motion.div>
    </section>
  );
};

const OldHeroSection = ({
  index,
  handleSelect,
}: {
  index: number;
  handleSelect: (selectedIndex: number) => void;
}) => {
  return (
    <section className="HeroSection">
      <div className="HeroContainer">
        <div className="LeftHeroSection">
          <TextFade direction="up" className="LeftHeroText">
            <div className="text-display-1 text-text-primary">
              Open source operating system for animal health
            </div>
            <div className="text-body-2 text-text-primary">
              Designed for pet businesses, pet parents, and developers to
              collaborate in improving animal care. Streamline workflows while
              enhancing health outcomes, in one unified system.
            </div>
          </TextFade>
          <TextFade direction="up" className="LeftHeroButtons">
            <Primary text="Book demo" href="/book-demo" size="large" />
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
                    <div className="text-heading-1 text-text-primary">
                      {slide.text}
                    </div>
                  </div>
                </div>
              </Carousel.Item>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setIndex(selectedIndex);
  };

  return (
    <>
      {USE_NEW_HERO ? (
        <NewHeroSection />
      ) : (
        <OldHeroSection index={index} handleSelect={handleSelect} />
      )}

      {/* Old Hero Section (commented out)
      <section className="HeroSection">
        <div className="HeroContainer">
          <div className="LeftHeroSection">
            <TextFade direction="up" className="LeftHeroText">
              <div className="text-display-1 text-text-primary">Open source operating system for animal health</div>
              <div className="text-body-2 text-text-primary">
                Designed for pet businesses, pet parents, and developers to
                collaborate in improving animal care. Streamline workflows while
                enhancing health outcomes, in one unified system.
              </div>
            </TextFade>
            <TextFade direction="up" className="LeftHeroButtons">
              <Primary
                text="Book demo"
                href="/book-demo"
                size="large"
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
                      <div className="text-heading-1 text-text-primary">{slide.text}</div>
                    </div>
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          </div>
        </div>
      </section>
      */}

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
