"use client";
import React, { useState } from "react";
import { FaCirclePlay } from "react-icons/fa6";

import Close from "../../Icons/Close";

const DemoVideos = [
  {
    image: "",
    src: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg",
    title: "Inviting your team",
  },
  {
    image: "",
    src: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg2.jpg",
    title: "How to add companions",
  },
  {
    image: "",
    src: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg3.jpg",
    title: "How to write consultation notes",
  },
];

const VideosCard = () => {
  const [open, setOpen] = useState(true);

  return (
    open && (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0">
          <div className="flex items-center justify-between w-full">
            <div className="text-body-1 text-text-primary">
              Make the most of your wait — Start exploring instead.
            </div>
            <Close onClick={() => setOpen(false)} />
          </div>
          <div className="text-body-3 text-text-tertiary">
            Here’s everything you can explore and prepare.
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DemoVideos.map((video) => (
            <div
              className="rounded-2xl border border-card-border bg-white flex flex-col cursor-pointer"
              key={video.title}
            >
              <div
                style={{ backgroundImage: `url(${video.src})` }}
                className="min-h-[250px] sm:min-h-[350px] md:min-h-[270px] relative bg-no-repeat bg-cover bg-center w-full rounded-t-2xl flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-black/40 rounded-t-2xl"></div>
                <div className="relative">
                  <FaCirclePlay size={50} color="#fff" />
                </div>
              </div>
              <div className="px-3 py-[20px] text-body-2 text-text-primary">
                {video.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  );
};

export default VideosCard;
