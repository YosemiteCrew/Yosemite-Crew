import {
  buildCdnUrlFromKey,
  stripSlashes,
} from '../../src/shared/utils/cdnHelpers';

describe('cdnHelpers Utils', () => {
  // ---------------------------------------------------------------------------
  // 1. stripSlashes
  // ---------------------------------------------------------------------------
  describe('stripSlashes', () => {
    it('returns the original string if no slashes are present', () => {
      expect(stripSlashes('folder/file')).toBe('folder/file');
    });

    it('removes a single leading slash', () => {
      expect(stripSlashes('/folder/file')).toBe('folder/file');
    });

    it('removes multiple leading slashes', () => {
      expect(stripSlashes('///folder/file')).toBe('folder/file');
    });

    it('removes a single trailing slash', () => {
      expect(stripSlashes('folder/file/')).toBe('folder/file');
    });

    it('removes multiple trailing slashes', () => {
      expect(stripSlashes('folder/file///')).toBe('folder/file');
    });

    it('removes both leading and trailing slashes', () => {
      expect(stripSlashes('//folder/file//')).toBe('folder/file');
    });

    it('returns an empty string when input is only slashes', () => {
      expect(stripSlashes('///')).toBe('');
    });

    it('returns an empty string when input is empty', () => {
      expect(stripSlashes('')).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. buildCdnUrlFromKey
  // ---------------------------------------------------------------------------
  describe('buildCdnUrlFromKey', () => {
    // The base URL defined in the source file
    const EXPECTED_BASE = 'https://d2kyjiikho62xx.cloudfront.net';

    it('returns null if the key is null', () => {
      expect(buildCdnUrlFromKey(null)).toBeNull();
    });

    it('returns null if the key is undefined', () => {
      expect(buildCdnUrlFromKey(undefined)).toBeNull();
    });

    it('returns null if the key is an empty string', () => {
      expect(buildCdnUrlFromKey('')).toBeNull();
    });

    it('concatenates base and key correctly for a standard key', () => {
      const key = 'uploads/image.png';
      const result = buildCdnUrlFromKey(key);
      expect(result).toBe(`${EXPECTED_BASE}/${key}`);
    });

    it('handles keys with extra slashes by stripping them via stripSlashes', () => {
      const key = '//uploads/image.png/';
      const result = buildCdnUrlFromKey(key);
      // Leading/Trailing slashes removed, single slash added by join logic
      expect(result).toBe(`${EXPECTED_BASE}/uploads/image.png`);
    });

    it('does not encode special characters (verifies logic is pure string concatenation)', () => {
      const key = 'folder/my file.jpg';
      const result = buildCdnUrlFromKey(key);
      expect(result).toBe(`${EXPECTED_BASE}/folder/my file.jpg`);
    });
  });
});