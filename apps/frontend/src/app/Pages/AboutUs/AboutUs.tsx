"use client";
import React from 'react'
import "./AboutUs.css"
import { Container } from 'react-bootstrap'
import Image from 'next/image'
import TeamSlide from '@/app/Components/TeamSlide/TeamSlide'
import Footer from '@/app/Components/Footer/Footer'

function AboutUs() {
  return (
    <>

        {/* AboutHero  */}
        <section className='AboutHeroSec'>
            <Container>
                <div className="AbtHeroData">
                    <div className="abttopHero">
                        <h2>Welcome to <span>Yosemite Crew</span> Where <br /> compassion meets code.</h2>
                        <h4>For Pet Businesses,Pet parents, and Developers who want to shape the future of animal care.</h4>
                    </div>
                    <div className="AbutheroBtm">
                        <h2>About Us</h2>
                        <div className="abtherocard">
                            <div className="AbtCardItem">
                                <div className="head">
                                    <h6>Why Do We exist?</h6>
                                </div>
                                <div className="body">
                                    <p>Because, let’s face it, the veterinary world is chaotic. Juggling appointments, patient records, billing, and communication shouldn’t be a daily struggle. The PMS industry is cluttered, complicated, and outdated. That’s where we come in.</p>
                                </div>
                            </div>

                            <div className="AbtCardItem">
                                <div className="head">
                                    <h6>Our Mission</h6>
                                </div>
                                <div className="body">
                                    <p>Empower the veterinary ecosystem with a platform that actually works.We’ve got your back whether you’re a solo vet, a clinic manager, or a tech-savvy developer ready to build tools that matter.</p>
                                </div>
                            </div>

                            <div className="AbtCardItem">
                                <div className="head">
                                    <h6>Our USP</h6>
                                </div>
                                <div className="body">
                                    <p>We’re not just here to help you book appointments or track patient history. We’re building a multi-verse of smart, connected tools to make your practice run smoother, faster, and better. Think of us as your one-stop solution for the entire veterinary world.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </section>

        {/* Our Story  */}
        <section className='OurStorySec'>
            <Container>
                <div className="StoryData">

                    <Image src="/Images/aboutstory.png" alt="aboutstory" width={605} height={515}/>

                    <div className="storyTexted">
                        <h2>Our Story</h2>
                        <div className="ourstorypara">
                            <h6>Our story began in the field quite literally. Back in the days when our co-founder Ankit was leading animal health projects, one thing became crystal clear: too many systems were driven by money, overloaded with complexity, and lacked real user integration. More work. More confusion. Less clarity.</h6>
                            <h6>So, we asked ourselves : what if we flipped the script? <br /> What if we created something smarter, friendlier, and actually built around the people who use it?</h6>
                            <h6>Yosemite Crew was born from that idea. A digital space where simplicity meets interactivity, where products are easy to use, easy to recognize, and most importantly easy to love. We&apos;ve spent our time deeply understanding user problems so we can solve them, not add to them.</h6>
                            <h6>Why We&apos;re Different <br /> Sure, we’re open source but we’re not just another codebase floating on GitHub.</h6>
                        </div>
                    </div>
                </div>
            </Container>
        </section>

        {/* Teams Section  */}
        <section className='AbtTeamSec'>
            <Container>
                <div className="AbtTeamdata">

                    <div className="AbtTeamHead">
                        <h2><span>We&apos;re not a Company. We&apos;re a</span> Community.</h2>
                        <h4>That means No Gates, No Egos.</h4>
                        <div className="para">
                            <h6>Just a group of humans trying to build better tools together, with the help of people like you. </h6>
                            <h6>We’re a family open, diverse, and always growing.</h6>
                            <h6>And every Community has its crew:</h6>
                        </div> 
                    </div>

                    <TeamSlide/>

                    <div className="AbtTeambtm">
                        <p>Together, we’re here to help our pets and our people. To make</p>
                        <p>technology work for care, not complicate it.</p>
                        <p>Join us. Guide us. Build with us.</p>
                    </div>

                </div>
            </Container>
        </section>

        <Footer/>
      
    </>
  )
}

export default AboutUs
