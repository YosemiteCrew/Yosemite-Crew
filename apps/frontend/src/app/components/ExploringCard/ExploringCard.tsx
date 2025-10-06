"use client";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import "glightbox/dist/css/glightbox.css";

import "./ExploringCard.css";

type CardData = {
  id: number;
  thumbnail: string;
  videoUrl: string;
  title: string;
};

const cards: CardData[] = [
  {
    id: 1,
    thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr1.jpg",
    videoUrl: "#",
    title: "How the Platform Works?",
  },
  {
    id: 2,
    thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr2.jpg",
    videoUrl: "#",
    title: "Inviting your team",
  },
  {
    id: 3,
    thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr3.jpg",
    videoUrl: "#",
    title: "Accepting appointments",
  },
  {
    id: 4,
    thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr4.jpg",
    videoUrl: "#",
    title: "How to see revenue reporting?",
  },
];

type ExploreSectionProps = {
  Headtitle: string;
  Headpara: string;
  Headtitlespan: string;
};

const ExploreSection = ({
  Headtitle,
  Headpara,
  Headtitlespan,
}: Readonly<ExploreSectionProps>) => {
  useEffect(() => {
    const loadLightbox = async () => {
      const GLightbox = (await import("glightbox")).default;
      await import("glightbox/dist/css/glightbox.css" as any);
      const lightbox = GLightbox({
        selector: ".glightbox-video",
        autoplayVideos: true,
      });
      lightbox.reload();
      return () => {
        lightbox.destroy();
      };
    };
    loadLightbox();
  }, []);

  return (
    <div className="Exploring-Data">
      <div className="ExplrHeading">
        <h4>
          {Headtitle} <span>{Headtitlespan}</span>
        </h4>
        <p>{Headpara}</p>
      </div>
      <div className="Explore-Card-Div">
        {cards.map((c) => (
          <div className="explr-card-item" key={c.id}>
            <div className="exp-img" style={{ position: "relative" }}>
              <Image src={c.thumbnail} alt={c.title} width={305} height={188} />
              <Link
                href={c.videoUrl}
                className="glightbox-video pulsating-play-btn"
                data-type="video"
                aria-label={`Play ${c.title}`}
              />
            </div>
            <div className="exp-text">
              <h5>{c.title}</h5>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExploreSection;
