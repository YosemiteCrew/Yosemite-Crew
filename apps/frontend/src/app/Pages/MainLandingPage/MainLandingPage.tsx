"use client"
import React from 'react'
import "./MainLandingPage.css"
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Button, Container } from 'react-bootstrap'
import Footer from '@/app/Components/Footer/Footer'
import { FaClock } from 'react-icons/fa6'
import Slider from "react-slick"
import Image from 'next/image'

// Section data
type SectionButton = {
  label: string;
  variant: string;
  icon?: React.ReactNode;
};

const sections: {
  left: {
    badge?: string;
    title: string;
    desc: string;
    btns: SectionButton[];
  };
  slides: { img: string; caption: string }[];
}[] = [
  {
    left: {
      title: "Redefining Veterinary Care",
      desc: "Manage everything from appointments to animal records, streamline operations, and improve pet health outcomes—all in one open-source platform designed for veterinarians, pet owners, and developers.",
      btns: [
        { label: "Book a Demo", icon: <FaClock />, variant: "primary" },
        { label: "Learn More", variant: "secondary" }
      ]
    },
    slides: [
      {
        img: "/Images/Explr3.jpg",
        caption: "Empowering veterinary businesses to grow efficiently."
      }
    ]
  },
  {
    left: {
      badge: "For Veterinary Practices",
      title: "Streamlined Solutions for Busy Vets",
      desc: "Modern dashboards, analytics, and tools to help you run your clinic efficiently.",
      btns: [
        { label: "Learn More", variant: "primary" }
      ]
    },
    slides: [
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      }
    ]
  },
  {
    left: {
      badge: "Product for Pet Owners",
      title: "Designed for Pet Owners — Simple, Intuitive, Reliable",
      desc: "Mobile-first experience for pet owners to manage appointments, records, and communication.",
      btns: [
        { label: "Learn More", variant: "primary" }
      ]
    },
    slides: [
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      },
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      },
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      }
    ]
  },
  {
    left: {
      badge: "Practices & Transparent Pricing",
      title: "Pay as You Grow, No Strings Attached",
      desc: "Flexible pricing calculator for every stage of your business.",
      btns: [
        { label: "Learn More", variant: "primary" }
      ]
    },
    slides: [
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      }
    ]
  },
  {
    left: {
      badge: "Developer Platform",
      title: "Built for Innovators",
      desc: "Open APIs and integrations to help you build custom solutions for your practice.",
      btns: [
        { label: "Learn More", variant: "primary" }
      ]
    },
    slides: [
      {
        img: "/Images/Explr3.jpg",
        caption: ""
      }
    ]
  }
];

const sliderSettings = {
  dots: false,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  arrows: true,
  adaptiveHeight: true,
};

function MainLandingPage() {
  return (
    <>
      {sections.map((section, idx) => (
        <section
          className={`VeterinarycareSec section-${idx} ${idx % 2 === 1 ? "section-alt" : ""}`}
          key={idx}
          style={idx > 0 ? { background: idx % 2 === 1 ? "#f7fafd" : "#fff" } : {}}
        >
          <Container>
            <div className="VeterinaryData">
              <div className="leftVetery">
                {section.left.badge && (
                  <div className="section-badge">{section.left.badge}</div>
                )}
                <div className="vetTexed">
                  <h2>{section.left.title}</h2>
                  <p>{section.left.desc}</p>
                </div>
                <div className="vetbtn">
                  {section.left.btns.map((btn, bidx) => (
                    <Button
                      key={bidx}
                      variant={btn.variant === "secondary" ? "outline-dark" : "dark"}
                      className={btn.variant === "secondary" ? "secondary-btn" : ""}
                    >
                      {btn.icon && <span style={{ marginRight: 8 }}>{btn.icon}</span>}
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="RightVetery">
                <div style={{ width: "100%", minWidth: 320, maxWidth: 540 }}>
                  <Slider {...sliderSettings}>
                    {section.slides.map((slide, sidx) => (
                      <div key={sidx} className="slider-slide">
                        <div
                          style={{
                            background: "#fff",
                            borderRadius: 24,
                            boxShadow: "0 4px 32px #0001",
                            padding: 0,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <Image
                            src={slide.img}
                            alt={slide.caption || `Slide ${sidx + 1}`}
                            className="slider-img"
                            width={540}
                            height={340}
                            style={{
                              width: "100%",
                              maxWidth: 540,
                              height: 340,
                              objectFit: "cover",
                              borderRadius: "24px 24px 0 0",
                              boxShadow: "none",
                            }}
                            priority={idx === 0 && sidx === 0}
                          />
                          {slide.caption && (
                            <div
                              className="slider-caption"
                              style={{
                                width: "100%",
                                padding: "18px 24px 18px 24px",
                                fontWeight: 500,
                                fontSize: "1.15rem",
                                color: "#222",
                                fontFamily: "var(--satoshi-font, Arial, sans-serif)",
                                textAlign: "center",
                                borderRadius: "0 0 24px 24px",
                                background: "#fff",
                              }}
                            >
                              {slide.caption}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </Slider>
                </div>
              </div>
            </div>
          </Container>
        </section>
      ))}
      <Footer/>
    </>
  )
}

export default MainLandingPage