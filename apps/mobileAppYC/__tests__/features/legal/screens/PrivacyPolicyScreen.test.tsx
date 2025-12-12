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

  // --- 2. Branch Coverage: Top-Level __DEV__ Logic ---

  it('logs array length when PRIVACY_POLICY_SECTIONS is an array', () => {
    const consoleSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => {});

    jest.doMock(
      '../../../../src/features/legal/data/privacyPolicyData',
      () => ({
        PRIVACY_POLICY_SECTIONS: ['item1', 'item2', 'item3'],
      }),
    );

    // Re-require to trigger top-level execution
    require('../../../../src/features/legal/screens/PrivacyPolicyScreen');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('PrivacyPolicyScreen:'),
      expect.anything(),
      'isArray',
      true, // Array check passed
      'len',
      3, // Correct length
    );

    consoleSpy.mockRestore();
  });

  it('logs "N/A" when PRIVACY_POLICY_SECTIONS is NOT an array', () => {
    const consoleSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => {});

    // Mock as non-array to hit the 'else' branch of the ternary
    jest.doMock(
      '../../../../src/features/legal/data/privacyPolicyData',
      () => ({
        PRIVACY_POLICY_SECTIONS: {some: 'object'},
      }),
    );

    require('../../../../src/features/legal/screens/PrivacyPolicyScreen');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('PrivacyPolicyScreen:'),
      expect.anything(),
      'isArray',
      false, // Array check failed
      'len',
      'N/A', // Hit the else branch
    );

    consoleSpy.mockRestore();
  });

  it('handles errors in the debug block gracefully (Catch Block Coverage)', () => {
    // Force console.debug to throw error
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {
      throw new Error('Top level error');
    });

    jest.doMock(
      '../../../../src/features/legal/data/privacyPolicyData',
      () => ({
        PRIVACY_POLICY_SECTIONS: [],
      }),
    );

    // Should not crash the test runner
    expect(() => {
      require('../../../../src/features/legal/screens/PrivacyPolicyScreen');
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
