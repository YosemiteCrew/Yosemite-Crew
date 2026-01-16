"use client";
import React from "react";
import Image from "next/image";

import "./TeamSlide.css";

const TeamSlide = () => {
  const teamImages = [
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/harshit.png",
      alt: "Harshit",
      linkedin: "https://www.linkedin.com/in/harshit-wandhare-a088201aa/",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/anna.png",
      alt: "Anna",
      linkedin: "https://www.linkedin.com/in/annaupadhyay/",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/ankit.png",
      alt: "Ankit",
      linkedin: "https://www.linkedin.com/in/aupyay/",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/harshvardhan.png",
      alt: "Harshvardhan",
      linkedin: "https://www.linkedin.com/in/harshvardhan-parmar/",
    },
    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/surbhi.png",
      alt: "Surbhi",
      linkedin: "https://www.linkedin.com/in/surbhi-sharma-238340259/",
    },

    {
      src: "https://d2il6osz49gpup.cloudfront.net/aboutus-page/suryansh.png",
      alt: "Suryansh",
      linkedin: "https://www.linkedin.com/in/suryansh-sharma-776563226/",
    }
  ];

  return (
    <div className="team-slider">
      {teamImages.map((member) => (
        <div key={member.src} className="team-slide-item">
          <div className="TeamSlideImg">
            <Image src={member.src} alt={member.alt} width={258} height={311} />
            <a
              href={member.linkedin}
              target="_blank"
              rel="noreferrer"
              aria-label={`${member.alt}'s LinkedIn`}
              className="linkedin-badge"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.941v5.665H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.369-1.852 3.602 0 4.268 2.371 4.268 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.777 13.019H3.559V9h3.555v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeamSlide;
