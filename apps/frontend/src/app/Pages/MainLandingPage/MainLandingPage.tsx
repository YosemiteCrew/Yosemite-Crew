"use client"
import React, {useState} from 'react'
import "./MainLandingPage.css"
import { Button, Carousel, Container } from 'react-bootstrap'
import Footer from '@/app/Components/Footer/Footer'
import Image from 'next/image'
import Link from 'next/link'
import { Icon } from "@iconify/react";
import { FillBtn, UnFillBtn } from '../HomePage/HomePage'




// slidesData.ts (or keep inside your component)
  const slidesData = [
    {
      id: 1,
      image: "/Images/landingbg.png",
      alt: "Vet 1",
      text: "Empowering veterinary businesses to grow efficiently.",
    },
    {
      id: 2,
      image: "/Images/landingbg.png",
      alt: "Vet 2",
      text: "Streamlining your workflow for better care.",
    },
    {
      id: 3,
      image: "/Images/landingbg.png",
      alt: "Vet 3",
      text: "Innovative tools for modern veterinary practices.",
    },
  ];





function MainLandingPage() {

  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setIndex(selectedIndex);
  };



  return (
    <>

    <section className='RedefiningSection'>
      <Container>
        <div className="RederfiningData">

          <div className="leftRederfine">

            <div className="RederfineTextInner">
              <h2>Redefining <br /> Veterinary Care</h2>
              <p>Manage everything from appointments to animal records, streamline operations, and improve pet health outcomes—all in one open-source platform designed for veterinarians, pet owners, and developers.</p>
            </div>
            <div className="RederfineInnerBtn">
              <FillBtn icon={<Icon icon="solar:clock-circle-bold" width="24" height="24" />} text=" Book a Demo" href="https://cal.com/yosemitecrew/30min?overlayCalendar=true" />
              <UnFillBtn href="#" icon={<Icon icon="solar:bill-check-bold" width="24" height="24" />}  text="Learn more" />
              
            </div>



          </div>

       

          <div className="RightRederfine">
            <Carousel  activeIndex={index} onSelect={handleSelect} controls={true} indicators={true}  
            interval={3000}  
            nextIcon={
              <span className="custom-arrow">
                <Icon icon="solar:round-alt-arrow-right-outline" width="48" height="48" />
              </span>
              }
            prevIcon={
              <span className="custom-arrow">
                <Icon icon="solar:round-alt-arrow-left-outline" width="48" height="48" />
              </span>
              }
             >
              {slidesData.map((slide) => (
                <Carousel.Item key={slide.id}>
                  <div className="LandingCarouselDiv">
                    <Image src={slide.image} alt={slide.alt} width={887} height={565}/>
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
      <section className='landingSection DarkLightBlueSec'>
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <Button>Best for Veterinary Practices</Button>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>Streamlined Solutions <br /> for Busy Vets</h2>
                  <p>Yosemite Crew helps veterinary practices stay organized, save time, and offer superior care to their clients.</p>
                </div>
                <Link href="/homepage"> <Icon icon="solar:bill-check-bold" width="24" height="24" /> Learn more</Link>
              </div>
            </div>
            <div className="RightLanding">
              <Image aria-hidden src="/Images/vetscreen.png" alt="vetscreen" width={887} height={565} />
            </div>
          </div>
        </Container>
      </section>


    {/* PetOwner Section  */}
      <section className='landingSection DarkBlueSec'>
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <Button>Perfect for Pet Owners</Button>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>Designed for Pet <br /> Owners — Simple, <br /> Intuitive, Reliable</h2>
                  <p>Give pet parents the tools they need to stay on top of their furry friend’s health, all while maintaining smooth communication with their vets.</p>
                </div>
                <Link href="/petowner"> <Icon icon="solar:bill-check-bold" width="24" height="24" /> Learn more</Link>
              </div>
            </div>
            <div className="RightLanding">
              <Image aria-hidden src="/Images/petowner.png" alt="petowner" width={742} height={542} />
            </div>
          </div>
        </Container>
      </section>



    {/* Pricing Section  */}
      <section className='landingSection OpacityBlueSec'>
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <Button>Flexible and Transparent Pricing</Button>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>Pay as You Grow, No <br /> Strings Attached</h2>
                  <p>Choose what works best for you—host it yourself for free or opt for our pay-as-you-go model. With no hidden fees or long-term commitments, Yosemite Crew puts you in control.</p>
                </div>
                <Link href="/pricing"> <Icon icon="solar:bill-check-bold" width="24" height="24" /> Learn more</Link>
              </div>
            </div>
            <div className="RightLanding">
              <Image aria-hidden src="/Images/pricing.png" alt="pricing" width={884} height={600} />
            </div>
          </div>
        </Container>
      </section>



    {/* Developer Section  */}
      <section className='landingSection'>
        <Container>
          <div className="LandingData">
            <div className="LeftLanding">
              <div className="landingTop">
                <Button>Developer-Friendly Platform</Button>
              </div>
              <div className="landingTexed">
                <div className="landinginnerTexed">
                  <h2>Built for Innovators</h2>
                  <p>Yosemite Crew isn’t just for end-users—it’s a robust platform for developers to create, customize, and innovate new veterinary solutions.</p>
                </div>
                <Link href="#"> <Icon icon="solar:bill-check-bold" width="24" height="24" /> Learn more</Link>
              </div>
            </div>
            <div className="RightLanding">
              <Image aria-hidden src="/Images/developer.png" alt="developer" width={884} height={600} />
            </div>
          </div>
        </Container>
      </section>






      <Footer/>
    </>
  )
}

export default MainLandingPage