"use client";
import React, { useState } from "react";
import "./MainLandingPage.css";
import { Button, Carousel, Container } from "react-bootstrap";
import Footer from "@/app/Components/Footer/Footer";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { FillBtn, UnFillBtn } from "../HomePage/HomePage";

// slidesData.ts (or keep inside your component)
const slidesData = [
  {
    id: 1,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg",
    alt: "Vet 1",
    text: "Empowering veterinary businesses to grow efficiently.",
  },
  {
    id: 2,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg2.jpg",
    alt: "Vet 2",
    text: "Simplifying pet health management for owners.",
  },
  {
    id: 3,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg3.jpg",
    alt: "Vet 3",
    text: "Creating opportunities for developers to innovate.",
  },
];

function MainLandingPage() {
  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setIndex(selectedIndex);
  };

  return (
    <>
      <section className="RedefiningSection">
        <Container id="customContainer">
          <div className="RederfiningData">
            <div className="leftRederfine">
              <div className="RederfineTextInner">
                <h2>Open Source Operating System for Animal Health</h2>
                <p>
                  Designed for veterinarians, pet owners, and developers to
                  collaborate in improving animal care. Streamline workflows
                  while enhancing health outcomes, all in one unified system
                </p>
              </div>
              <div className="RederfineInnerBtn">
                <FillBtn
                  icon={
                    <Icon
                      icon="solar:clock-circle-bold"
                      width="24"
                      height="24"
                    />
                  }
                  text=" Book a Demo"
                  href="/bookDemo"
                />
                <UnFillBtn
                  href="/homepage"
                  icon={
                    <Icon icon="solar:bill-check-bold" width="24" height="24" />
                  }
                  text="Learn more"
                />
              </div>
            </div>

            <div className="RightRederfine">
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
                {slidesData.map((slide) => (
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
        </Container>
      </section>

      {/* Vet Section  */}
      <section className="landingSection DarkLightBlueSec">
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <span>Best for Veterinary Practices</span>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>
                    Streamlined Solutions <br /> for Busy Vets
                  </h2>
                  <p>
                    Yosemite Crew helps veterinary practices stay organized,
                    save time, and offer superior care to their clients.
                  </p>
                </div>
                <Link href="/homepage">
                  {" "}
                  <Icon
                    icon="solar:bill-check-bold"
                    width="24"
                    height="24"
                  />{" "}
                  Learn more
                </Link>
              </div>
            </div>
            <div className="RightLanding">
              <div className="landingTop-Mobile">
                <span>Best for Veterinary Practices</span>
              </div>
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/landingimg1.png"
                alt="landingimg1"
                width={884}
                height={600}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* PetOwner Section  */}
      <section className="landingSection DarkBlueSec">
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <span>Perfect for Pet Owners</span>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>
                    Designed for Pet <br /> Owners — Simple, <br /> Intuitive,
                    Reliable
                  </h2>
                  <p>
                    Give pet parents the tools they need to stay on top of their
                    furry friend’s health, all while maintaining smooth
                    communication with their vets.
                  </p>
                </div>
                <Link href="/petowner">
                  {" "}
                  <Icon
                    icon="solar:bill-check-bold"
                    width="24"
                    height="24"
                  />{" "}
                  Learn more
                </Link>
              </div>
            </div>
            <div className="RightLanding">
              <div className="landingTop-Mobile">
                <span>Perfect for Pet Owners</span>
              </div>
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/landingimg2.png"
                alt="landingimg2"
                width={884}
                height={600}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Pricing Section  */}
      <section className="landingSection OpacityBlueSec">
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <span>Flexible and Transparent Pricing</span>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>
                    Pay as You Grow, No <br /> Strings Attached
                  </h2>
                  <p>
                    Choose what works best for you—host it yourself for free or
                    opt for our pay-as-you-go model. With no hidden fees or
                    long-term commitments, Yosemite Crew puts you in control.
                  </p>
                </div>
                <Link href="/pricing">
                  {" "}
                  <Icon
                    icon="solar:bill-check-bold"
                    width="24"
                    height="24"
                  />{" "}
                  Learn more
                </Link>
              </div>
            </div>
            <div className="RightLanding">
              <div className="landingTop-Mobile">
                <span>Flexible and Transparent Pricing</span>
              </div>
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/landingimg3.png"
                alt="landingimg3"
                width={884}
                height={600}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Developer Section  */}
      <section className="landingSection">
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <span>Developer-Friendly Platform</span>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>Built for Innovators</h2>
                  <p>
                    Yosemite Crew isn’t just for end-users—it’s a robust
                    platform for developers to create, customize, and innovate
                    new veterinary solutions.
                  </p>
                </div>
                <Link href="/developerlanding">
                  {" "}
                  <Icon
                    icon="solar:bill-check-bold"
                    width="24"
                    height="24"
                  />{" "}
                  Learn more
                </Link>
              </div>
            </div>
            <div className="RightLanding">
              <div className="landingTop-Mobile">
                <span>Developer-Friendly Platform</span>
              </div>
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/landingimg4-highres.png"
                alt="landingimg4"
                width={884}
                height={600}
              />
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}

export default MainLandingPage;
