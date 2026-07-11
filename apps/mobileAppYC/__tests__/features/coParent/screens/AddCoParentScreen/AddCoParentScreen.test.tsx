import React from 'react';
import {Alert, Platform} from 'react-native';
import * as Redux from 'react-redux';
import {render, fireEvent, act, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {AddCoParentScreen} from '@/features/coParent/screens/AddCoParentScreen/AddCoParentScreen';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
} as any;

const mockDispatch = jest.fn();
let mockState: any = {};

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
jest
  .spyOn(Redux, 'useSelector')
  .mockImplementation((callback: any) => callback(mockState));

const mockAddCoParent = jest.fn();

jest.mock('../../../../../src/features/coParent/thunks', () => ({
  addCoParent: (...args: any[]) => mockAddCoParent(...args),
}));

jest.mock('@/features/companion', () => ({
  selectCompanions: (state: any) => state.companion?.companions || [],
  selectSelectedCompanionId: (state: any) =>
    state.companion?.selectedCompanionId,
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {heroImage: {uri: 'hero-image'}},
}));

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="liquid-glass-header-screen">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress, disabled}: any) => (
        <TouchableOpacity
          testID="send-invite-btn"
          onPress={onPress}
          disabled={disabled}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock('@/shared/components/common', () => {
  const {View, TextInput, Text} = require('react-native');
  return {
    Input: ({label, value, onChangeText, error}: any) => (
      <View>
        <TextInput
          testID={label}
          placeholder={label}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID={`${label}-error`}>{error}</Text> : null}
      </View>
    ),
  };
});

const mockOpen = jest.fn();
const mockClose = jest.fn();

jest.mock(
  '../../../../../src/features/coParent/components/AddCoParentBottomSheet/AddCoParentBottomSheet',
  () => {
    const ReactMock = require('react');
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      __esModule: true,
      default: ReactMock.forwardRef(({onConfirm}: any, ref: any) => {
        ReactMock.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));
        return (
          <View testID="add-coparent-bottom-sheet">
            <TouchableOpacity testID="confirm-add-coparent" onPress={onConfirm}>
              <Text>Confirm</Text>
            </TouchableOpacity>
          </View>
        );
      }),
    };
  },
);

describe('AddCoParentScreen', () => {
  const mockCompanion = {
    id: 'comp-1',
    name: 'Buddy',
    profileImage: 'https://img/buddy.jpg',
  };

  const defaultAsyncAction = () => {
    const promise: any = Promise.resolve({});
    promise.unwrap = jest.fn(() => Promise.resolve({}));
    return promise;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCanGoBack.mockReturnValue(true);
    mockAddCoParent.mockImplementation(() => defaultAsyncAction());
    mockDispatch.mockImplementation((action: any) => action);

    mockState = {
      companion: {
        companions: [mockCompanion],
        selectedCompanionId: 'comp-1',
      },
    };
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const fillValidForm = () => {
    fireEvent.changeText(screen.getByTestId('Co-Parent name'), 'Jane Doe');
    fireEvent.changeText(
      screen.getByTestId('Email address'),
      'jane@example.com',
    );
  };

  it('renders the header, hero image and form fields', () => {
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    expect(screen.getByText('Add co-parent')).toBeTruthy();
    expect(screen.getByText('Send invite')).toBeTruthy();
    expect(screen.getByTestId('Co-Parent name')).toBeTruthy();
    expect(screen.getByTestId('Email address')).toBeTruthy();
    expect(screen.getByTestId('Mobile (optional)')).toBeTruthy();
  });

  it('navigates back when the header back button is pressed and canGoBack is true', () => {
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not navigate back when canGoBack is false', () => {
    mockCanGoBack.mockReturnValue(false);
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows validation errors and does not dispatch when required fields are empty', async () => {
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(mockAddCoParent).not.toHaveBeenCalled();
    expect(screen.getByTestId('Co-Parent name-error')).toBeTruthy();
    expect(screen.getByTestId('Email address-error')).toBeTruthy();
  });

  it('dispatches addCoParent with the selected companion on valid submit', async () => {
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fillValidForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(mockAddCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({
          candidateName: 'Jane Doe',
          email: 'jane@example.com',
          companionId: 'comp-1',
        }),
        companionName: 'Buddy',
        companionImage: 'https://img/buddy.jpg',
      }),
    );
    expect(mockOpen).toHaveBeenCalled();
  });

  it('shows an alert and skips dispatch when no companion is selected', async () => {
    mockState.companion.companions = [];
    mockState.companion.selectedCompanionId = undefined;

    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fillValidForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Select companion',
      'Please select a companion to invite.',
    );
    expect(mockAddCoParent).not.toHaveBeenCalled();
  });

  it('shows an error alert when the dispatch fails', async () => {
    mockAddCoParent.mockImplementation(() => {
      const promise: any = Promise.resolve({});
      promise.unwrap = jest.fn(() => Promise.reject(new Error('failed')));
      return promise;
    });

    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fillValidForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to send invite');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to add co-parent:',
      expect.any(Error),
    );
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('closes the bottom sheet and navigates back on confirm', () => {
    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fireEvent.press(screen.getByTestId('confirm-add-coparent'));

    expect(mockClose).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('falls back to the first companion when no companion is selected explicitly', async () => {
    mockState.companion.selectedCompanionId = undefined;

    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fillValidForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(mockAddCoParent).toHaveBeenCalledWith(
      expect.objectContaining({companionName: 'Buddy'}),
    );
  });

  it('sends undefined companionImage when the companion has no profileImage', async () => {
    mockState.companion.companions = [
      {id: 'comp-2', name: 'Rex', profileImage: undefined},
    ];
    mockState.companion.selectedCompanionId = 'comp-2';

    render(
      <AddCoParentScreen
        navigation={mockNavigation as any}
        route={{} as any}
      />,
    );

    fillValidForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId('send-invite-btn'));
    });

    expect(mockAddCoParent).toHaveBeenCalledWith(
      expect.objectContaining({companionImage: undefined}),
    );
  });

  it('uses the android keyboard-avoiding behavior when not on iOS', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    expect(() =>
      render(
        <AddCoParentScreen
          navigation={mockNavigation as any}
          route={{} as any}
        />,
      ),
    ).not.toThrow();

    Platform.OS = originalOS;
  });
});
