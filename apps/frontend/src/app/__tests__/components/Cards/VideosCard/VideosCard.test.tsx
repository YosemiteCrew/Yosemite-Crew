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
      screen.getByText('Make the most of your wait, start exploring instead')
    ).toBeInTheDocument();
    expect(screen.getByText('Your first day in the PIMS')).toBeInTheDocument();
    expect(screen.getByText('Run a visit end to end')).toBeInTheDocument();
    expect(screen.getByText('Invoices, deposits and payouts')).toBeInTheDocument();
  });

  it('closes when the close icon is clicked', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getAllByText('close')[0]);
    expect(
      screen.queryByText('Make the most of your wait, start exploring instead')
    ).not.toBeInTheDocument();
  });

  it('keeps the thumbnail overlay visible until the video loads', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByLabelText('Play video: Your first day in the PIMS'));

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
