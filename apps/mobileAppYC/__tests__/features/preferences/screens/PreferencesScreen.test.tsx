import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {useTheme} from '@/hooks';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {PreferencesScreen} from '@/features/preferences/screens/PreferencesScreen';

// --- Mocks ---
//
// PreferencesScreen was built to the warm-bone design: it renders three
// SegmentedControls (distance / weight / appearance) and two TouchableInputs
// (currency / language) inside a LiquidGlassHeaderScreen + Header shell, and
// wires the currency + language TouchableInputs to imperative bottom sheets.
//
// The two warm-bone primitives (SegmentedControl, TouchableInput) render for
// real so their onChange / onPress wiring is exercised. The layout shell and
// Header are mocked to minimal host views, and the two bottom sheets are mocked
// to forwardRef stubs that expose an imperative `open()` and forward their
// props (so we can invoke `onSave` and assert what was passed). Ionicons,
// safe-area-context and the theme hook are handled globally / below.

const mockGoBack = jest.fn();
const mockSetTheme = jest.fn();
const mockSetWeightUnit = jest.fn();
const mockSetDistanceUnit = jest.fn();
const mockSetCurrency = jest.fn();

// i18n — the screen reads `i18n.language` and calls `i18n.changeLanguage`.
const mockI18n = {language: 'en', changeLanguage: jest.fn()};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({i18n: mockI18n}),
}));

// Theme + preferences hooks are explicit jest.fns we drive per test.
jest.mock('@/hooks', () => ({useTheme: jest.fn()}));
jest.mock('@/features/preferences/PreferencesContext', () => ({
  usePreferences: jest.fn(),
}));

// Header — expose the title + a pressable back affordance wired to onBack.
jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, Pressable} = require('react-native');
  const Header = ({title, showBackButton, onBack}: any) => (
    <View testID="header">
      <Text>{title}</Text>
      {showBackButton ? (
        <Pressable testID="header-back" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
      ) : null}
    </View>
  );
  return {Header};
});

// Liquid-glass layout shell — render the header and invoke the render-prop
// children with a content-padding style so the ScrollView body renders.
jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    const LiquidGlassHeaderScreen = ({
      header,
      children,
      containerStyle,
    }: any) => (
      <View testID="screen-layout" style={containerStyle}>
        {header}
        {typeof children === 'function'
          ? children({paddingBottom: 20})
          : children}
      </View>
    );
    return {LiquidGlassHeaderScreen};
  },
);

// Bottom sheets — forwardRef stubs exposing imperative open()/close(). The
// `attach` flag lets a test leave `ref.current` null to exercise the optional
// chaining guard on `sheetRef.current?.open()`.
const mockCurrencySheetRef = {
  current: {open: jest.fn(), close: jest.fn()},
  attach: true,
};
const mockLanguageSheetRef = {
  current: {open: jest.fn(), close: jest.fn()},
  attach: true,
};

jest.mock(
  '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    const CurrencyBottomSheet = ReactInside.forwardRef(
      (props: any, ref: any) => {
        ReactInside.useImperativeHandle(ref, () =>
          mockCurrencySheetRef.attach ? mockCurrencySheetRef.current : null,
        );
        return <MockView testID="mock-currency-sheet" {...props} />;
      },
    );
    return {CurrencyBottomSheet};
  },
);

jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    const GenericSelectBottomSheet = ReactInside.forwardRef(
      (props: any, ref: any) => {
        ReactInside.useImperativeHandle(ref, () =>
          mockLanguageSheetRef.attach ? mockLanguageSheetRef.current : null,
        );
        return <MockView testID="mock-language-sheet" {...props} />;
      },
    );
    return {GenericSelectBottomSheet};
  },
);

type RenderOptions = {
  canGoBack?: boolean;
  themeMode?: 'light' | 'dark' | 'system';
  currency?: string;
  weightUnit?: string;
  distanceUnit?: string;
  language?: string;
};

