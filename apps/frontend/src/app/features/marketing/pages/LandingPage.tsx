'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

import Footer from '@/app/ui/widgets/Footer/Footer';
import LandingCard from '@/app/features/marketing/components/LandingPage/LandingCard';
import { Primary } from '@/app/ui/primitives/Buttons';
import { InfoCards, SlidesData } from '@/app/features/marketing/pages/data';
import { TextFade } from '@/app/ui/widgets/Animations/TextFade';
import StarRipple from '@/app/features/marketing/components/LandingPage/StarRipple';
import { useAuthStore } from '@/app/stores/authStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

import './LandingPage.css';

// Feature flag to toggle between old and new hero section
const USE_NEW_HERO = true;

const NewHeroSection = () => {
  const { user, role } = useAuthStore();

  const getCtaHref = () => {
    if (user) {
      return role === 'developer' ? '/developers/home' : resolveDefaultOpenScreenRoute(role);
    }
    return '/signup';
  };

  return (
    <section className="new-hero-section">
      <StarRipple />
      <div className="new-hero-content">
        <motion.h1
          className="text-display-1 text-text-primary text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Open source operating system for animal health
        </motion.h1>
        <motion.div
          className="text-body-2 text-text-primary text-center max-w-[640px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        >
          Designed for pet businesses, pet parents, and developers to collaborate in improving
          animal care. Streamline workflows while enhancing health outcomes, in one unified system.
        </motion.div>
        <motion.div
          className="new-hero-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
        >
          <Primary
            text={user ? 'Go to app' : 'Get started free'}
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
        transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
      >
        <Image
          src={MEDIA_SOURCES.landing.dog}
          alt="Canine"
          width={200}
          height={200}
          style={{ objectFit: 'contain' }}
        />
      </motion.div>

      {/* Horse image - bottom left of viewport */}
      <motion.div
        className="hero-horse-image"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
      >
        <Image
          src={MEDIA_SOURCES.landing.horse}
          alt="Equine"
          width={250}
          height={250}
          style={{ objectFit: 'contain' }}
          priority
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
            <h1 className="text-display-1 text-text-primary">
              Open source operating system for animal health
            </h1>
            <div className="text-body-2 text-text-primary">
              Designed for pet businesses, pet parents, and developers to collaborate in improving
              animal care. Streamline workflows while enhancing health outcomes, in one unified
              system.
            </div>
          </TextFade>
          <TextFade direction="up" className="LeftHeroButtons">
            <Primary text="Book demo" href="/book-demo" size="large" />
          </TextFade>
        </div>

        <div className="RightHeroSection">
          <div className="relative overflow-hidden">
            <div className="LandingCarouselDiv">
              <Image
                src={SlidesData[index].image}
                alt={SlidesData[index].alt}
                width={887}
                height={565}
              />
              <div className="carousel-text">
                <p className="text-heading-1 text-text-primary">{SlidesData[index].text}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Previous slide"
              className="custom-arrow absolute left-2 top-1/2 -translate-y-1/2 z-10"
              onClick={() => handleSelect((index - 1 + SlidesData.length) % SlidesData.length)}
            >
              <Icon icon="solar:round-alt-arrow-left-outline" width="48" height="48" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="custom-arrow absolute right-2 top-1/2 -translate-y-1/2 z-10"
              onClick={() => handleSelect((index + 1) % SlidesData.length)}
            >
              <Icon icon="solar:round-alt-arrow-right-outline" width="48" height="48" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {SlidesData.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
                  onClick={() => handleSelect(i)}
                />
              ))}
            </div>
          </div>
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
