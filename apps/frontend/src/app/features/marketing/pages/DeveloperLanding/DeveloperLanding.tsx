'use client';
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import LaunchGrowTab from '@/app/ui/widgets/LaunchGrowTab/LaunchGrowTab';
import Footer from '@/app/ui/widgets/Footer/Footer';

import './DeveloperLanding.css';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useAuthStore } from '@/app/stores/authStore';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

const DeveloperLanding = () => {
  const router = useRouter();
  const { status, user } = useAuthStore();

  const handleDeveloperCTA = () => {
    // Check if user is authenticated AND has devAuth flag set (is a developer)
    const isAuthenticated =
      (status === 'authenticated' || status === 'signin-authenticated') && user;
    const isDevAuth = globalThis.window?.sessionStorage?.getItem('devAuth') === 'true';

    const target = isAuthenticated && isDevAuth ? '/developers/home' : '/developers/signin';
    router.push(target);
  };

  return (
    <>
      <section className="DevlpHeroSec">
        <div className="Container">
          <div className="DevlpHeroData">
            <div className="LeftDevBanr">
              <div className="devbanrtext">
                <div className="text-display-1 text-text-primary">
                  Build, customise, and launch powerful apps for the animal health ecosystem
                </div>
                <div className="text-body-3 text-text-primary">
                  {' '}
                  Transform animal care with your ideas. Yosemite Crew offers tools and APIs to
                  build custom apps for pet businesses, including AI scribe and voice calls.
                </div>
              </div>
              <div className="DevbanrBtn">
                <Primary
                  href="/developers/signin"
                  onClick={handleDeveloperCTA}
                  text="Developer portal"
                  size="large"
                />
              </div>
            </div>
            <div className="RytDevBanr ">
              <Image
                className="floating"
                src={MEDIA_SOURCES.developerLanding.hero}
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
              <div className="text-display-1 text-text-primary">
                Why developers choose Yosemite Crew
              </div>
            </div>
            <div className="DevYousmiteBoxed">
              <div className="DevCrewBox crewbox1">
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Flexibilty</div>
                  <div className="text-body-3 text-text-primary">
                    Create custom solutions for pet businesses, adapting to any need.
                  </div>
                </div>
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose1}
                  alt="devchose1"
                  width={200}
                  height={140}
                />
              </div>
              <div className="DevCrewBox crewbox2">
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose2}
                  alt="devchose2"
                  width={140}
                  height={140}
                />
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Seamless integrations</div>
                  <div className="text-body-3 text-text-primary">
                    Easily integrate with existing healthcare systems and third-party tools to
                    enhance app functionality.
                  </div>
                </div>
              </div>
              <div className="DevCrewBox crewbox3">
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Open source</div>
                  <div className="text-body-3 text-text-primary">
                    Developer-friendly API pricing based on an open source framework under the GPL
                    V3 license.
                  </div>
                </div>
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose3}
                  alt="devchose3"
                  width={140}
                  height={140}
                />
              </div>
              <div className="DevCrewBox crewbox4">
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose4}
                  alt="devchose4"
                  width={102}
                  height={102}
                />
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Scalability</div>
                  <div className="text-body-3 text-text-primary">
                    Build apps that seamlessly grow as your user base and features expand.
                  </div>
                </div>
              </div>
              <div className="DevCrewBox crewbox5">
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose5}
                  alt="devchose5"
                  width={92}
                  height={92}
                />
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Comprehensive tools</div>
                  <div className="text-body-3 text-text-primary">
                    Access a wide range of APIs, SDKs, and pre-built templates that simplify
                    development.
                  </div>
                </div>
              </div>
              <div className="DevCrewBox crewbox6">
                <div className="crewText">
                  <div className="text-heading-1 text-text-primary">Secure data handling</div>
                  <div className="text-body-3 text-text-primary">
                    Built with industry-leading security protocols, ensuring sensitive healthcare
                    data is always protected.
                  </div>
                </div>
                <Image
                  src={MEDIA_SOURCES.developerLanding.choose6}
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
                <div className="text-display-1 text-text-primary">
                  Everything you need to build and launch
                </div>
              </div>
              <div className="RytResorch">
                <div className="text-body-3 text-text-primary">
                  From robust APIs to intuitive SDKs and customizable templates, Yosemite Crew
                  provides every tool you need to create powerful applications.
                </div>
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
              <div className="text-display-1 text-text-primary">
                Get started in three simple steps
              </div>
              <Primary
                href="/developers/signin"
                onClick={handleDeveloperCTA}
                text="Developer portal"
                size="large"
              />
            </div>
            <div className="RytSimpleStep">
              <div className="Stepitems">
                <Image
                  src={MEDIA_SOURCES.developerLanding.step1}
                  alt="devstep1"
                  width={48}
                  height={114}
                />
                <div className="Stepstext">
                  <div className="text-heading-1 text-text-primary">Sign up</div>
                  <div className="text-body-3 text-text-primary">
                    Create your developer account and access our portal.
                  </div>
                </div>
              </div>
              <div className="Stepitems">
                <Image
                  src={MEDIA_SOURCES.developerLanding.step2}
                  alt="devstep2"
                  width={48}
                  height={114}
                />
                <div className="Stepstext">
                  <div className="text-heading-1 text-text-primary">Explore</div>
                  <div className="text-body-3 text-text-primary">
                    Browse APIs, SDKs, and templates to suit your needs.
                  </div>
                </div>
              </div>
              <div className="Stepitems">
                <Image
                  src={MEDIA_SOURCES.developerLanding.step3}
                  alt="devstep3"
                  width={48}
                  height={48}
                />
                <div className="Stepstext">
                  <div className="text-heading-1 text-text-primary">Build</div>
                  <div className="text-body-3 text-text-primary">
                    Develop, test, and deploy your app seamlessly.
                  </div>
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
                  <h4>Ready to Build?</div>
                  <div className="text-body-3 text-text-primary">
                    {" "}
                    Join a growing community of developers creating
                    transformative solutions for the veterinary world.
                  </div>
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
                src={MEDIA_SOURCES.developerLanding.build}
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
