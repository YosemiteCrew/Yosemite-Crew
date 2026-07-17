import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppearancePreference from '@/app/features/settings/pages/Settings/Sections/AppearancePreference';

const setAppearance = jest.fn();
const useThemeMock = jest.fn();

jest.mock('@/app/ui/theme', () => ({
  useTheme: () => useThemeMock(),
}));

describe('AppearancePreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useThemeMock.mockReturnValue({ appearance: 'auto', setAppearance });
  });

  it('renders the three appearance options with the stored value active', () => {
    render(<AppearancePreference />);

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
  });

  it('sets the appearance when a segment is chosen', () => {
    render(<AppearancePreference />);

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(setAppearance).toHaveBeenCalledWith('dark');
  });

  it('reflects an explicit light choice', () => {
    useThemeMock.mockReturnValue({ appearance: 'light', setAppearance });
    render(<AppearancePreference />);

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  });
});
