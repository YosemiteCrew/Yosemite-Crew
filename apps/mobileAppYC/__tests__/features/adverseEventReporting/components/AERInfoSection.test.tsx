import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AERInfoSection} from '../../../../src/features/adverseEventReporting/components/AERInfoSection';

// --- Mocks ---

// Mock Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: '#000',
        borderMuted: '#ccc',
        cardBackground: '#fff',
      },
      spacing: {2: 8, 4: 16, 6: 24},
      borderRadius: {lg: 12},
      typography: {
        h6Clash: {fontSize: 18, fontWeight: 'bold'},
      },
    },
  }),
}));

// Mock Assets
jest.mock('../../../../src/assets/images', () => ({
  Images: {
    blackEdit: {uri: 'edit-icon-mock'},
  },
}));

// Mock Components - FIX: Require View inside the factory
jest.mock(
  '../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View: RNView} = require('react-native');
    return {
      LiquidGlassCard: ({children, style}: any) => (
        <RNView testID="glass-card" style={style}>
          {children}
        </RNView>
      ),
    };
  },
);

jest.mock('../../../../src/shared/components/common/FormRowComponents', () => {
  const {
    View: RNView,
    Text: RNText,
    TouchableOpacity: RNTouchableOpacity,
  } = require('react-native');
  return {
    RowButton: ({label, value, onPress}: any) => (
      <RNTouchableOpacity testID={`row-${label}`} onPress={onPress}>
        <RNText>{label}</RNText>
        <RNText>{value}</RNText>
      </RNTouchableOpacity>
    ),
    Separator: () => <RNView testID="separator" />,
  };
});

describe('AERInfoSection', () => {
  const mockRows = [
    {label: 'Name', value: 'John Doe', onPress: jest.fn()},
    {label: 'Age', value: '30'}, // No onPress provided
  ];

  const defaultProps = {
    title: 'Personal Info',
    rows: mockRows,
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders section title correctly', () => {
    const {getByText} = render(<AERInfoSection {...defaultProps} />);
    expect(getByText('Personal Info')).toBeTruthy();
  });

  it('renders all rows correctly', () => {
    const {getByText} = render(<AERInfoSection {...defaultProps} />);

    expect(getByText('Name')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();

    expect(getByText('Age')).toBeTruthy();
    expect(getByText('30')).toBeTruthy();
  });

  it('renders separators between rows but not after the last one', () => {
    const threeRows = [
      {label: '1', value: 'a'},
      {label: '2', value: 'b'},
      {label: '3', value: 'c'},
    ];

    const {getAllByTestId} = render(
      <AERInfoSection {...defaultProps} rows={threeRows} />,
    );

    // 3 rows -> 2 separators
    expect(getAllByTestId('separator')).toHaveLength(2);
  });

  it('does NOT render edit icon when onEdit is undefined', () => {
    const {getByText} = render(
      <AERInfoSection {...defaultProps} onEdit={undefined} />,
    );

    const headerRow = getByText('Personal Info').parent;
    expect(headerRow?.children.length).toBe(1);
  });

  // ===========================================================================
  // 3. Row Interaction
  // ===========================================================================

  it('calls specific row onPress when row is pressed', () => {
    const {getByTestId} = render(<AERInfoSection {...defaultProps} />);

    fireEvent.press(getByTestId('row-Name'));
    expect(mockRows[0].onPress).toHaveBeenCalledTimes(1);
  });

  it('uses no-op function if row onPress is undefined (safe press)', () => {
    const {getByTestId} = render(<AERInfoSection {...defaultProps} />);

    fireEvent.press(getByTestId('row-Age'));
    // No error = pass
  });
});
