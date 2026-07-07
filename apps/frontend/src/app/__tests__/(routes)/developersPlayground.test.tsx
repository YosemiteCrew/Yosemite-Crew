import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/features/developers/pages/DeveloperPlayground/DeveloperPlayground', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-playground-page" />,
}));

import PlaygroundPage, { metadata } from '@/app/(routes)/(app)/developers/(portal)/playground/page';
import { devRoutes } from '@/app/constants/routes';

describe('developers playground route', () => {
  test('renders the DeveloperPlayground feature page', () => {
    render(<PlaygroundPage />);
    expect(screen.getByTestId('dev-playground-page')).toBeInTheDocument();
  });

  test('declares a page title', () => {
    expect(metadata.title).toBe('Agent Playground - Yosemite Crew');
  });

  test('is registered in the developer sidebar routes', () => {
    expect(devRoutes).toContainEqual({ name: 'Playground', href: '/developers/playground' });
  });
});
