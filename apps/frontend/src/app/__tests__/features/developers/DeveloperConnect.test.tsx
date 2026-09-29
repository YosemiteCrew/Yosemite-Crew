import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateKeyForm from '@/app/features/developers/pages/DeveloperApiKeys/CreateKeyForm';

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

import DeveloperConnect from '@/app/features/developers/pages/DeveloperConnect/DeveloperConnect';

describe('DeveloperConnect', () => {
  it('guides a developer from access creation to a first test call', () => {
    render(<DeveloperConnect />);

    expect(screen.getByRole('heading', { name: 'Connect a coding tool' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create a test key/ })).toHaveAttribute(
      'href',
      '/developers/api-keys?setup=appointment-test'
    );

    fireEvent.click(screen.getByRole('button', { name: 'I have a key' }));
    expect(screen.getByText(/your agent configuration/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open connection setup/ })).toHaveAttribute(
      'href',
      '/developers/playground?operation=listAppointments&export=mcp'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connection added' }));
    expect(screen.getByText(/List the practices available to me/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Practice chosen' }));
    expect(screen.getByRole('link', { name: /Verify in API playground/ })).toHaveAttribute(
      'href',
      '/developers/playground?operation=listAppointments&export=mcp'
    );
  });

  it('opens key creation with the guided test setup', () => {
    render(<DeveloperConnect />);

    expect(screen.getByRole('link', { name: 'Create a test key' })).toHaveAttribute(
      'href',
      '/developers/api-keys?setup=appointment-test'
    );
    expect(
      screen.getByText(/form opens with the settings needed for this call/)
    ).toBeInTheDocument();
  });

  it('adapts the setup guidance to the selected tool', () => {
    render(<DeveloperConnect />);

    fireEvent.click(screen.getByRole('button', { name: /Desktop assistant/ }));
    expect(screen.getByText(/the desktop connection settings/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Editor extension/ }));
    expect(screen.getByRole('button', { name: /Editor extension/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText(/the extension connection settings/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Another MCP client/ }));
    expect(screen.getByText(/your client MCP settings/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Terminal agent/ }));
    expect(screen.getByText(/your agent configuration/)).toBeInTheDocument();
  });

  it('lets a developer revisit every journey step', () => {
    render(<DeveloperConnect />);

    fireEvent.click(screen.getByRole('button', { name: /Add Yosemite Crew to your tool/ }));
    expect(screen.getByRole('link', { name: /Open connection setup/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Choose a practice/ }));
    expect(screen.getByText(/List the practices available to me/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Make a first test call/ }));
    expect(screen.getByText(/List the upcoming appointments/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm sign-in and create access/ }));
    expect(screen.getByRole('link', { name: /Create a test key/ })).toBeInTheDocument();
  });
});

describe('CreateKeyForm', () => {
  it('initializes the scopes text only on the first render', () => {
    const initialScopes = ['appointments:read'];
    const join = jest.spyOn(initialScopes, 'join');
    const props = {
      creating: false,
      onCreate: jest.fn(),
      onCancel: jest.fn(),
      initialScopes,
    };
    const { rerender } = render(<CreateKeyForm {...props} />);

    expect(screen.getByLabelText('Scopes (optional, comma-separated)')).toHaveValue(
      'appointments:read'
    );
    rerender(<CreateKeyForm {...props} />);

    expect(join).toHaveBeenCalledTimes(1);
  });
});
