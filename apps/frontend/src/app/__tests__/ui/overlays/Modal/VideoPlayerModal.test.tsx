import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoPlayerModal from '@/app/ui/overlays/Modal/VideoPlayerModal';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="center-modal">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" data-testid="close-btn" onClick={onClick}>
      close
    </button>
  ),
}));

describe('VideoPlayerModal', () => {
  const activeVideo = {
    title: 'How to onboard',
    videoUrl: 'https://videos.example/how-to.mp4',
    thumbnailUrl: 'https://videos.example/how-to.jpg',
  };

  it('renders a placeholder title when there is no active video', () => {
    render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={null}
        isVideoLoaded={false}
        setIsVideoLoaded={jest.fn()}
      />
    );
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('renders the active video title and a video element', () => {
    render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={activeVideo}
        isVideoLoaded={false}
        setIsVideoLoaded={jest.fn()}
      />
    );
    expect(screen.getByText('How to onboard')).toBeInTheDocument();
    const video = document.querySelector('video')!;
    expect(video).toHaveAttribute('poster', activeVideo.thumbnailUrl);
  });

  it('shows the thumbnail overlay while the video has not loaded yet', () => {
    render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={activeVideo}
        isVideoLoaded={false}
        setIsVideoLoaded={jest.fn()}
      />
    );
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('hides the thumbnail overlay once the video has loaded', () => {
    render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={activeVideo}
        isVideoLoaded
        setIsVideoLoaded={jest.fn()}
      />
    );
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('calls setIsVideoLoaded(true) when the video reports loaded data', () => {
    const setIsVideoLoaded = jest.fn();
    render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={activeVideo}
        isVideoLoaded={false}
        setIsVideoLoaded={setIsVideoLoaded}
      />
    );
    fireEvent.loadedData(document.querySelector('video')!);
    expect(setIsVideoLoaded).toHaveBeenCalledWith(true);
  });

  it('closes the modal and resets loaded state when the close button is clicked', () => {
    const setShowModal = jest.fn();
    const setIsVideoLoaded = jest.fn();
    render(
      <VideoPlayerModal
        showModal
        setShowModal={setShowModal}
        activeVideo={activeVideo}
        isVideoLoaded
        setIsVideoLoaded={setIsVideoLoaded}
      />
    );
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(setIsVideoLoaded).toHaveBeenCalledWith(false);
  });
});
