import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Header } from '@/shared/components/common/Header/Header';
import { Platform } from 'react-native';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    text: 'mockTextColor',
  },
  spacing: {
    '2': 8,
    '5': 20,
  },
  typography: {
    h3: { fontSize: 22, fontWeight: 'bold' },
  },
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

// 2. Mock Images
const mockBackIcon = 123; // A mock 'require' value
jest.mock('@/assets/images', () => ({
  Images: {
    backIcon: mockBackIcon,
  },
}));

// --- Tests ---

describe('Header', () => {
  const onBackMock = jest.fn();
  const onRightPressMock = jest.fn();

  beforeEach(() => {
    // Reset mocks and platform before each test
    onBackMock.mockClear();
    onRightPressMock.mockClear();
    Platform.OS = 'ios'; // Default to iOS
  });

  it('renders correctly in default state (no props)', () => {
    render(<Header />);
    // No title
    expect(screen.queryByText(/./)).toBeNull();
    // No buttons
    expect(screen.queryByRole('button')).toBeNull();
    // No images
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('renders the title', () => {
    render(<Header title="My Title" />);
    const title = screen.getByText('My Title');

    expect(title).toBeTruthy();
    // Check that styles from the theme are applied
    expect(title.props.style).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.text,
        fontSize: 22,
      }),
    );
  });

  it('renders back button and handles press', () => {
  });

  it('renders right icon and handles press', () => {

  });


  });

  it('applies custom style to the container', () => {
    const customStyle = { backgroundColor: 'red', height: 100 };
    render(<Header style={customStyle} />);
  });

  it('applies correct padding for ios', () => {
    Platform.OS = 'ios';
    render(<Header />);
  });

  it('applies correct padding for android', () => {
    Platform.OS = 'android';
    render(<Header />);
  });
