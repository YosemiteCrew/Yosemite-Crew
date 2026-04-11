import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideosCard from '@/app/ui/cards/VideosCard/VideosCard';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

describe('VideosCard', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('renders demo video titles', () => {
    render(<VideosCard />);

    expect(
      screen.getByText('Make the most of your wait — Start exploring instead.')
    ).toBeInTheDocument();
    expect(screen.getByText('Invite your team')).toBeInTheDocument();
    expect(screen.getByText('Add companions')).toBeInTheDocument();
    expect(screen.getByText('Build and share forms')).toBeInTheDocument();
  });

  it('closes when the close icon is clicked', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getAllByText('close')[0]);
    expect(
      screen.queryByText('Make the most of your wait — Start exploring instead.')
    ).not.toBeInTheDocument();
  });

  it('keeps the thumbnail overlay visible until the video loads', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByLabelText('Play video: Invite your team'));

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('poster');
    const videoContainer = video?.parentElement;
    expect(videoContainer).toBeInTheDocument();
    expect(videoContainer?.querySelector("[aria-hidden='true']")).toBeInTheDocument();

    fireEvent.loadedData(video!);

    expect(videoContainer?.querySelector("[aria-hidden='true']")).not.toBeInTheDocument();
  });
});
