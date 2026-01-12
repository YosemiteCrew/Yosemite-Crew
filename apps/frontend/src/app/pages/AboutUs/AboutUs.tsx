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
              <div className="text-display-1 text-text-primary">Welcome to Yosemite Crew where compassion meets code</div>
              <div className="text-heading-1 text-text-secondary">
                For pet businesses, pet parents, and developers who want to
                shape the future of animal care
              </div>
            </div>
            <div className="AbutheroBtm">
              <div className="text-display-1 text-text-primary">About Us</div>
              <div className="abtherocard">
                <div className="AbtCardItem">
                  <div className="head">
                    <div className="text-body-3-emphasis text-white">Why do we exist?</div>
                  </div>
                  <div className="body">
                    <div className="text-body-3 text-text-secondary">
                      Because, let&rsquo;s face it, the pet business world is chaotic.
                      Juggling appointments, patient records, billing, and
                      communication shouldn&rsquo;t be a daily struggle. The PMS
                      industry is cluttered, complicated, and outdated. That&rsquo;s
                      where we come in.
                    </div>
                  </div>
                </div>

                <div className="AbtCardItem">
                  <div className="head">
                    <div className="text-body-3-emphasis text-white">Our mission</div>
                  </div>
                  <div className="body">
                    <div className="text-body-3 text-text-secondary">
                      Empower the pet business ecosystem with a platform that
                      actually works.We&rsquo;ve got your back whether you&rsquo;re a solo
                      vet, a clinic manager, or a tech-savvy developer ready to
                      build tools that matter.
                    </div>
                  </div>
                </div>

                <div className="AbtCardItem">
                  <div className="head">
                    <div className="text-body-3-emphasis text-white">Our USP</div>
                  </div>
                  <div className="body">
                    <div className="text-body-3 text-text-secondary">
                      We&rsquo;re not just here to help you book appointments or track
                      patient history. We&rsquo;re building a multi-verse of smart,
                      connected tools to make your practice run smoother,
                      faster, and better. Think of us as your one-stop
                      solution for the entire veterinary world.
                    </div>
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
              <div className="text-display-1 text-text-primary">Our story</div>
              <div className="ourstorypara">
                <div className="text-body-3 text-text-secondary">
                  Our story began in the field quite literally. Back in the days
                  when our co-founder Ankit was leading animal health projects,
                  one thing became crystal clear: too many systems were driven
                  by money, overloaded with complexity, and lacked real user
                  integration. More work. More confusion. Less clarity.
                </div>
                <div className="text-body-3 text-text-secondary">
                  So, we asked ourselves : what if we flipped the script? <br />{" "}
                  What if we created something smarter, friendlier, and actually
                  built around the people who use it?
                </div>
                <div className="text-body-3 text-text-secondary">
                  Yosemite Crew was born from that idea. A digital space where
                  simplicity meets interactivity, where products are easy to
                  use, easy to recognise, and most importantly easy to love.
                  We&apos;ve spent our time deeply understanding user problems
                  so we can solve them, not add to them.
                </div>
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
              <div className="text-display-1 text-text-primary">We&rsquo;re an open source community</div>
              <div className="text-display-2 text-text-secondary">That means no gates, no egos.</div>
              <div className="para">
                <div className="text-heading-2 text-text-secondary">
                  Just a group of humans trying to build better tools together,
                  with the help of people like you. We&rsquo;re an open, diverse group
                  and always growing.{" "}
                </div>
                <div className="text-heading-2 text-text-secondary">
                  Together, we&rsquo;re here to help our pets and our people. To make
                  technology work for care, not complicate it.
                </div>
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
