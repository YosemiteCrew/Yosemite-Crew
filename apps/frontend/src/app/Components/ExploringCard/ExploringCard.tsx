// components/ExploreSection.tsx
"use client";
import { useEffect } from "react";
import "./ExploringCard.css"
import Image from "next/image";
import GLightbox from "glightbox";
import "glightbox/dist/css/glightbox.css";
import Link from "next/link";

type CardData = {
  id: number;
  thumbnail: string;
  videoUrl: string;
  title: string;
}

const cards: CardData[] = [
  { id: 1, thumbnail: "/images/Explr1.jpg", videoUrl: "https://www.youtube.com/watch?v=Y7f98aduVJ8", title: "How the Platform Works?" },
  { id: 2, thumbnail: "/images/Explr2.jpg", videoUrl: "https://www.youtube.com/watch?v=ABC123XYZ", title: "Inviting your team" },
  { id: 3, thumbnail: "/images/Explr3.jpg", videoUrl: "https://www.youtube.com/watch?v=DEF456UVW", title: "Accepting appointments" },
  { id: 4, thumbnail: "/images/Explr4.jpg", videoUrl: "https://www.youtube.com/watch?v=GHI789RST", title: "How to see revenue reporting?" },
];



type ExploreSectionProps ={
  Headtitle: string;
  Headpara: string;
  Headtitlespan: string;
}
export default function ExploreSection({Headtitle,Headpara , Headtitlespan}: ExploreSectionProps) {
  useEffect(() => {
    const lightbox = GLightbox({ selector: ".glightbox-video", autoplayVideos: true });
    lightbox.reload();
    return () => lightbox.destroy();
  }, [cards.length]);

  return (
    <div className="Exploring-Data">

        <div className="ExplrHeading">

            <h4>{Headtitle} <span>{Headtitlespan}</span></h4>
            <p>{Headpara}</p>
        </div>
        <div className="Explore-Card-Div">
            {cards.map(c => (
            <div className="explr-card-item" key={c.id}>
                <div className="exp-img" style={{ position: "relative" }}>
                    <Image src={c.thumbnail} alt={c.title} width={305} height={188} />
                    <Link href={c.videoUrl}  className="glightbox-video pulsating-play-btn"data-type="video" aria-label={`Play ${c.title}`}/>
                </div>
                <div className="exp-text">
                    <h5>{c.title}</h5>
                </div>
            </div>
            ))}
        </div>
    </div>
  );
}
