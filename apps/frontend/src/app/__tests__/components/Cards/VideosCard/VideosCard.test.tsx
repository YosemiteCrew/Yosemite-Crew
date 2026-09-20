import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * The card is driven by a fixture, not by the shipped library.
 *
 * VideosCard takes `guidesData.slice(0, 3)` at module scope, so pinning the
 * real titles made this suite fail every time a film was added ahead of them —
 * which says nothing about the card. What the card owes the reader is: the
 * first three guides, in library order, each opening its own film. That is what
 * these assertions pin. The library itself is guarded by
 * __tests__/features/guides/data/guidesData.test.ts.
 */
/* The fixture lives INSIDE the factory. VideosCard reads `guidesData.slice(0, 3)`
   at module scope, and its import is hoisted above every const in this file, so a
   fixture declared out here is still in its TDZ when the factory runs. */
jest.mock('@/app/features/guides/data/guidesData', () => ({
  __esModule: true,
  guidesData: [
    {
      id: 'first',
      persona: 'Clinic owner',
      title: 'The first guide',
      description: 'first description',
      duration: '0:22',
      category: 'Getting started',
      tags: ['getting started'],
      videoUrl: 'https://cdn.example.test/videos/guides/first.mp4',
      thumbnailUrl: 'https://cdn.example.test/guidePosters/first-poster.png',
    },
    {
      id: 'second',
      persona: 'Front desk',
      title: 'The second guide',
      description: 'second description',
      duration: '0:41',
      category: 'The visit',
      tags: ['the visit'],
      videoUrl: 'https://cdn.example.test/videos/guides/second.mp4',
      thumbnailUrl: 'https://cdn.example.test/guidePosters/second-poster.png',
    },
    {
      id: 'third',
      persona: 'Veterinarian',
      title: 'The third guide',
      description: 'third description',
      duration: '1:05',
      category: 'Money',
      tags: ['money'],
      videoUrl: 'https://cdn.example.test/videos/guides/third.mp4',
      thumbnailUrl: 'https://cdn.example.test/guidePosters/third-poster.png',
    },
    {
      id: 'fourth',
      persona: 'Nurse or technician',
      title: 'The fourth guide',
      description: 'fourth description',
      duration: '0:58',
      category: 'Inventory',
      tags: ['inventory'],
      videoUrl: 'https://cdn.example.test/videos/guides/fourth.mp4',
      thumbnailUrl: 'https://cdn.example.test/guidePosters/fourth-poster.png',
    },
  ],
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

import VideosCard from '@/app/ui/cards/VideosCard/VideosCard';

const { guidesData: mockGuides } = jest.requireMock('@/app/features/guides/data/guidesData');

const HEADING = 'Make the most of your wait, start exploring instead';

describe('VideosCard', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('previews the first three guides and no more', () => {
    render(<VideosCard />);

    expect(screen.getByText(HEADING)).toBeInTheDocument();
    expect(screen.getByText('The first guide')).toBeInTheDocument();
    expect(screen.getByText('The second guide')).toBeInTheDocument();
    expect(screen.getByText('The third guide')).toBeInTheDocument();
    // The fourth is the shelf's job, not the card's — three tiles is the grid.
    expect(screen.queryByText('The fourth guide')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Play video:/ })).toHaveLength(3);
  });

  it('sends the reader to the full library', () => {
    render(<VideosCard />);

    expect(screen.getByRole('link', { name: 'View more' })).toHaveAttribute('href', '/guides');
  });

  it('closes when the close icon is clicked', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getAllByText('close')[0]);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  it('stays closed on the next visit', () => {
    const { unmount } = render(<VideosCard />);
    fireEvent.click(screen.getAllByText('close')[0]);
    unmount();

    render(<VideosCard />);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  it('plays the film belonging to the tile that was clicked', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByLabelText('Play video: The second guide'));

    const video = document.querySelector('video');
    expect(video).toHaveAttribute('poster', mockGuides[1].thumbnailUrl);
    expect(video?.querySelector('source')).toHaveAttribute('src', mockGuides[1].videoUrl);
  });

  it('keeps the thumbnail overlay visible until the video loads', () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByLabelText('Play video: The first guide'));

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
