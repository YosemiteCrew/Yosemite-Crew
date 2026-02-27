import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeamSlide from '@/app/ui/widgets/TeamSlide/TeamSlide';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

jest.mock('next/image', () => {
  const MockImage = (props: any) => {
    return <img {...props} alt={props.alt} />;
  };
  MockImage.displayName = 'MockNextImage';
  return {
    __esModule: true,
    default: MockImage,
  };
});

describe('TeamSlide Component', () => {
  it('should render all team member images with correct alt text', () => {
    render(<TeamSlide />);

    const teamMembers = ['Surbhi', 'Ankit', 'Harshvardhan', 'Anna', 'Suryansh'];

    for (const name of teamMembers) {
      const image = screen.getByAltText(name);
      expect(image).toBeInTheDocument();
    }
  });

  it('should have the correct image sources', () => {
    render(<TeamSlide />);

    const surbhiImage = screen.getByAltText('Surbhi');
    expect(surbhiImage).toHaveAttribute('src', MEDIA_SOURCES.team.surbhi);

    const ankitImage = screen.getByAltText('Ankit');
    expect(ankitImage).toHaveAttribute('src', MEDIA_SOURCES.team.ankit);
  });
});
