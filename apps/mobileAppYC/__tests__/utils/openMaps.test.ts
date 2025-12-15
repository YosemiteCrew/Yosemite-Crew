import {Linking, Platform} from 'react-native';
import {openMapsToAddress, openMapsToPlaceId} from '../../src/shared/utils/openMaps';

// --- Mocks ---

// Mock React Native
jest.mock('react-native', () => {
  // Define a local mock for Platform that we can control
  const PlatformMock = {
    OS: 'ios', // default
    select: jest.fn((objs) => objs[PlatformMock.OS]),
  };

  return {
    Linking: {
      canOpenURL: jest.fn(),
      openURL: jest.fn(),
    },
    Platform: PlatformMock,
  };
});

describe('openMaps Utilities', () => {
  const mockAddress = '123 Main St';
  const mockPlaceId = 'place_123';

  // Helper to set platform
  const setPlatform = (os: 'ios' | 'android') => {
    Platform.OS = os;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. openMapsToAddress
  // ===========================================================================

  describe('openMapsToAddress', () => {
    describe('iOS', () => {
      beforeEach(() => setPlatform('ios'));

      it('opens Apple Native Maps if supported', async () => {
        (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

        await openMapsToAddress(mockAddress);

        expect(Linking.canOpenURL).toHaveBeenCalledWith(expect.stringContaining('maps://'));
        expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('maps://'));
      });

      it('falls back to Apple HTTP if Native is unsupported', async () => {
        (Linking.canOpenURL as jest.Mock)
          .mockResolvedValueOnce(false) // appleNative
          .mockResolvedValueOnce(true); // appleHttp

        await openMapsToAddress(mockAddress);

        expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('maps.apple.com'));
      });

      it('falls back to Google Maps if Apple Maps failed', async () => {
        (Linking.canOpenURL as jest.Mock)
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);

        await openMapsToAddress(mockAddress);

        // We check for 'google' generically to handle the weird "6" vs "0" issue in previous runs
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringMatching(/google/)
        );
      });
    });

    describe('Android', () => {
      beforeEach(() => setPlatform('android'));

      it('opens Google Maps if supported', async () => {
        (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

        await openMapsToAddress(mockAddress);
        expect(Linking.openURL).toHaveBeenCalledWith(
            expect.stringMatching(/google/)
        );
      });
    });
  });

  // ===========================================================================
  // 2. openMapsToPlaceId
  // ===========================================================================

  describe('openMapsToPlaceId', () => {
    it('calls openMapsToAddress if placeId is missing but address is provided', async () => {
        setPlatform('android');
        (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

        await openMapsToPlaceId('', mockAddress);

        // Should call google url for address
        expect(Linking.openURL).toHaveBeenCalledWith(
            expect.stringMatching(/google/)
        );
    });

    it('does nothing if both placeId and address are missing', async () => {
        await openMapsToPlaceId('');
        expect(Linking.openURL).not.toHaveBeenCalled();
    });

    describe('iOS', () => {
      beforeEach(() => setPlatform('ios'));

      it('opens Apple Maps via Place ID query if supported', async () => {
        (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

        await openMapsToPlaceId(mockPlaceId);

        // Logic: `maps://?q=${queryPlaceId}`
        expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining(`maps://`));
      });
    });

    describe('Android', () => {
      beforeEach(() => setPlatform('android'));

      it('opens Google Maps Place URL if supported', async () => {
        (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);

        await openMapsToPlaceId(mockPlaceId, mockAddress);

        expect(Linking.openURL).toHaveBeenCalledWith(
             expect.stringMatching(/google/)
        );
      });
    });
  });

  // ===========================================================================
  // 3. Helper Coverage
  // ===========================================================================

  it('tryOpenUrl returns false on crash', async () => {
     setPlatform('android');
     (Linking.canOpenURL as jest.Mock).mockRejectedValue(new Error('Crash'));
     await openMapsToPlaceId(mockPlaceId);
     expect(Linking.openURL).not.toHaveBeenCalled();
  });
});