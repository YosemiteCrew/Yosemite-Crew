import {
  preparePhotoPayload,
  isRemoteUri,
} from '../../../../src/features/account/utils/profilePhoto';
import RNFS from 'react-native-fs';

// --- Mocks ---
jest.mock('react-native-fs', () => ({
  stat: jest.fn(),
}));

describe('profilePhoto utils', () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  // ===========================================================================
  // 1. isRemoteUri Helper
  // ===========================================================================

  describe('isRemoteUri', () => {
    it('returns true for http/https uris', () => {
      expect(isRemoteUri('https://example.com/image.png')).toBe(true);
      expect(isRemoteUri('http://example.com/image.jpg')).toBe(true);
    });

    it('returns false for local file paths', () => {
      expect(isRemoteUri('file:///data/user/0/com.app/cache/img.jpg')).toBe(false);
      expect(isRemoteUri('/absolute/path/image.jpg')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isRemoteUri(null)).toBe(false);
      expect(isRemoteUri(undefined)).toBe(false);
    });
  });

  // ===========================================================================
  // 2. preparePhotoPayload - Remote & Empty States
  // ===========================================================================

  describe('preparePhotoPayload (Remote/Empty)', () => {
    it('returns existingRemoteUrl if input imageUri is null/undefined', async () => {
      const result = await preparePhotoPayload({
        imageUri: null,
        existingRemoteUrl: 'https://old.com/photo.jpg',
      });

      expect(result).toEqual({
        remoteUrl: 'https://old.com/photo.jpg',
        localFile: null,
      });
    });

    it('returns null remoteUrl if input is null and no existing url provided', async () => {
      const result = await preparePhotoPayload({
        imageUri: undefined,
        existingRemoteUrl: null,
      });

      expect(result).toEqual({
        remoteUrl: null,
        localFile: null,
      });
    });

    it('returns input imageUri as remoteUrl if it matches regex', async () => {
      const result = await preparePhotoPayload({
        imageUri: 'https://new.com/photo.png',
        existingRemoteUrl: 'https://old.com/photo.jpg',
      });

      expect(result).toEqual({
        remoteUrl: 'https://new.com/photo.png',
        localFile: null,
      });
    });
  });

  // ===========================================================================
  // 3. preparePhotoPayload - Local Files
  // ===========================================================================

  describe('preparePhotoPayload (Local Files)', () => {
    it('processes standard file paths correctly', async () => {
      const imageUri = 'file:///data/cache/my-image.jpg';

      const result = await preparePhotoPayload({
        imageUri,
      });

      expect(result).toEqual({
        remoteUrl: null,
        localFile: {
          path: '/data/cache/my-image.jpg',
          mimeType: 'image/jpeg',
          fileName: 'my-image.jpg',
        },
      });
    });

    it('infers mime types correctly for different extensions', async () => {
      const cases = [
        { path: 'test.png', mime: 'image/png' },
        { path: 'test.webp', mime: 'image/webp' },
        { path: 'test.heic', mime: 'image/heic' },
        { path: 'test.HEIF', mime: 'image/heic' }, // Case insensitive check
        { path: 'test.unknown', mime: 'image/jpeg' }, // Default
      ];

      for (const c of cases) {
        const result = await preparePhotoPayload({ imageUri: c.path });
        expect(result.localFile?.mimeType).toBe(c.mime);
      }
    });

    it('uses fallback title if filename extraction fails', async () => {
      // Path ending in slash or empty segments
      const result = await preparePhotoPayload({
        imageUri: '/path/to/dir/',
        fallbackTitle: 'custom-fallback'
      });

      // Split results in empty string at end, fallback logic triggers
      // Actually split('/path/to/dir/') -> [..., 'dir', '']
      // last is '', so it uses fallback
      expect(result.localFile?.fileName).toBe('custom-fallback.jpg');
    });
  });

  // ===========================================================================
  // 4. preparePhotoPayload - Content URIs (Android) & Errors
  // ===========================================================================

  describe('preparePhotoPayload (Content URIs)', () => {
    it('resolves content:// URI using RNFS.stat', async () => {
      (RNFS.stat as jest.Mock).mockResolvedValue({
        originalFilepath: '/real/path/image.jpg',
      });

      const result = await preparePhotoPayload({
        imageUri: 'content://media/external/images/123',
      });

      expect(RNFS.stat).toHaveBeenCalledWith('content://media/external/images/123');
      expect(result.localFile?.path).toBe('/real/path/image.jpg');
    });

    it('returns original content URI if RNFS.stat returns no originalFilepath', async () => {
      (RNFS.stat as jest.Mock).mockResolvedValue({}); // Empty stat object

      const result = await preparePhotoPayload({
        imageUri: 'content://media/external/images/123',
      });

      // Should return uri as is (stripped of 'file://' which isn't there)
      expect(result.localFile?.path).toBe('content://media/external/images/123');
    });

    it('handles RNFS.stat errors gracefully and logs warning', async () => {
      (RNFS.stat as jest.Mock).mockRejectedValue(new Error('FS Error'));

      const result = await preparePhotoPayload({
        imageUri: 'content://broken/uri',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve content URI'),
        expect.any(Error)
      );
      // Fallback: returns the original uri
      expect(result.localFile?.path).toBe('content://broken/uri');
    });
  });

  describe('preparePhotoPayload (General Errors)', () => {
     it('catches unexpected errors in logic and returns existing remote url fallback', async () => {
        // Force an error inside the try block (e.g. mock implementation throw)
        // We simulate this by making resolveLocalImagePath fail hard (unhandled inside itself if it wasn't content uri)
        // OR simply pass an object that breaks string manipulation, but typescript prevents that.
        // We'll mock the internal helper indirectly by passing a path that might crash if logic wasn't robust,
        // but since logic is robust, let's force a crash via mocking a dependency used in the `try` block.

        // Let's spy on console.warn again just to be sure

        // We can create a scenario where `resolveLocalImagePath` fails for a normal string? No, it just replaces.
        // We can pass a `content://` uri and have RNFS throw something that *isn't caught*?
        // No, the inner catch handles RNFS.

        // To cover the OUTER catch block:
        // We mock inferContentType or similar if possible? No, not exported.
        // Best way: Modify execution flow or pass something that causes `path.split` to throw? (Can't on string)

        // Actually, `resolveLocalImagePath` is `async`. If we pass a content URI and RNFS.stat throws,
        // it catches internally and returns the URI.

        // To hit the OUTER catch, something else must fail.
        // Let's mock RNFS to throw a non-Error object that might bubble up?
        // Or better, let's verify coverage. The outer catch protects against unexpected runtime errors.
        // We can simulate an error by making `RNFS.stat` return a Promise that rejects,
        // AND somehow bypass the inner catch? No.

        // Strategy: We can't easily mock internal functions `resolveLocalImagePath`.
        // However, we can use `jest.mock` on `react-native-fs` to return a value that crashes `inferContentType`.
        // `originalFilepath` could be `undefined`, which is handled.
        // If `originalFilepath` is returned as a number (invalid type cast), `split` inside `inferContentType` would crash.

        (RNFS.stat as jest.Mock).mockResolvedValue({
           originalFilepath: 12345 // Invalid type to force crash
        });

        const result = await preparePhotoPayload({
           imageUri: 'content://crash/me',
           existingRemoteUrl: 'fallback-url'
        });

        expect(consoleSpy).toHaveBeenCalledWith(
           expect.stringContaining('Failed to prepare photo payload'),
           expect.any(Error) // split is not a function
        );

        expect(result).toEqual({
           remoteUrl: 'fallback-url',
           localFile: null
        });
     });
  });
});