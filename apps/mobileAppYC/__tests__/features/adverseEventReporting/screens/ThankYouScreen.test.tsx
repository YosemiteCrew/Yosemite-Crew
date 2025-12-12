import React from 'react';
import {Linking} from 'react-native';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ThankYouScreen} from '../../../../src/features/adverseEventReporting/screens/ThankYouScreen';
import {useSelector} from 'react-redux';
import {useAdverseEventReport} from '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext';
import {adverseEventService} from '../../../../src/features/adverseEventReporting/services/adverseEventService';
import {
  showErrorAlert,
  showSuccessAlert,
} from '../../../../src/shared/utils/commonHelpers';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockNavigation = {navigate: mockNavigate} as any;

// 2. React Native Linking
// We do NOT mock the whole 'react-native' module. logic handles inside beforeEach.

// 3. Hooks & Theme
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        borderMuted: 'gray',
        error: 'red',
        surface: 'white',
        white: 'white',
      },
      spacing: {1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 24: 96},
      borderRadius: {lg: 10},
      typography: {
        businessSectionTitle20: {fontSize: 20},
        pillSubtitleBold15: {fontSize: 15},
        labelXsBold: {fontSize: 10},
        h6Clash: {fontSize: 18},
        subtitleBold14: {fontSize: 14},
        paragraph: {fontSize: 12},
      },
    },
  }),
}));

// 4. Redux & Context
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

jest.mock(
  '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext',
  () => ({
    useAdverseEventReport: jest.fn(),
  }),
);

// 5. Services & Helpers
jest.mock(
  '../../../../src/features/adverseEventReporting/services/adverseEventService',
  () => ({
    adverseEventService: {
      submitReport: jest.fn(),
      fetchRegulatoryAuthority: jest.fn(),
    },
  }),
);

jest.mock('../../../../src/shared/utils/commonHelpers', () => ({
  showErrorAlert: jest.fn(),
  showSuccessAlert: jest.fn(),
}));

