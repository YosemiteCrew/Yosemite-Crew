import { Linking, Platform } from 'react-native';
import { openMapsToAddress } from '@/shared/utils/openMaps';

// Define a type for the platform-specific implementations
type PlatformSelectImplementations<T> = {
  ios?: T;
  android?: T;
  default?: T;
  [key: string]: T | undefined; // Allow other platforms like 'web'
};

// Define a type for our mock Platform
type MockPlatform = {
  OS: 'ios' | 'android' | 'web'; // Make it settable
  select: jest.Mock<any, [PlatformSelectImplementations<any>]>;
};

// Mock the react-native dependencies
jest.mock('react-native', () => {
  // Create the mock Platform object *first*.
  const mockPlatform: MockPlatform = {
    OS: 'ios', // Default mock OS
    select: jest.fn(
      <T>(implementations: PlatformSelectImplementations<T>): T | undefined => {
        // This logic now correctly mimics Platform.select
        if (mockPlatform.OS in implementations) {
          return implementations[mockPlatform.OS];
        }
        return implementations.default;
      },
    ),
  };

  // Return the complete mock
  return {
    Platform: mockPlatform,
    Linking: {
      canOpenURL: jest.fn(() => Promise.resolve(true)),
      openURL: jest.fn(() => Promise.resolve()),
    },
  };
});

// Cast the mocked modules to their Jest-mocked types for easier control
const mockLinking = Linking as jest.Mocked<typeof Linking>;
const mockPlatform = Platform as unknown as MockPlatform; // Use our defined type

describe('openMapsToAddress', () => {
  // Clear all mock call counts and reset the mock platform before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = 'ios'; // Reset OS to default

    // Reset the 'select' mock to its original implementation
    mockPlatform.select.mockImplementation(
      <T>(implementations: PlatformSelectImplementations<T>): T | undefined => {
        if (mockPlatform.OS in implementations) {
          return implementations[mockPlatform.OS];
        }
        return implementations.default;
      },
    );
  });

  it('should open the correct Apple Maps URL on iOS', async () => {
    mockPlatform.OS = 'ios';

    const address = '1 Apple Park Way, Cupertino';
    const expectedQuery = encodeURIComponent(address);
    const expectedUrl = `http://maps.apple.com/?q=${expectedQuery}`;

    await openMapsToAddress(address);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith(expectedUrl);
    expect(mockLinking.openURL).toHaveBeenCalledWith(expectedUrl);
  });

  it('should open the correct Google Maps URL on Android (after bug fix)', async () => {
    mockPlatform.OS = 'android';

    const address = '1600 Amphitheatre Parkway, Mountain View';
    const expectedQuery = encodeURIComponent(address);

    // This test assumes you have fixed the bug in openMaps.ts
    // The google const should be:
    // const google = `https://www.google.com/maps/search/?api=1&query=$${expectedQuery}`;
    const expectedUrl = `https://www.google.com/maps/search/?api=1&query=${expectedQuery}`;

    await openMapsToAddress(address);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith(expectedUrl);
    expect(mockLinking.openURL).toHaveBeenCalledWith(expectedUrl);
  });

  it('should not try to open a URL if Linking.canOpenURL returns false', async () => {
    mockLinking.canOpenURL.mockResolvedValue(false);
    mockPlatform.OS = 'ios';

    await openMapsToAddress('Some Address');

    expect(mockLinking.canOpenURL).toHaveBeenCalled();
    expect(mockLinking.openURL).not.toHaveBeenCalled();
  });

  it('should not call Linking if Platform.select returns undefined', async () => {
    // Force Platform.select to return undefined for this test
    mockPlatform.select.mockReturnValue(undefined);

    await openMapsToAddress('Some Address');

    // It should not call Linking at all
    expect(mockLinking.canOpenURL).not.toHaveBeenCalled();
    expect(mockLinking.openURL).not.toHaveBeenCalled();
  });
});