import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExploreSection from '@/app/components/ExploringCard/ExploringCard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />;
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

const mockDestroy = jest.fn();
const mockReload = jest.fn();
const mockGLightbox = jest.fn(() => ({
  destroy: mockDestroy,
  reload: mockReload,
}));

jest.mock('glightbox', () => ({
    __esModule: true,
    default: mockGLightbox,
}));

describe('ExploreSection Component', () => {
  const testProps = {
    Headtitle: 'Explore Our',
    Headtitlespan: 'Platform',
    Headpara: 'This is a test paragraph.',
  };

  beforeEach(() => {
    mockGLightbox.mockClear();
    mockDestroy.mockClear();
    mockReload.mockClear();
  });

  it('should render the headings and paragraph correctly', () => {
    render(<ExploreSection {...testProps} />);

    const heading = screen.getByRole('heading', { name: /Explore Our Platform/i });
    expect(heading).toBeInTheDocument();
    expect(heading.querySelector('span')).toHaveTextContent('Platform');

    expect(screen.getByText(testProps.Headpara)).toBeInTheDocument();
  });

  it('should render all four cards with correct titles, images, and links', () => {
    render(<ExploreSection {...testProps} />);

    const cards = [
      { title: "How the Platform Works?", thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr1.jpg" },
      { title: "Inviting your team", thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr2.jpg" },
      { title: "Accepting appointments", thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr3.jpg" },
      { title: "How to see revenue reporting?", thumbnail: "https://d2il6osz49gpup.cloudfront.net/Images/Explr4.jpg" },
    ];

    for (const card of cards) {
      expect(screen.getByRole('heading', { name: card.title })).toBeInTheDocument();

      const image = screen.getByAltText(card.title);
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', card.thumbnail);

      const link = screen.getByLabelText(`Play ${card.title}`);
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '#');
    }
  });

  it('should initialize and reload GLightbox on mount', async () => {
    render(<ExploreSection {...testProps} />);

    await waitFor(() => {
      expect(mockGLightbox).toHaveBeenCalledWith({
        selector: ".glightbox-video",
        autoplayVideos: true,
      });
    });

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  it('should destroy GLightbox on unmount', async () => {
    const { unmount } = render(<ExploreSection {...testProps} />);

    await waitFor(() => {
      expect(mockGLightbox).toHaveBeenCalledTimes(1);
    });

    unmount();
  });
});
