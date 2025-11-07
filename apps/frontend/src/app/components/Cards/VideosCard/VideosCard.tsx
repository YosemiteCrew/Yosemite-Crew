"use client";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { FaCirclePlay } from "react-icons/fa6";

import "./VideosCard.css";

const DemoVideos = [
  {
    image: "",
    src: "",
    title: "Inviting your team",
  },
  {
    image: "",
    src: "",
    title: "How to add companions",
  },
  {
    image: "",
    src: "",
    title: "How to write consultation notes",
  },
];

const VideosCard = () => {
  const [open, setOpen] = useState(true);

  return (
    open && (
      <div className="video-container">
        <div className="video-header">
          <div className="video-title">
            Make the most of your wait — Start exploring instead.
          </div>
          <IoIosCloseCircleOutline
            color="#000"
            size={28}
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="video-desc">
          Here’s everything you can explore and prepare.
        </div>
        <div className="video-list">
          {DemoVideos.map((video) => (
            <div className="video-item" key={video.title}>
              <div className="video-play">
                <FaCirclePlay size={50} color="#fff" />
              </div>
              <div className="video-text">{video.title}</div>
            </div>
          ))}
        </div>
      </div>
    )
  );
};

export default VideosCard;
