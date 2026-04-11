'use client';
import React, { useState } from 'react';
import { FaCirclePlay } from 'react-icons/fa6';

import Close from '@/app/ui/primitives/Icons/Close';
import { Primary } from '@/app/ui/primitives/Buttons';
import VideoPlayerModal from '@/app/ui/overlays/Modal/VideoPlayerModal';
import { guidesData } from '@/app/features/guides/data/guidesData';

const previewVideos = guidesData.slice(0, 3);
const STORAGE_KEY = 'yc_dashboard_videos_hidden';

const VideosCard = () => {
  const [open, setOpen] = useState(() => {
    if (globalThis.window === undefined) return true;
    return globalThis.localStorage.getItem(STORAGE_KEY) !== 'true';
  });
  const [showModal, setShowModal] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [activeVideo, setActiveVideo] = useState<(typeof previewVideos)[number] | null>(null);

  const handleOpenVideo = (video: (typeof previewVideos)[number]) => {
    setActiveVideo(video);
    setIsVideoLoaded(false);
    setShowModal(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (globalThis.window !== undefined) {
      globalThis.localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  if (!open) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="text-body-1 text-text-primary">
            Make the most of your wait — Start exploring instead.
          </div>
          <div className="flex items-center gap-2">
            <Primary text="View More" href="/guides" className="px-5! py-2! text-body-4" />
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
              className="min-h-[200px] sm:min-h-[240px] md:min-h-[190px] relative bg-no-repeat bg-cover bg-center w-full rounded-t-2xl flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/40 rounded-t-2xl"></div>
              <div className="relative">
                <FaCirclePlay size={50} color="#fff" />
              </div>
            </div>
            <div className="px-3 py-[20px] text-body-2 text-text-primary">{video.title}</div>
          </button>
        ))}
      </div>
      <VideoPlayerModal
        showModal={showModal}
        setShowModal={setShowModal}
        activeVideo={activeVideo}
        isVideoLoaded={isVideoLoaded}
        setIsVideoLoaded={setIsVideoLoaded}
      />
    </div>
  );
};

export default VideosCard;
