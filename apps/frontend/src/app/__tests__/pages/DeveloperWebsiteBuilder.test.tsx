import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid={`primary-${text}`}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/icons/Icon', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

import DeveloperWebsiteBuilder from '@/app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder';

describe('DeveloperWebsiteBuilder page', () => {
  test('renders the header, preview note and open builder action', () => {
    render(<DeveloperWebsiteBuilder />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Website builder' })).toBeInTheDocument();
    expect(screen.getByText(/the website builder is coming soon/i)).toBeInTheDocument();
    expect(screen.getByTestId('primary-Open builder')).toBeInTheDocument();
  });

  test('renders the sample templates', () => {
    render(<DeveloperWebsiteBuilder />);
    expect(screen.getByRole('heading', { name: 'Alpine Clinic' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'City Vets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equine Estate' })).toBeInTheDocument();
    expect(screen.getAllByText('Use template').length).toBe(3);
  });

  test('has no axe violations', async () => {
    const { container } = render(<DeveloperWebsiteBuilder />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
