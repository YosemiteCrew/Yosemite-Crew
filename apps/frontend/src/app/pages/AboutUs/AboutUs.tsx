"use client";
import React from "react";
import Image from "next/image";

import TeamSlide from "@/app/components/TeamSlide/TeamSlide";
import Footer from "@/app/components/Footer/Footer";

import "./AboutUs.css";

const AboutUs = () => {
  return (
    <>
      {/* AboutHero  */}
      <section className="AboutHeroSec">
        <div className="Container">
          <div className="AbtHeroData">
            <div className="abttopHero">
              <h2>Welcome to Yosemite Crew where compassion meets code</h2>
              <h4>
                For pet businesses, pet parents, and developers who want to
                shape the future of animal care
              </h4>
            </div>
            <div className="AbutheroBtm">
              <h2>About Us</h2>
              <div className="abtherocard">
                <div className="AbtCardItem">
                  <div className="head">
                    <h6>Why do we exist?</h6>
                  </div>
                  <div className="body">
                    <p>
                      Because, let’s face it, the pet business world is chaotic.
                      Juggling appointments, patient records, billing, and
                      communication shouldn’t be a daily struggle. The PMS
                      industry is cluttered, complicated, and outdated. That’s
                      where we come in.
                    </p>
                  </div>
                </div>

                <div className="AbtCardItem">
                  <div className="head">
                    <h6>Our mission</h6>
                  </div>
                  <div className="body">
                    <p>
                      Empower the pet business ecosystem with a platform that
                      actually works.We’ve got your back whether you’re a solo
                      vet, a clinic manager, or a tech-savvy developer ready to
                      build tools that matter.
                    </p>
                  </div>
                </div>

                <div className="AbtCardItem">
                  <div className="head">
                    <h6>Our USP</h6>
                  </div>
                  <div className="body">
                    <p>
                      We’re not just here to help you book appointments or track
                      patient history. We’re building a multi-verse of smart,
                      connected tools to make your practice run smoother,
                      faster, and better. Think of us as your one-stop
                      solution for the entire veterinary world.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story  */}
      <section className="OurStorySec">
        <div className="Container">
          <div className="StoryData">
            <Image
              src="https://d2il6osz49gpup.cloudfront.net/aboutus-page/aboutnew.png"
              alt="aboutstory"
              width={605}
              height={515}
            />

            <div className="storyTexted">
              <h2>Our story</h2>
              <div className="ourstorypara">
                <h6>
                  Our story began in the field quite literally. Back in the days
                  when our co-founder Ankit was leading animal health projects,
                  one thing became crystal clear: too many systems were driven
                  by money, overloaded with complexity, and lacked real user
                  integration. More work. More confusion. Less clarity.
                </h6>
                <h6>
                  So, we asked ourselves : what if we flipped the script? <br />{" "}
                  What if we created something smarter, friendlier, and actually
                  built around the people who use it?
                </h6>
                <h6>
                  Yosemite Crew was born from that idea. A digital space where
                  simplicity meets interactivity, where products are easy to
                  use, easy to recognise, and most importantly easy to love.
                  We&apos;ve spent our time deeply understanding user problems
                  so we can solve them, not add to them.
                </h6>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Teams Section  */}
      <section className="AbtTeamSec">
        <div className="Container">
          <div className="AbtTeamdata">
            <div className="AbtTeamHead">
              <h2>We’re an open source community</h2>
              <h4>That means no gates, no egos.</h4>
              <div className="para">
                <h6>
                  Just a group of humans trying to build better tools together,
                  with the help of people like you. We’re an open, diverse group
                  and always growing.{" "}
                </h6>
                <h6>
                  Together, we’re here to help our pets and our people. To make
                  technology work for care, not complicate it.
                </h6>
              </div>
            </div>

            <TeamSlide />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default AboutUs;