// 6. UI Components (Mocking children to simplify tree)
jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({onBack}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity onPress={onBack} testID="header-back">
        <Text>Header</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../../../src/shared/components/common/Checkbox/Checkbox', () => ({
  Checkbox: ({value, onValueChange, label}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity
        onPress={() => onValueChange(!value)}
        testID="consent-checkbox">
        <Text>{label}</Text>
        <Text>{value ? 'Checked' : 'Unchecked'}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    __esModule: true,
    default: ({title, onPress, loading, disabled}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          onPress={onPress}
          testID={`btn-${title}`}
          disabled={disabled}>
          <Text>{loading ? 'Loading...' : title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

// Mock the barrel export for shared components
jest.mock('../../../../src/shared/components/common', () => ({
  SafeArea: ({children}: any) => {
    const {View} = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('../../../../src/assets/images', () => ({
  Images: {
    adverse3: {uri: 'adverse3'},
    phone: {uri: 'phone'},
  },
}));

// --- Test Suite ---

describe('ThankYouScreen', () => {
  const mockResetDraft = jest.fn();
  const mockSetConsent = jest.fn();
  const mockSetProductInfo = jest.fn();
  const mockOpenURL = jest.fn();

  const defaultDraft = {
    consentToContact: false,
    companionId: 'c1',
    linkedBusinessId: 'lb1',
    reporterType: 'Pet Owner',
    productInfo: {productName: 'Meds'},
  };

  const defaultReduxState = {
    companion: {
      companions: [{id: 'c1', name: 'Buddy'}],
      selectedCompanionId: 'c1',
    },
    linkedBusinesses: {
      linkedBusinesses: [{id: 'lb1', businessId: 'org1'}],
    },
    auth: {
      user: {id: 'u1', firstName: 'John', address: {country: 'United Kingdom'}},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Linking Spy
    jest.spyOn(Linking, 'openURL').mockImplementation(mockOpenURL);

    // Setup Context
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: defaultDraft,
      setConsentToContact: mockSetConsent,
      setProductInfo: mockSetProductInfo,
      resetDraft: mockResetDraft,
    });

    // Setup Redux
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector(defaultReduxState),
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // 1. Rendering & Logic Resolution
  // ===========================================================================

  it('renders correctly with default state', () => {
    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    expect(getByText('Thank you for reaching out to us')).toBeTruthy();
    expect(getByText('Send report to drug manufacturer')).toBeTruthy();
    expect(getByText('Send report to hospital')).toBeTruthy();
  });

  it('navigates back on header press', () => {
    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('header-back'));
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('toggles checkbox and validates consent error', () => {
    const {getByTestId, getByText, queryByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );

    // 1. Try to submit without checking -> Error
    fireEvent.press(getByTestId('btn-Send report to drug manufacturer'));
    expect(getByText('Select the checkbox to continue')).toBeTruthy();

    // 2. Check the box -> Error should clear, state updates
    fireEvent.press(getByTestId('consent-checkbox'));
    expect(queryByText('Select the checkbox to continue')).toBeNull();
    expect(mockSetConsent).toHaveBeenCalledWith(true);
  });

  // ===========================================================================
  // 2. Report Submission Logic
  // ===========================================================================

  it('submits report successfully to manufacturer', async () => {
    // Enable checkbox by default
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
      setProductInfo: mockSetProductInfo,
      resetDraft: mockResetDraft,
    });

    (adverseEventService.submitReport as jest.Mock).mockResolvedValue({
      productFiles: ['file1.pdf'],
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('btn-Send report to drug manufacturer'));

    await waitFor(() => {
      expect(adverseEventService.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          destinations: expect.objectContaining({
            sendToManufacturer: true,
            sendToHospital: false,
          }),
          organisationId: 'org1',
        }),
      );
    });

    // Covers lines 119-122 (productFiles handling)
    expect(mockSetProductInfo).toHaveBeenCalled();
    expect(showSuccessAlert).toHaveBeenCalledWith(
      'Report submitted',
      expect.stringContaining('manufacturer'),
    );
    expect(mockResetDraft).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('submits report successfully to hospital (no returned files)', async () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
      setProductInfo: mockSetProductInfo,
      resetDraft: mockResetDraft,
    });

    (adverseEventService.submitReport as jest.Mock).mockResolvedValue({}); // No files

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showSuccessAlert).toHaveBeenCalledWith(
        'Report submitted',
        expect.stringContaining('hospital'),
      );
    });

    expect(mockSetProductInfo).not.toHaveBeenCalled();
  });

  it('handles validation errors (Missing inputs)', async () => {
    // Case: Missing Auth User
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        auth: {user: null},
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('btn-Send report to drug manufacturer'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Please sign in again to submit this report.',
      );
    });
  });

  it('handles validation errors (Missing Companion)', async () => {
    // Draft has invalid companion ID
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        ...defaultDraft,
        companionId: 'invalid-id',
        consentToContact: true,
      },
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Select a companion to continue.',
      );
    });
  });

  it('handles validation errors (Missing Linked Hospital)', async () => {
    // Draft has no linked business
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, linkedBusinessId: null, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Select a linked hospital to continue.',
      );
    });
  });

  it('handles validation errors (Missing Product Info)', async () => {
    // Covers Line 93
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, productInfo: null, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Add product details before submitting.',
      );
    });
  });

  it('handles API submission errors', async () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
      setProductInfo: mockSetProductInfo,
      resetDraft: mockResetDraft,
    });

    (adverseEventService.submitReport as jest.Mock).mockRejectedValue(
      new Error('Network Fail'),
    );

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Network Fail',
      );
    });
  });

  // ===========================================================================
  // 3. Regulatory Authority Logic
  // ===========================================================================

  it('fetches and calls regulatory authority (Successful Flow)', async () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    (
      adverseEventService.fetchRegulatoryAuthority as jest.Mock
    ).mockResolvedValue({
      authorityName: 'VMD',
      phone: '+44 1234 567890',
      email: 'info@vmd.uk',
      website: 'vmd.gov.uk',
    });

    mockOpenURL.mockResolvedValue(true);

    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByText('Call regulatory authority'));

    expect(getByText('Fetching authority contact...')).toBeTruthy();

    await waitFor(() => {
      expect(adverseEventService.fetchRegulatoryAuthority).toHaveBeenCalledWith(
        expect.objectContaining({country: 'United Kingdom'}),
      );
      expect(mockOpenURL).toHaveBeenCalledWith('tel:+441234567890');
    });

    expect(getByText('VMD')).toBeTruthy();
    expect(getByText('Email: info@vmd.uk')).toBeTruthy();
  });

  it('handles call authority failure (Unsupported Country)', async () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        auth: {user: {address: {country: 'Mars'}}},
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByText('Call regulatory authority'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to call authority',
        expect.stringContaining('only in supported countries'),
      );
    });
  });

  it('handles call authority failure (No country set)', async () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        auth: {user: {address: null}},
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByText('Call regulatory authority'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to call authority',
        expect.stringContaining('only in supported countries'),
      );
    });
  });

  it('handles fetch success but missing phone number', async () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    (
      adverseEventService.fetchRegulatoryAuthority as jest.Mock
    ).mockResolvedValue({
      authorityName: 'Unknown',
      phone: null,
    });

    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByText('Call regulatory authority'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Contact unavailable',
        'No phone number available for the regulatory authority.',
      );
    });
  });

  it('handles Linking failure (Dialer unavailable)', async () => {
    // Covers Lines 185-189
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    (
      adverseEventService.fetchRegulatoryAuthority as jest.Mock
    ).mockResolvedValue({
      phone: '123',
    });

    mockOpenURL.mockRejectedValue(new Error('Cannot open'));

    const {getByText} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByText('Call regulatory authority'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Dialer unavailable',
        expect.stringContaining('123'),
      );
    });
  });

  // ===========================================================================
  // 4. Edge Cases
  // ===========================================================================

  it('resolves organisation ID from "id" if "businessId" is missing', async () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        linkedBusinesses: {
          linkedBusinesses: [{id: 'lb1'}], // No businessId
        },
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
      resetDraft: mockResetDraft,
    });

    (adverseEventService.submitReport as jest.Mock).mockResolvedValue({});

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(adverseEventService.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'lb1',
        }),
      );
    });
  });

  it('returns null if no companion ID matches', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        companion: {
          companions: [],
          selectedCompanionId: 'c1',
        },
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    return waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Select a companion to continue.',
      );
    });
  });

  it('uses default selectedCompanionId if draft.companionId is missing', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, companionId: null, consentToContact: true},
      setConsentToContact: mockSetConsent,
      resetDraft: mockResetDraft,
    });

    (adverseEventService.submitReport as jest.Mock).mockResolvedValue({});

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    return waitFor(() => {
      expect(adverseEventService.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          companion: expect.objectContaining({id: 'c1'}),
        }),
      );
    });
  });

  it('fails safely if neither draft nor state has companion ID', async () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        ...defaultReduxState,
        companion: {companions: [], selectedCompanionId: null},
      }),
    );

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {...defaultDraft, companionId: null, consentToContact: true},
      setConsentToContact: mockSetConsent,
    });

    const {getByTestId} = render(
      <ThankYouScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(getByTestId('btn-Send report to hospital'));

    await waitFor(() => {
      expect(showErrorAlert).toHaveBeenCalledWith(
        'Unable to submit',
        'Select a companion to continue.',
      );
    });
  });
});
