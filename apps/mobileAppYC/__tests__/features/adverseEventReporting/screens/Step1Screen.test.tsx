import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Step1Screen} from '@/features/adverseEventReporting/screens/Step1Screen';
import * as reactRedux from 'react-redux';
import * as AdverseEventContext from '@/features/adverseEventReporting/state/AdverseEventReportContext';
import {setSelectedCompanion} from '@/features/companion';

// --- Mocks ---

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn().mockReturnValue({navigate: jest.fn()}),
};

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: 'blue',
        secondary: 'black',
        text: 'grey',
        textSecondary: 'lightgrey',
        textTertiary: 'darkgrey',
        placeholder: 'silver',
        error: 'red',
        borderMuted: 'lightgray',
      },
      spacing: {1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 16: 64},
      typography: {
        h4Alt: {fontSize: 24},
        subtitleBold14: {fontSize: 14, fontWeight: 'bold'},
        businessTitle16: {fontSize: 16},
        body: {fontSize: 14},
        paragraph: {fontSize: 12},
        paragraphBold: {fontSize: 12, fontWeight: 'bold'},
        labelXsBold: {fontSize: 10, fontWeight: 'bold'},
        pillSubtitleBold15: {fontSize: 15, fontWeight: 'bold'},
      },
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    adverse2: {uri: 'adverse-hero-image'},
  },
}));

// FIX: Handle Default Import for AERLayout
jest.mock('@/features/adverseEventReporting/components/AERLayout', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  const AERLayout = ({children, stepLabel, onBack, bottomButton}: any) => (
    <View testID="AERLayout">
      <Text>{stepLabel}</Text>
      <TouchableOpacity onPress={onBack} testID="aer-back-btn">
        <Text>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={bottomButton.onPress}
        disabled={bottomButton.disabled}
        testID="aer-next-btn">
        <Text>{bottomButton.title}</Text>
      </TouchableOpacity>
      {children}
    </View>
  );
  // Important: return default export structure
  return {
    __esModule: true,
    default: AERLayout,
  };
});

// FIX: Handle Named Imports for Selectors/Checkbox
jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    const CompanionSelector = ({onSelect, selectedCompanionId}: any) => (
      <TouchableOpacity
        testID="companion-selector"
        onPress={() => onSelect('comp-123')}>
        <Text>
          {selectedCompanionId ? 'Companion Selected' : 'Select Companion'}
        </Text>
      </TouchableOpacity>
    );
    return {
      CompanionSelector,
    };
  },
);

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => {
  const {TouchableOpacity, Text} = require('react-native');
  const Checkbox = ({value, onValueChange}: any) => (
    <TouchableOpacity onPress={onValueChange} testID="checkbox">
      <Text>{value ? 'Checked' : 'Unchecked'}</Text>
    </TouchableOpacity>
  );
  return {
    Checkbox,
  };
});

