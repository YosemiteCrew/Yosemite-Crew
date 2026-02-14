"use client";
import React, { useState } from "react";
import { FaCirclePlay } from "react-icons/fa6";

import Close from "@/app/ui/primitives/Icons/Close";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import { Primary } from "@/app/ui/primitives/Buttons";
import { guidesData } from "@/app/features/guides/data/guidesData";

const previewVideos = guidesData.slice(0, 3);
const STORAGE_KEY = "yc_dashboard_videos_hidden";

const VideosCard = () => {
  const [open, setOpen] = useState(() => {
    if (typeof globalThis.window === "undefined") return true;
    return globalThis.localStorage.getItem(STORAGE_KEY) !== "true";
  });
  const [showModal, setShowModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<(typeof previewVideos)[number] | null>(null);

  const handleOpenVideo = (video: (typeof previewVideos)[number]) => {
    setActiveVideo(video);
    setShowModal(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (typeof globalThis.window !== "undefined") {
      globalThis.localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  return (
    open && (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="text-body-1 text-text-primary">
              Make the most of your wait — Start exploring instead.
            </div>
            <div className="flex items-center gap-2">
              <Primary text="View More" href="/guides" classname="px-5! py-2! text-body-4" />
              <Close onClick={handleClose} />
            </div>
          </div>
          <div className="text-body-3 text-text-tertiary">
            Here’s everything you can explore and prepare.
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {previewVideos.map((video) => (
            <button
              type="button"
              className="rounded-2xl! border border-card-border bg-white flex flex-col cursor-pointer text-left"
              key={video.id}
              onClick={() => handleOpenVideo(video)}
              aria-label={`Play video: ${video.title}`}
            >
              <div
                style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
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
            </button>
          ))}
        </div>
        {showModal && (
          <CenterModal
            showModal={showModal}
            setShowModal={setShowModal}
            onClose={() => setShowModal(false)}
            containerClassName="sm:w-[720px] md:w-[860px] lg:w-[980px] max-w-[95vw]"
          >
            <div className="relative flex items-center justify-center">
              <div className="text-body-2 text-text-primary text-center">
                {activeVideo?.title ?? "Video"}
              </div>
              <div className="absolute right-0">
                <Close onClick={() => setShowModal(false)} />
              </div>
            </div>
            <div className="rounded-2xl border border-card-border overflow-hidden">
              {activeVideo ? (
                <video
                  key={activeVideo.videoUrl}
                  className="w-full h-auto"
                  controls
                  preload="metadata"
                >
                  <source src={activeVideo.videoUrl} type="video/mp4" />
                  <track
                    kind="captions"
                    src="data:text/vtt,WEBVTT"
                    srcLang="en"
                    label="English"
                    default
                  />
                </video>
              ) : (
                <div className="w-full aspect-video bg-black/80" />
              )}
            </div>
          </CenterModal>
        )}
      </div>
    )
  );
};

export default VideosCard;
