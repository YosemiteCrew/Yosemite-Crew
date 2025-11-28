import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import InviteCard from '../../../../src/features/linkedBusinesses/components/InviteCard';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: 'black',
        textSecondary: 'gray',
        background: 'white',
        surface: 'gray',
        border: 'black',
        secondary: 'blue',
        white: 'white',
      },
      spacing: [0, 4, 8, 12, 16, 20], // Array access style based on usage in component (theme.spacing[4])
      typography: {
        h4Alt: {fontSize: 20, fontWeight: 'bold'},
        labelXsBold: {fontSize: 12, fontWeight: 'bold'},
        bodyExtraSmall: {fontSize: 10},
        captionBoldSatoshi: {fontSize: 12, fontWeight: 'bold'},
        titleSmall: {fontSize: 14},
      },
      borderRadius: {
        md: 8,
        lg: 12,
      },
    },
  }),
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => {
    const {View} = require('react-native');
    return <View testID="liquid-glass-card">{children}</View>;
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    __esModule: true,
    default: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity onPress={onPress} testID={`btn-${title}`}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

describe('InviteCard', () => {
  const mockOnAccept = jest.fn();
  const mockOnDecline = jest.fn();

  const defaultProps = {
    businessName: 'Acme Corp',
    parentName: 'John Doe',
    companionName: 'Buddy',
    email: 'john.doe@example.com',
    phone: '123-456-7890',
    onAccept: mockOnAccept,
    onDecline: mockOnDecline,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all passed information correctly', () => {
    render(<InviteCard {...defaultProps} />);

    // Check Business Name in title and description
    expect(screen.getByText('Invite from Acme Corp')).toBeTruthy();
    // Note: The description text is split across lines in source, regex helps match partial content
    expect(
      screen.getByText(/already have an account at Acme Corp/),
    ).toBeTruthy();

    // Check Details
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('Buddy')).toBeTruthy();
    expect(screen.getByText('john.doe@example.com')).toBeTruthy();
    expect(screen.getByText('123-456-7890')).toBeTruthy();
  });

  it('calls onDecline when "Don\'t Know" button is pressed', () => {
    render(<InviteCard {...defaultProps} />);

    const declineButton = screen.getByTestId("btn-Don't Know");
    fireEvent.press(declineButton);

    expect(mockOnDecline).toHaveBeenCalledTimes(1);
    expect(mockOnAccept).not.toHaveBeenCalled();
  });

  it('calls onAccept when "Yes, It\'s me" button is pressed', () => {
    render(<InviteCard {...defaultProps} />);

    const acceptButton = screen.getByTestId("btn-Yes, It's me");
    fireEvent.press(acceptButton);

    expect(mockOnAccept).toHaveBeenCalledTimes(1);
    expect(mockOnDecline).not.toHaveBeenCalled();
  });
});
