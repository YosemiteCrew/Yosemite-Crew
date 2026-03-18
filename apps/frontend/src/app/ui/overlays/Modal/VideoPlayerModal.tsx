import React from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import Close from '@/app/ui/primitives/Icons/Close';

type VideoItem = {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
};

type VideoPlayerModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeVideo: VideoItem | null;
  isVideoLoaded: boolean;
  setIsVideoLoaded: React.Dispatch<React.SetStateAction<boolean>>;
};

const VideoPlayerModal = ({
  showModal,
  setShowModal,
  activeVideo,
  isVideoLoaded,
  setIsVideoLoaded,
}: VideoPlayerModalProps) => {
  const handleClose = () => {
    setShowModal(false);
    setIsVideoLoaded(false);
  };

  return (
    <CenterModal
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={handleClose}
      containerClassName="sm:w-[720px] md:w-[860px] lg:w-[980px] max-w-[95vw]"
    >
      <div className="relative flex items-center justify-center">
        <div className="text-body-2 text-text-primary text-center">
          {activeVideo?.title ?? 'Video'}
        </div>
        <div className="absolute right-0">
          <Close onClick={handleClose} />
        </div>
      </div>
      <div className="relative rounded-2xl border border-card-border overflow-hidden">
        {activeVideo ? (
          <video
            key={activeVideo.videoUrl}
            className="w-full h-auto"
            controls
            preload="metadata"
            poster={activeVideo.thumbnailUrl}
            onLoadedData={() => setIsVideoLoaded(true)}
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
        {activeVideo && !isVideoLoaded && (
          <div
            className="absolute inset-0 bg-no-repeat bg-cover bg-center"
            style={{ backgroundImage: `url(${activeVideo.thumbnailUrl})` }}
            aria-hidden="true"
          />
        )}
      </div>
    </CenterModal>
  );
};

export default VideoPlayerModal;
