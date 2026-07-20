import React from 'react';
import {render} from '@testing-library/react-native';

// --- Mocks ---

// 1. Mock Child Component
jest.mock('../../../../src/features/legal/components/LegalScreen', () => ({
  LegalScreen: jest.fn(() => null),
}));

describe('PrivacyPolicyScreen', () => {
  const mockNavigate = jest.fn();
  const mockProps: any = {
    navigation: {navigate: mockNavigate},
    route: {name: 'PrivacyPolicy'},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Essential for testing top-level code execution
  });

  // --- 1. Component Rendering & Props (Standard Flow) ---

  it('renders LegalScreen with correct title and sections', () => {
    // Mock data as an array
    jest.doMock(
      '../../../../src/features/legal/data/privacyPolicyData',
      () => ({
        PRIVACY_POLICY_SECTIONS: ['section1', 'section2'],
      }),
    );

    // Import component after mock
    const PrivacyPolicyScreen =
      require('../../../../src/features/legal/screens/PrivacyPolicyScreen').default;
    const {
      LegalScreen,
    } = require('../../../../src/features/legal/components/LegalScreen');

    render(<PrivacyPolicyScreen {...mockProps} />);

    // Verify props passed to LegalScreen
    // Note: strict equality for the second arg (undefined) to fix previous test failure
    expect(LegalScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Privacy Policy',
        sections: ['section1', 'section2'],
        ...mockProps,
      }),
      undefined,
    );
  });
});
