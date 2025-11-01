"use client";
import React from "react";
import Image from "next/image";

import LaunchGrowTab from "@/app/components/LaunchGrowTab/LaunchGrowTab";
import Footer from "@/app/components/Footer/Footer";

import "./DeveloperLanding.css";
import { Primary } from "@/app/components/Buttons";

const DeveloperLanding = () => {
  return (
    <>
      <section className="DevlpHeroSec">
        <div className="Container">
          <div className="DevlpHeroData">
            <div className="LeftDevBanr">
              <div className="devbanrtext">
                <h2>
                  Build, customise, and launch powerful apps for the animal
                  health ecosystem
                </h2>
                <p>
                  {" "}
                  Transform animal care with your ideas. Yosemite Crew offers
                  tools and APIs to build custom apps for pet businesses,
                  including AI scribe and voice calls
                </p>
              </div>
              <div className="DevbanrBtn">
                <Primary href="/developers" text="Developer portal" />
              </div>
            </div>
            <div className="RytDevBanr ">
              <Image
                className="floating"
                src="https://d2il6osz49gpup.cloudfront.net/Images/devlogin.png"
                alt="devlogin"
                width={694}
                height={560}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="DevlYousmiteSec">
        <div className="Container">
          <div className="DevlYousmiteSecData">
            <div className="YousmiteCrew">
              <h4>Why developers choose Yosemite Crew</h4>
            </div>
            <div className="DevYousmiteBoxed">
              <div className="DevCrewBox crewbox1">
                <div className="crewText">
                  <h3>Flexibilty</h3>
                  <p>
                    Create custom solutions for pet businesses, adapting to any
                    need.
                  </p>
                </div>
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose1.png"
                  alt="devchose1"
                  width={200}
                  height={140}
                />
              </div>
              <div className="DevCrewBox crewbox2">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose2.png"
                  alt="devchose2"
                  width={140}
                  height={140}
                />
                <div className="crewText">
                  <h3>Seamless integrations</h3>
                  <p>
                    Easily integrate with existing healthcare systems and
                    third-party tools to enhance app functionality.
                  </p>
                </div>
              </div>
              <div className="DevCrewBox crewbox3">
                <div className="crewText">
                  <h3>Open source</h3>
                  <p>
                    Developer-friendly API pricing based on an open source
                    framework under the GPL V3 license
                  </p>
                </div>
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose3.png"
                  alt="devchose3"
                  width={140}
                  height={140}
                />
              </div>
              <div className="DevCrewBox crewbox4">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose4.png"
                  alt="devchose4"
                  width={102}
                  height={102}
                />
                <div className="crewText">
                  <h3>Scalability</h3>
                  <p>
                    Build apps that seamlessly grow as your user base and
                    features expand.
                  </p>
                </div>
              </div>
              <div className="DevCrewBox crewbox5">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose5.png"
                  alt="devchose5"
                  width={92}
                  height={92}
                />
                <div className="crewText">
                  <h3>Comprehensive tools</h3>
                  <p>
                    Access a wide range of APIs, SDKs, and pre-built templates
                    that simplify development.
                  </p>
                </div>
              </div>
              <div className="DevCrewBox crewbox6">
                <div className="crewText">
                  <h3>Secure data handling</h3>
                  <p>
                    Built with industry-leading security protocols, ensuring
                    sensitive healthcare data is always protected.
                  </p>
                </div>
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devchose6.png"
                  alt="devchose6"
                  width={129}
                  height={100}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="DevlpToolSec">
        <div className="Container">
          <div className="DevlpToolData">
            <div className="TopResorchTool">
              <div className="leftResorch">
                <h2>Everything You Need to Build and Launch</h2>
              </div>
              <div className="RytResorch">
                <p>
                  From robust APIs to intuitive SDKs and customizable templates,
                  Yosemite Crew provides every tool you need to create powerful
                  veterinary applications.
                </p>
              </div>
            </div>

            <div className="BottomResorchTool">
              <LaunchGrowTab />
            </div>
          </div>
        </div>
      </section>

      <section className="SimpleStepSec">
        <div className="Container">
          <div className="StepsData">
            <div className="leftSimpleStep">
              <h2>Get started in three simple steps</h2>
              <Primary href="/developers" text="Developer portal" style={{ width: "100%" }} />
            </div>
            <div className="RytSimpleStep">
              <div className="Stepitems">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devstep1.png"
                  alt="devstep1"
                  width={48}
                  height={114}
                />
                <div className="Stepstext">
                  <h4>Sign up</h4>
                  <p>Create your developer account and access our portal.</p>
                </div>
              </div>
              <div className="Stepitems">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devstep2.png"
                  alt="devstep2"
                  width={48}
                  height={114}
                />
                <div className="Stepstext">
                  <h4>Explore</h4>
                  <p>Browse APIs, SDKs, and templates to suit your needs.</p>
                </div>
              </div>
              <div className="Stepitems">
                <Image
                  src="https://d2il6osz49gpup.cloudfront.net/Images/devstep3.png"
                  alt="devstep3"
                  width={48}
                  height={48}
                />
                <div className="Stepstext">
                  <h4>Build</h4>
                  <p>Develop, test, and deploy your app seamlessly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* <section className="DevlpPricingSec">
        <Container>
          <div className="DevPriceHead">
            <p>Pricing</p>
            <h2>Transparent Pricing That Fits Your Needs</h2>
          </div>
          <div className="DevPriceCard">
            <div className="DevPricBox">
              <div className="devpboxtext">
                <h4>Pay-As-You-Go</h4>
                <p>Use our hosted solutions with scalable fees.</p>
              </div>
            </div>
            <div className="DevPricBox">
              <div className="devpboxtext">
                <h4>Free Option</h4>
                <p>Self-host your applications at no cost.</p>
              </div>
            </div>
            <div className="DevPricBox">
              <div className="devpboxtext">
                <h4>No Lock-In</h4>
                <p>Switch between self-hosted and managed options anytime.</p>
              </div>
            </div>
          </div>
        </Container>
      </section> */}

      {/* <section className="DevlpBuildSec">
        <Container>
          <div className="ReadyBuildData">
            <div className="leftBuild">
              <div className="leftBuilinner">
                <div className="texted">
                  <h4>Ready to Build?</h4>
                  <p>
                    {" "}
                    Join a growing community of developers creating
                    transformative solutions for the veterinary world.
                  </p>
                </div>
                <FillBtn
                  icon={<Icon icon="solar:bolt-bold" width="24" height="24" />}
                  text="Sign Up as a Developer"
                  href="#"
                />
              </div>
            </div>
            <div className="RytBuild">
              <Image
                src={`https://d2il6osz49gpup.cloudfront.net/Devlperlanding/devlpbuild.png`}
                alt="devlpbuild"
                width={507}
                height={433}
              />
            </div>
          </div>
        </Container>
      </section> */}

      <Footer />
    </>
  );
};

export default DeveloperLanding;
