"use client";
import React from "react";
import Image from "next/image";

import "./TeamSlide.css";

const TeamSlide = () => {
  const teamImages = [
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/harshit.png",
      alt: "Harshit",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/anna.png",
      alt: "Anna",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/ankit.png",
      alt: "Ankit",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/harshvardhan.png",
      alt: "Harshvardhan",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/surbhi.png",
      alt: "Surbhi",
    },

    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/suryansh.png",
      alt: "Suryansh",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/chrissy.png",
      alt: "Chrissy",
    },
  ];

  return (
    <div className="team-slider">
      {teamImages.map((member, index) => (
        <div key={member.src} className="team-slide-item">
          <div className="TeamSlideImg">
            <Image src={member.src} alt={member.alt} width={258} height={311} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeamSlide;
