"use client";
import React from 'react'
import "./TeamSlide.css"
import Slider from 'react-slick';
import Image from 'next/image';


function TeamSlide() {

    const teamImages = [
        { src: "/Images/team1.png", alt: "Surbhi" },
        { src: "/Images/team2.png", alt: "Ankit" },
        { src: "/Images/team3.png", alt: "Panvi" },
        { src: "/Images/team4.png", alt: "Anna" },
        { src: "/Images/team5.png", alt: "Suryansh" },
    ];

    const settings = {
        dots: false,
        infinite: true,
        speed: 500,
        slidesToShow: 5,   
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 2000,
        responsive: [
            { breakpoint: 992, settings: { slidesToShow: 2 } },
            { breakpoint: 576, settings: { slidesToShow: 1 } }
        ]
    };



  return (
    <>
        <div className="team-slider">
            <Slider {...settings}>
                {teamImages.map((member, index) => (
                <div key={index} className="team-slide-item">
                    <div className="TeamSlideImg">
                        <Image src={member.src} alt={member.alt} width={216} height={311}/>
                    </div>
                    
                </div>
                ))}
            </Slider>
        </div>
    </>
  )
}

export default TeamSlide
