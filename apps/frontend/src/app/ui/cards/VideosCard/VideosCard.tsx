'use client';
import React, { useState } from 'react';
import { IoPlayCircle } from 'react-icons/io5';

import Close from '@/app/ui/primitives/Icons/Close';
import { Primary } from '@/app/ui/primitives/Buttons';
import VideoPlayerModal from '@/app/ui/overlays/Modal/VideoPlayerModal';
import { guidesData } from '@/app/features/guides/data/guidesData';
import { getStorageItem, setStorageItem } from '@/app/lib/browserStorage';

import './VideosCard.css';

const previewVideos = guidesData.slice(0, 3);
const STORAGE_KEY = 'yc_dashboard_videos_hidden';

const VideosCard = () => {
  const [open, setOpen] = useState(() => {
    return getStorageItem('local', STORAGE_KEY) !== 'true';
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
    setStorageItem('local', STORAGE_KEY, 'true');
  };

  if (!open) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0">
        {/* The heading is the flexible half: it wraps. The actions must not -
            without min-w-0 + shrink-0 the heading squeezes the button until
            "View more" breaks across two lines on a phone. */}
        <div className="flex items-center justify-between w-full gap-3">
          <div className="min-w-0 text-body-1 text-text-primary">
            {'Make the most of your wait, start exploring instead'}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Primary
              text="View more"
              href="/guides"
              className="min-h-9! h-9! px-[18px]! py-0! text-[12.5px] font-semibold whitespace-nowrap"
            />
            <Close onClick={handleClose} />
          </div>
        </div>
        <div className="videos-card-subtitle">Here’s everything you can explore and prepare.</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {previewVideos.map((video) => (
          <button
            type="button"
            className="videos-card-tile border border-card-border bg-neutral-0 flex flex-col cursor-pointer text-left overflow-hidden"
            key={video.id}
            onClick={() => handleOpenVideo(video)}
            aria-label={`Play video: ${video.title}`}
          >
            <div
              style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
              className="min-h-[200px] sm:min-h-[240px] md:min-h-[190px] relative bg-no-repeat bg-cover bg-center w-full flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="relative">
                <IoPlayCircle size={50} color="var(--color-neutral-0)" />
              </div>
            </div>
            <div className="videos-card-caption">{video.title}</div>
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
