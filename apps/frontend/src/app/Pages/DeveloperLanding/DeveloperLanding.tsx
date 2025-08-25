"use client";
import React from 'react'
import "./DeveloperLanding.css"
import { Container } from 'react-bootstrap'
import { FillBtn, UnFillBtn } from '../HomePage/HomePage'
import { Icon } from '@iconify/react/dist/iconify.js'
import Image from 'next/image'
import LaunchGrowTab from '@/app/Components/LaunchGrowTab/LaunchGrowTab'
import Footer from '@/app/Components/Footer/Footer';

function DeveloperLanding() {
  return (
    <>

        <section className="DevlpHeroSec">
            <Container>
                <div className="DevlpHeroData">
                    <div className="LeftDevBanr">
                        <div className="devbanrtext">
                            <h2>Build, customize, and launch powerful apps for the veterinary ecosystem</h2>
                            <p> Transform pet healthcare with your ideas. Yosemite Crew provides you with the tools, APIs, and flexibility to create custom applications tailored to veterinary needs.</p>
                        </div>
                        <div className="DevbanrBtn">
                            <FillBtn icon={<Icon icon="solar:settings-minimalistic-bold" width="20" height="20" />} text="Explore Dev Tools" href="" />
                            <UnFillBtn href="#" icon={<Icon icon="solar:bill-check-bold" width="24" height="24" />}  text="Learn more" />
                        </div>
                    </div>
                    <div className="RytDevBanr ">
                        <Image className='floating' src="/Images/devlogin.png" alt="devlogin"  width={694}  height={560} />
                    </div>
                </div>
            </Container>
        </section>

        <section className="DevlYousmiteSec">
            <Container>
                <div className="YousmiteCrew">
                    <p>Why Yosemite Crew?</p>
                    <h4>Why Developers Choose Yosemite Crew</h4>
                </div>
                <div className="DevYousmiteBoxed" >
                    <div className="DevCrewBox crewbox1">
                    <div className="crewText">
                        <h3>Flexibilty</h3>
                        <p>
                        Create custom solutions for both pet owners and vet
                        businesses, adapting to any need.
                        </p>
                    </div>
                    <Image src="/Images/devchose1.png" alt="devchose1"  width={154}  height={132} />
                    </div>
                    <div className="DevCrewBox crewbox2">
                        <Image src="/Images/devchose2.png" alt="devchose2"  width={120}  height={120} />
                    <div className="crewText">
                        <h3>Seamless Integrations</h3>
                        <p>
                        Easily integrate with existing healthcare systems and
                        third-party tools to enhance app functionality.
                        </p>
                    </div>
                    </div>
                    <div className="DevCrewBox crewbox3">
                    <div className="crewText">
                        <h3>Open Source</h3>
                        <p>
                        Choose between self-hosting or a flexible pay-as-you-go option
                        without long-term commitments.
                        </p>
                    </div>
                    <Image src="/Images/devchose3.png" alt="devchose3"  width={184}  height={184} />
                    </div>
                    <div className="DevCrewBox crewbox4">
                        <Image src="/Images/devchose4.png" alt="devchose4"  width={102}  height={102} />
                    <div className="crewText">
                        <h3>Scalability</h3>
                        <p>
                        Build apps that seamlessly grow as your user base and features
                        expand.
                        </p>
                    </div>
                    </div>
                    <div className="DevCrewBox crewbox5">
                        <Image src="/Images/devchose5.png" alt="devchose5"  width={72}  height={72} />
                    <div className="crewText">
                        <h3>Comprehensive Tools</h3>
                        <p>
                        Access a wide range of APIs, SDKs, and pre-built templates
                        that simplify development.
                        </p>
                    </div>
                    </div>
                    <div className="DevCrewBox crewbox6">
                    <div className="crewText">
                        <h3>Secure Data Handling</h3>
                        <p>
                        Built with industry-leading security protocols, ensuring
                        sensitive pet healthcare data is always protected.
                        </p>
                    </div>
                    <Image src="/Images/devchose6.png" alt="devchose6"  width={129}  height={129} />
                    </div>
                </div>
            </Container>
        </section>

        <section className="DevlpToolSec">
            <Container>
                <div className="DevlpToolData">
                    <div className="TopResorchTool">
                        <div className="leftResorch">
                            <p>Developer Tools and Resources</p>
                            <h2>Everything You Need to Build and Launch</h2>
                        </div>
                        <div className="RytResorch">
                            <p>From robust APIs to intuitive SDKs and customizable templates,
                                Yosemite Crew provides every tool you need to create powerful
                                veterinary applications.</p>
                        </div>
                    </div>

                    <div className="BottomResorchTool">
                        <LaunchGrowTab/>
                    </div>
                </div>
            </Container>
        </section>

        <section className="SimpleStepSec">
            <Container>
                <div className="StepsData">
                    <div className="leftSimpleStep">
                        <p>How it works</p>
                        <h2>Get Started in Three Simple Steps</h2>
                        <FillBtn icon={<Icon icon="solar:bill-check-bold" width="20" height="20" />} text="Sign up to Build" href="#" />
                    </div>
                    <div className="RytSimpleStep">
                        <div className="Stepitems">
                            <Image src="/Images/devstep1.png" alt="devstep1"  width={48}  height={164} />
                            <div className="Stepstext">
                                <h4>Sign up</h4>
                                <p>Create your developer account and access our portal.</p>
                            </div>
                        </div>
                        <div className="Stepitems">
                            <Image src="/Images/devstep2.png" alt="devstep2"  width={48}  height={164} />
                            <div className="Stepstext">
                                <h4>Explore</h4>
                                <p>Browse APIs, SDKs, and templates to suit your needs.</p>
                            </div>
                        </div>
                        <div className="Stepitems">
                            <Image src="/Images/devstep3.png" alt="devstep3"  width={48}  height={48} />
                            <div className="Stepstext">
                                <h4>Build</h4>
                                <p>Develop, test, and deploy your app seamlessly.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </section>

        <section className="DevlpPricingSec">
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
                    <div className="DevPricBox" >
                        <div className="devpboxtext">
                            <h4>Free Option</h4>
                            <p>Self-host your applications at no cost.</p>
                        </div>
                    </div>
                    <div className="DevPricBox" >
                        <div className="devpboxtext">
                            <h4>No Lock-In</h4>
                            <p>Switch between self-hosted and managed options anytime.</p>
                        </div>
                    </div>
                </div>
            </Container>
        </section>
            
        <section className="DevlpBuildSec">
            <Container>
                <div className="ReadyBuildData" >
                    <div className="leftBuild">
                        <div className="leftBuilinner">
                            <div className="texted">
                                <h4>Ready to Build?</h4>
                                <p> Join a growing community of developers creating transformative solutions for the veterinary world.</p>
                            </div>
                        </div>
                    </div>
                    <div className="RytBuild">
                        <Image src={`${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/Devlperlanding/devlpbuild.png`} alt="devlpbuild"  width={507}  height={433} />
                    </div>
                </div>
            </Container>
        </section>

        <Footer/>


    </>
  )
}

export default DeveloperLanding