describe('Step1Screen', () => {
  let mockDispatch: jest.Mock;
  let mockUpdateDraft: jest.Mock;
  let mockSetReporterType: jest.Mock;

  const mockDraftState = {
    companionId: null,
    reporterType: 'parent',
    agreeToTerms: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDispatch = jest.fn();
    jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(mockDispatch);
    jest.spyOn(reactRedux, 'useSelector').mockImplementation(selector =>
      selector({
        companion: {
          companions: [{id: 'comp-1', name: 'Buddy'}],
          selectedCompanionId: null,
        },
      }),
    );

    mockUpdateDraft = jest.fn();
    mockSetReporterType = jest.fn();
    jest.spyOn(AdverseEventContext, 'useAdverseEventReport').mockReturnValue({
      draft: {...mockDraftState},
      updateDraft: mockUpdateDraft,
      setReporterType: mockSetReporterType,
    } as any);
  });

  const renderScreen = () =>
    render(
      <Step1Screen navigation={mockNavigation as any} route={{} as any} />,
    );

  describe('Rendering', () => {
    it('renders the layout correctly with all elements', () => {
      const {getByText, getByTestId} = renderScreen();

      expect(getByText('Step 1 of 5')).toBeTruthy();
      expect(getByText('Veterinary product adverse events')).toBeTruthy();
      expect(getByText('Who is reporting the concern?')).toBeTruthy();
      expect(getByText('Before you proceed')).toBeTruthy();
      expect(getByTestId('companion-selector')).toBeTruthy();
    });

    it('displays the hero image', () => {
      const {UNSAFE_getAllByType} = renderScreen();
      const images = UNSAFE_getAllByType(require('react-native').Image);
      expect(images.length).toBeGreaterThan(0);
    });

    it('renders radio options for reporter type', () => {
      const {getByText} = renderScreen();
      expect(getByText('The parent')).toBeTruthy();
      expect(getByText('The guardian (Co-Parent)')).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('initializes state from context draft', () => {
      const draftWithData = {
        companionId: 'draft-comp-1',
        reporterType: 'guardian',
        agreeToTerms: true,
      };

      (AdverseEventContext.useAdverseEventReport as jest.Mock).mockReturnValue({
        draft: draftWithData,
        updateDraft: mockUpdateDraft,
        setReporterType: mockSetReporterType,
      });

      const {getByText} = renderScreen();
      expect(getByText('Checked')).toBeTruthy();
    });

    it('auto-selects global companion if draft is empty', () => {
      jest.spyOn(reactRedux, 'useSelector').mockImplementation((cb: any) =>
        cb({
          companion: {
            companions: [{id: 'global-1', name: 'Global Dog'}],
            selectedCompanionId: 'global-1',
          },
        }),
      );

      renderScreen();

      expect(mockUpdateDraft).toHaveBeenCalledWith({companionId: 'global-1'});
      expect(mockDispatch).toHaveBeenCalledWith(
        setSelectedCompanion('global-1'),
      );
    });

    it('toggles terms agreement state', () => {
      const {getByTestId, getByText} = renderScreen();
      const checkbox = getByTestId('checkbox');

      expect(getByText('Unchecked')).toBeTruthy();
      fireEvent.press(checkbox);

      expect(mockUpdateDraft).toHaveBeenCalledWith({agreeToTerms: true});
    });

    it('clears terms error when toggling to true', () => {
      const {getByTestId, getByText, queryByText} = renderScreen();

      const selector = getByTestId('companion-selector');
      fireEvent.press(selector); // Selects 'comp-123'

      fireEvent.press(getByTestId('aer-next-btn'));
      expect(getByText('Accept the terms to continue')).toBeTruthy();

      fireEvent.press(getByTestId('checkbox'));

      expect(queryByText('Accept the terms to continue')).toBeNull();
    });

    it('updates reporter type on selection', () => {
      const {getByText} = renderScreen();
      fireEvent.press(getByText('The guardian (Co-Parent)'));
      expect(mockSetReporterType).toHaveBeenCalledWith('guardian');
    });

    it('handles companion selection via selector', () => {
      const {getByTestId} = renderScreen();
      fireEvent.press(getByTestId('companion-selector'));

      expect(mockUpdateDraft).toHaveBeenCalledWith({companionId: 'comp-123'});
      expect(mockDispatch).toHaveBeenCalledWith(
        setSelectedCompanion('comp-123'),
      );
    });
  });

  describe('Navigation & Actions', () => {
    it('navigates back when back button is pressed', () => {
      const {getByTestId} = renderScreen();
      fireEvent.press(getByTestId('aer-back-btn'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('navigates to Privacy Policy', () => {
      const {getByText} = renderScreen();
      const link = getByText('privacy policy');
      fireEvent.press(link);
      expect(mockNavigation.getParent().navigate).toHaveBeenCalledWith(
        'PrivacyPolicy',
      );
    });

    it('navigates to Terms and Conditions', () => {
      const {getByText} = renderScreen();
      const link = getByText('terms and conditions');
      fireEvent.press(link);
      expect(mockNavigation.getParent().navigate).toHaveBeenCalledWith(
        'TermsAndConditions',
      );
    });

    it('navigates to Step 2 when form is valid', () => {
      const {getByTestId} = renderScreen();

      fireEvent.press(getByTestId('companion-selector'));
      fireEvent.press(getByTestId('checkbox'));
      fireEvent.press(getByTestId('aer-next-btn'));

      expect(mockUpdateDraft).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Step2');
    });
  });

  describe('Form Validation', () => {
    it('disables next button/prevents navigation if companion is not selected', () => {
      const {getByTestId} = renderScreen();
      const nextBtn = getByTestId('aer-next-btn');

      fireEvent.press(nextBtn);

      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('shows error if terms are not accepted', () => {
      const {getByTestId, getByText} = renderScreen();

      fireEvent.press(getByTestId('companion-selector'));
      fireEvent.press(getByTestId('aer-next-btn'));

      expect(getByText('Accept the terms to continue')).toBeTruthy();
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('clears error text when terms are accepted', () => {
      const {getByTestId, getByText, queryByText} = renderScreen();

      fireEvent.press(getByTestId('companion-selector'));

      fireEvent.press(getByTestId('aer-next-btn'));
      expect(getByText('Accept the terms to continue')).toBeTruthy();

      fireEvent.press(getByTestId('checkbox'));
      expect(queryByText('Accept the terms to continue')).toBeNull();
    });
  });
});
