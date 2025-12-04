import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {AddCoParentScreen} from '../../../../../src/features/coParent/screens/AddCoParentScreen/AddCoParentScreen';
import * as Redux from 'react-redux';
import {Alert, Button, View} from 'react-native';

// --- Mocks ---

// 1. Navigation
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
  navigate: jest.fn(),
} as any;

// 2. Redux & Actions
const mockDispatch = jest.fn();
const mockUnwrap = jest.fn();

// Helper to make dispatch return a promise-like object for unwrap
mockDispatch.mockReturnValue({unwrap: mockUnwrap});

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
// We will mock useSelector implementation in beforeEach/tests

const mockActions = {
  addCoParent: jest.fn(() => ({type: 'ADD_COPARENT', unwrap: mockUnwrap})),
};

jest.mock('../../../../../src/features/coParent', () => ({
  addCoParent: (...args: any) => mockActions.addCoParent(...args),
}));

// 3. Selectors
// We will mock these module imports to return values or just rely on useSelector mocking state shape
jest.mock('@/features/companion', () => ({
  selectCompanions: (state: any) => state.companion.companions,
  selectSelectedCompanionId: (state: any) =>
    state.companion.selectedCompanionId,
}));

// 4. Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        secondary: 'blue',
        borderMuted: 'gray',
        white: 'white',
        text: 'black',
      },
      spacing: new Array(30).fill(8),
      typography: {
        titleMedium: {fontSize: 16},
        h4Alt: {fontSize: 18},
      },
      borderRadius: {lg: 8},
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    heroImage: {uri: 'hero-image'},
  },
}));

// 5. Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Button, Text} = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        <Button title="Back" onPress={onBack} testID="header-back-btn" />
      </View>
    );
  },
}));

jest.mock('@/shared/components/common', () => ({
  Input: (props: any) => {
    const {View, TextInput} = require('react-native');
    return (
      <View>
        <TextInput
          testID={`input-${props.label}`}
          onChangeText={props.onChangeText}
          value={props.value}
          {...props}
        />
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, loading}: any) => {
      const {Button} = require('react-native');
      return (
        <Button
          title={loading ? 'Sending...' : title}
          onPress={onPress}
          testID="submit-btn"
          disabled={loading}
        />
      );
    },
  }),
);

// 6. Bottom Sheet Mock
const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();

jest.mock(
  '../../../../../src/features/coParent/components/AddCoParentBottomSheet/AddCoParentBottomSheet',
  () => {
    const {forwardRef, useImperativeHandle} = require('react');
    const {View, Button} = require('react-native');

    return forwardRef(({onConfirm}: any, ref: any) => {
      useImperativeHandle(ref, () => ({
        open: mockSheetOpen,
        close: mockSheetClose,
      }));
      return (
        <View testID="bottom-sheet">
          <Button
            title="Close Sheet"
            onPress={onConfirm}
            testID="sheet-close-btn"
          />
        </View>
      );
    });
  },
);

jest.spyOn(Alert, 'alert');

describe('AddCoParentScreen', () => {
  let mockState: any;

  const mockCompanion = {id: 'c1', name: 'Buddy', profileImage: 'buddy.jpg'};
  const mockCompanion2 = {id: 'c2', name: 'Lucy', profileImage: null};

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnwrap.mockResolvedValue({}); // Default success
    mockCanGoBack.mockReturnValue(true);

    // Default State
    mockState = {
      companion: {
        companions: [mockCompanion, mockCompanion2],
        selectedCompanionId: 'c1',
      },
    };

    jest.spyOn(Redux, 'useSelector').mockImplementation(cb => cb(mockState));
  });

  const fillForm = (getByTestId: any) => {
    // Need to target the Input component.
    // Note: react-hook-form Controller renders the input.
    // Our mock Input passes props down.
    // We find by the testID we assigned in the mock based on label
    fireEvent.changeText(getByTestId('input-Co-Parent name'), 'John Doe');
    fireEvent.changeText(
      getByTestId('input-Email address'),
      'john@example.com',
    );
    fireEvent.changeText(getByTestId('input-Mobile (optional)'), '1234567890');
  };

  it('renders correctly', () => {
    const {getByText, getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Add co-parent')).toBeTruthy();
    expect(getByTestId('input-Co-Parent name')).toBeTruthy();
    expect(getByTestId('submit-btn')).toBeTruthy();
  });

  it('handles successful invite submission (With Profile Image)', async () => {
    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fillForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('submit-btn'));
    });

    // Validation passes, dispatch called
    expect(mockActions.addCoParent).toHaveBeenCalledWith({
      inviteRequest: {
        candidateName: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '1234567890',
        companionId: 'c1',
      },
      companionName: 'Buddy',
      companionImage: 'buddy.jpg',
    });

    expect(mockUnwrap).toHaveBeenCalled();
    expect(mockSheetOpen).toHaveBeenCalled();
  });

  it('handles successful invite submission (Without Profile Image)', async () => {
    // Select companion 2 (no image)
    mockState.companion.selectedCompanionId = 'c2';

    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fillForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('submit-btn'));
    });

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        companionName: 'Lucy',
        companionImage: undefined, // Should be undefined
      }),
    );
  });

  it('handles submission failure (API Error)', async () => {
    const error = new Error('Network fail');
    mockUnwrap.mockRejectedValueOnce(error);
    // Mock console.error to keep test output clean
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fillForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('submit-btn'));
    });

    expect(mockActions.addCoParent).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to send invite');

    consoleSpy.mockRestore();
  });

  it('shows alert if no companion is available/selected (Logic Branch)', async () => {
    // Empty companions list -> selectedCompanion becomes null
    mockState.companion.companions = [];
    mockState.companion.selectedCompanionId = null;

    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fillForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('submit-btn'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Select companion',
      expect.any(String),
    );
    expect(mockActions.addCoParent).not.toHaveBeenCalled();
  });

  it('fallback to first companion if selected ID not found (Memo Branch coverage)', async () => {
    // ID doesn't match, should fallback to index 0 (Buddy)
    mockState.companion.selectedCompanionId = 'non-existent';

    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fillForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('submit-btn'));
    });

    // Should use Buddy (c1)
    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({companionId: 'c1'}),
      }),
    );
  });

  it('handles Back button navigation (Success)', () => {
    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles Back button navigation (Cannot go back)', () => {
    mockCanGoBack.mockReturnValue(false);
    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('closes sheet and navigates back on confirm', () => {
    const {getByTestId} = render(
      <AddCoParentScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('sheet-close-btn'));

    expect(mockSheetClose).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
