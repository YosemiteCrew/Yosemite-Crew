"use client";
import React, { ReactNode, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "@/app/components/Footer/Footer";
import { Primary } from "@/app/components/Buttons";
import FeatureBox from "./FeatureBox/FeatureBox";
import FocusCard from "./FocusCard/FocusCard";
import { focusCards, heroList, practiceFeatures } from "./data";

import "./HomePage.css";

const HomePage = () => {
  return (
    <>
      <section className="HomeHeroSection">
        <div className="Container">
          <div className="HomeHeroData">
            <div className="LeftHeroDiv">
              <div className="herotext">
                <h1 className="type first">Helping you help pets,</h1>
                <h1>
                  <span className="type second">without the hassle</span>
                </h1>
              </div>
              <div className="heroPara">
                {heroList.map((hero, index) => (
                  <div className="paraitem" key={index + hero.title}>
                    <p>
                      <Image
                        aria-hidden
                        src="https://d2il6osz49gpup.cloudfront.net/Images/petfootblue.png"
                        alt="petfoot"
                        width={20}
                        height={20}
                      />{" "}
                      {hero.title}
                    </p>
                  </div>
                ))}
              </div>
              <div className="HeroBtn">
                <Primary
                  style={{ width: "211px" }}
                  text="Book demo"
                  href="/book-demo"
                />
              </div>
            </div>
            <div className="RytHeroDiv">
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/HeroBg.png"
                alt="Hero"
                width={733}
                height={564}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="PracticedSection">
        <div className="Container">
          <div className="PracticedData">
            <div className="PractHeading">
              <h2>Everything you need to run your pet business</h2>
            </div>
            <div className="Practice_Box_Data">
              {practiceFeatures.map((feature, index) => (
                <FeatureBox
                  key={index + feature.title}
                  Bpimg={feature.image}
                  BpTxt1={feature.title}
                  BpTxt2={feature.title2}
                  BpPara={feature.description}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="FocusSection">
        <div className="Container">
          <div className="FocusData">
            <div className="FocusTexted">
              <h2>Focus on care, not admin</h2>
              <p>
                The easy-to-use, cloud-based software that simplifies practice
                management and elevates animal care.
              </p>
            </div>
            <div className="Focus_data">
              {focusCards.map((card, index) => (
                <FocusCard
                  key={index + card.title}
                  Focimg={card.img}
                  focname={card.title}
                  focpara={card.description}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* <section className="TrustExpertSec">
        <Container>
          <div className="ExptMaindata">
            <div className="ExprtTexted">
              <h4>Trusted by Veterinary Experts</h4>
            </div>
            <div className="TrustExpertData">
              <div className="Expertitems">
                <div className="expertPara">
                  <p>
                    Yosemite Crew has transformed the way we manage our clinic.
                    The open-source platform allows us to customize it to our
                    needs, and the automated workflows save us hours every week!
                  </p>
                </div>
                <div className="expertBio">
                  <Image
                    aria-hidden
                    src={`https://d2il6osz49gpup.cloudfront.net/Homepage/exprt1.png`}
                    alt="Hero"
                    width={50}
                    height={50}
                  />
                  <div className="exprtName">
                    <h6>Dr. Sarah Mitchell</h6>
                    <p>
                      Senior Veterinarian <br /> Paws & Claws Animal Hospital
                    </p>
                  </div>
                </div>
              </div>
              <div className="Expertitems purpleitem">
                <div className="expertPara">
                  <p>
                    Our team is more efficient, and our clients love the mobile
                    app. It’s made communication so much easier, and patient
                    care is more organized than ever.t
                  </p>
                </div>
                <div className="expertBio purplebio">
                  <Image
                    aria-hidden
                    src={`https://d2il6osz49gpup.cloudfront.net/Homepage/exprt2.png`}
                    alt="Hero"
                    width={50}
                    height={50}
                  />
                  <div className="exprtName">
                    <h6>Dr. Michael Lawson</h6>
                    <p>
                      Director <br /> Healthy Paws Veterinary Center
                    </p>
                  </div>
                </div>
              </div>
              <div className="Expertitems greenitem">
                <div className="expertPara">
                  <p>
                    Switching to Yosemite Crew was the best decision for our
                    practice. The integration with third-party tools and
                    real-time analytics have given us incredible insights into
                    how to improve our operations.
                  </p>
                </div>
                <div className="expertBio greenbio">
                  <Image
                    aria-hidden
                    src={`https://d2il6osz49gpup.cloudfront.net/Homepage/exprt3.png`}
                    alt="Hero"
                    width={50}
                    height={50}
                  />
                  <div className="exprtName">
                    <h6>Dr. Emily Carter</h6>
                    <p>
                      Clinic Manager <br /> Furry Friends Veterinary Clinic
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section> */}

      <section className="WhoCareSection">
        <div className="Container">
          <div className="whocareData">
            <div className="lftcare">
              <h2>Caring for vets, who care for pets</h2>
              <p>
                We prioritise your data security and compliance with
                industry-leading standards. Our platform is fully compliant with
                GDPR, SOC 2 and ISO 27001 standards!
              </p>
            </div>
            <div className="rytcare">
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/footer/gdpr.png"
                alt="cllog1"
                width={128}
                height={128}
              />
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/footer/soc-2.png"
                alt="cllog2"
                width={128}
                height={128}
              />
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/footer/iso.png"
                alt="cllog3"
                width={128}
                height={144}
              />
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/footer/fhir.png"
                alt="cllog4"
                width={207}
                height={50}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="BetterCareSec">
        <div className="Container">
          <div className="BettercareBox">
            <div className="lftbetter">
              <div className="betInner">
                <div className="careText">
                  <h2>
                    Better care is just a <br /> click away
                  </h2>
                  <p>
                    Join hundreds of veterinary clinics already enhancing animal
                    care and streamlining their workflow.
                  </p>
                </div>
                <Primary
                  text="Book demo"
                  href="/book-demo"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="lftbetter">
              <Image
                aria-hidden
                src={`https://d2il6osz49gpup.cloudfront.net/Homepage/betterimg.png`}
                alt="betterimg"
                width={507}
                height={433}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default HomePage;

// ButtonProps

type ButtonProps = {
  icon: ReactNode;
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
};

const FillBtn = ({
  icon,
  text,
  onClick,
  href,
  style,
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      className="Fillbtn"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault(); // ✅ stops immediate navigation
          onClick(e); // ✅ trigger your handler
        }
      }}
      style={style}
    >
      {icon} {text}
    </Link>
  );
};
const UnFillBtn = ({
  icon,
  text,
  href,
  onClick,
  style,
}: Readonly<ButtonProps>) => {
  return (
    <Link className="UnFillbtn" href={href} onClick={onClick} style={style}>
      {icon} {text}
    </Link>
  );
};

export { FillBtn, UnFillBtn };