const renderScreen = (opts: RenderOptions = {}) => {
  const {
    canGoBack = true,
    themeMode = 'light',
    currency = 'EUR',
    weightUnit = 'kg',
    distanceUnit = 'km',
    language = 'en',
  } = opts;

  mockI18n.language = language;

  (useTheme as jest.Mock).mockReturnValue({
    theme: mockTheme,
    isDark: false,
    themeMode,
    darkModeLocked: true,
    setTheme: mockSetTheme,
    toggleTheme: jest.fn(),
  });

  (usePreferences as jest.Mock).mockReturnValue({
    measurementSystem: 'metric',
    weightUnit,
    distanceUnit,
    currency,
    setWeightUnit: mockSetWeightUnit,
    setDistanceUnit: mockSetDistanceUnit,
    setCurrency: mockSetCurrency,
  });

  const navigation = {
    canGoBack: jest.fn(() => canGoBack),
    goBack: mockGoBack,
  };

  const utils = render(
    <PreferencesScreen
      navigation={navigation as any}
      route={{key: 'preferences', name: 'Preferences'} as any}
    />,
  );

  return {...utils, navigation};
};

describe('PreferencesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18n.language = 'en';
    mockCurrencySheetRef.attach = true;
    mockLanguageSheetRef.attach = true;
  });

  // --- Rendering & copy ---

  it('renders the warm-bone preferences layout and copy', () => {
    const {getByText, getByTestId, getAllByTestId} = renderScreen();

    // Header
    expect(getByText('Preferences')).toBeTruthy();
    expect(getByTestId('header-back')).toBeTruthy();

    // Section labels
    expect(getByText('Distance')).toBeTruthy();
    expect(getByText('Weight')).toBeTruthy();
    expect(getByText('Appearance')).toBeTruthy();
    expect(getByText('Currency')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();

    // Segmented control option labels
    expect(getByText('Kilometres')).toBeTruthy();
    expect(getByText('Miles')).toBeTruthy();
    expect(getByText('Kilograms')).toBeTruthy();
    expect(getByText('Pounds')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();

    // Captions + footnote
    expect(
      getByText(
        'Used for expenses and invoices. Existing entries are not converted.',
      ),
    ).toBeTruthy();
    expect(getByText('Dark uses the warm espresso theme.')).toBeTruthy();
    expect(
      getByText('Changes apply immediately and sync to your other devices.'),
    ).toBeTruthy();

    // Currency + language TouchableInput values
    expect(getByText('EUR €')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();

    // Both TouchableInputs render the chevron affordance
    expect(getAllByTestId('icon-chevron-down')).toHaveLength(2);
  });

  it('applies the warm screen background to the layout container', () => {
    const {getByTestId} = renderScreen();
    const layout = getByTestId('screen-layout');
    const style = Array.isArray(layout.props.style)
      ? layout.props.style.filter(Boolean)[0]
      : layout.props.style;
    expect(style).toEqual(
      expect.objectContaining({
        backgroundColor: mockTheme.colors.screen,
        flex: 1,
      }),
    );
  });

  // --- Back navigation ---

  it('goes back when navigation can go back', () => {
    const {getByTestId, navigation} = renderScreen({canGoBack: true});

    fireEvent.press(getByTestId('header-back'));

    expect(navigation.canGoBack).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not go back when navigation cannot go back', () => {
    const {getByTestId, navigation} = renderScreen({canGoBack: false});

    fireEvent.press(getByTestId('header-back'));

    expect(navigation.canGoBack).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // --- Currency label branches ---

  it('shows the "CODE symbol" label for a supported currency', () => {
    const {getByText, queryByText} = renderScreen({currency: 'USD'});
    expect(getByText('USD $')).toBeTruthy();
    expect(queryByText('EUR €')).toBeNull();
  });

  it('falls back to the raw currency code when no record is found', () => {
    const {getByText} = renderScreen({currency: 'GBP'});
    expect(getByText('GBP')).toBeTruthy();
  });

  // --- Segmented control interactions ---

  it('updates the distance unit when a segment is pressed', () => {
    const {getByTestId} = renderScreen({distanceUnit: 'km'});

    fireEvent.press(getByTestId('distance-unit-control-mi'));

    expect(mockSetDistanceUnit).toHaveBeenCalledWith('mi');
  });

  it('updates the weight unit when a segment is pressed', () => {
    const {getByTestId} = renderScreen({weightUnit: 'kg'});

    fireEvent.press(getByTestId('weight-unit-control-lbs'));

    expect(mockSetWeightUnit).toHaveBeenCalledWith('lbs');
  });

  it('updates the appearance mode when a segment is pressed', () => {
    const {getByTestId} = renderScreen({themeMode: 'light'});

    fireEvent.press(getByTestId('appearance-control-dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('reflects the current theme mode as the selected appearance segment', () => {
    const {getByTestId} = renderScreen({themeMode: 'system'});
    expect(
      getByTestId('appearance-control-system').props.accessibilityState
        .selected,
    ).toBe(true);
  });

  // --- Bottom sheet opening ---

  it('opens the currency sheet when the currency field is pressed', () => {
    const {getByText} = renderScreen({currency: 'EUR'});

    fireEvent.press(getByText('EUR €'));

    expect(mockCurrencySheetRef.current.open).toHaveBeenCalledTimes(1);
  });

  it('opens the language sheet when the language field is pressed', () => {
    const {getByText} = renderScreen();

    fireEvent.press(getByText('English'));

    expect(mockLanguageSheetRef.current.open).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the sheet refs are not attached', () => {
    mockCurrencySheetRef.attach = false;
    mockLanguageSheetRef.attach = false;

    const {getByText} = renderScreen({currency: 'EUR'});

    expect(() => {
      fireEvent.press(getByText('EUR €'));
      fireEvent.press(getByText('English'));
    }).not.toThrow();

    expect(mockCurrencySheetRef.current.open).not.toHaveBeenCalled();
    expect(mockLanguageSheetRef.current.open).not.toHaveBeenCalled();
  });

  // --- Bottom sheet onSave callbacks ---

  it('persists the selected currency from the currency sheet', () => {
    const {getByTestId} = renderScreen();

    act(() => {
      getByTestId('mock-currency-sheet').props.onSave('USD');
    });

    expect(mockSetCurrency).toHaveBeenCalledWith('USD');
  });

  it('passes the current selection to the currency sheet', () => {
    const {getByTestId} = renderScreen({currency: 'USD'});
    expect(getByTestId('mock-currency-sheet').props.selectedCurrency).toBe(
      'USD',
    );
  });

  it('changes the app language when a language is chosen', () => {
    const {getByTestId} = renderScreen();

    act(() => {
      getByTestId('mock-language-sheet').props.onSave({
        id: 'es',
        label: 'Español',
      });
    });

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('es');
  });

  it('ignores an empty selection from the language sheet', () => {
    const {getByTestId} = renderScreen();

    act(() => {
      getByTestId('mock-language-sheet').props.onSave(null);
    });

    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
  });

  it('passes the expected props to the language sheet', () => {
    const {getByTestId} = renderScreen();
    const props = getByTestId('mock-language-sheet').props;

    expect(props.title).toBe('Language');
    expect(props.mode).toBe('select');
    expect(props.hasSearch).toBe(false);
    expect(props.emptyMessage).toBe('No languages available');
    expect(props.items).toHaveLength(2);
    expect(props.selectedItem).toEqual({id: 'en', label: 'English'});
  });

  // --- Language resolution branches ---

  it('resolves the language from a regional language tag', () => {
    const {getByText} = renderScreen({language: 'es-ES'});
    expect(getByText('Español')).toBeTruthy();
  });

  it('falls back to English for an unsupported language', () => {
    const {getByText} = renderScreen({language: 'fr'});
    expect(getByText('English')).toBeTruthy();
  });

  it('falls back to English when the i18n language is empty', () => {
    const {getByText, getByTestId} = renderScreen({language: ''});
    expect(getByText('English')).toBeTruthy();
    expect(getByTestId('mock-language-sheet').props.selectedItem).toEqual({
      id: 'en',
      label: 'English',
    });
  });
});
