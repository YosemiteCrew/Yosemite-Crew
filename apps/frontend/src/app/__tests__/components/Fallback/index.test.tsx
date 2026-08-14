import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import Fallback from '@/app/ui/overlays/Fallback';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: jest.fn() }),
}));

describe('Fallback', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("names the missing resource instead of a bare 'Not authorized' line", () => {
    render(<Fallback resource="billing and subscription" />);

    expect(screen.getByText(/billing and subscription/)).toBeInTheDocument();
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument();
  });

  it("quotes the caller's role so the denial explains itself", () => {
    render(<Fallback resource="documents" />);

    // With no resolvable membership the shared state falls back to a neutral
    // phrase rather than inventing a role.
    expect(screen.getByText(/your current role/)).toBeInTheDocument();
  });

  it('falls back to a generic section label when no resource is given', () => {
    render(<Fallback />);

    expect(screen.getByText(/this section/)).toBeInTheDocument();
  });

  it('offers a route forward rather than a dead end', async () => {
    const user = userEvent.setup();
    render(<Fallback resource="rooms" />);

    const requestAccess = screen.getByRole('button', { name: 'Request access' });
    expect(requestAccess).toBeInTheDocument();

    await user.click(requestAccess);
    expect(push).toHaveBeenCalledWith('/organization');
  });

  it('renders as a status, not an error', () => {
    render(<Fallback resource="rooms" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
