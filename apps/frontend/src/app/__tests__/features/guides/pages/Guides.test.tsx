import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedGuides from '@/app/features/guides/pages/Guides';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" aria-label="Close" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Search', () => ({
  __esModule: true,
  default: ({ value, setSearch, placeholder }: any) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
    />
  ),
}));

describe('Guides page', () => {
  it('renders guide list and featured section', () => {
    render(<ProtectedGuides />);

    expect(screen.getByText(/Guides & Tutorials/i)).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getAllByText('Invite your team').length).toBeGreaterThan(0);
    expect(screen.getByText('Add companions')).toBeInTheDocument();
  });

  it('filters by category and search text', () => {
    render(<ProtectedGuides />);

    fireEvent.click(screen.getByRole('button', { name: 'Companions' }));
    expect(screen.getByText('1 results')).toBeInTheDocument();
    expect(screen.getByText('Add companions')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search guides'), { target: { value: 'forms' } });
    expect(screen.getByText('0 results')).toBeInTheDocument();
  });

  it('opens modal from watch now and closes it', () => {
    render(<ProtectedGuides />);

    fireEvent.click(screen.getByText('Watch now'));
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getAllByText('Invite your team').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });
});
