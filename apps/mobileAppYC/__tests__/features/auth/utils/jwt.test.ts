import {decodeBase64Url, decodeJwtExpiration} from '@/features/auth/utils/jwt';

/**
 * Build a base64url segment without leaning on Buffer, so the test exercises
 * the decoder rather than round-tripping the same implementation.
 */
const toBase64Url = (value: string): string => {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0) as number;
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 + Math.floor(codePoint / 64), 0x80 + (codePoint % 64));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 + Math.floor(codePoint / 4096),
        0x80 + (Math.floor(codePoint / 64) % 64),
        0x80 + (codePoint % 64),
      );
    } else {
      bytes.push(
        0xf0 + Math.floor(codePoint / 262144),
        0x80 + (Math.floor(codePoint / 4096) % 64),
        0x80 + (Math.floor(codePoint / 64) % 64),
        0x80 + (codePoint % 64),
      );
    }
  }

  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const triple = b0 * 65536 + (b1 ?? 0) * 256 + (b2 ?? 0);
    out += alphabet[Math.floor(triple / 262144)];
    out += alphabet[Math.floor(triple / 4096) % 64];
    out += b1 === undefined ? '' : alphabet[Math.floor(triple / 64) % 64];
    out += b2 === undefined ? '' : alphabet[triple % 64];
  }

  return out;
};

const buildJwt = (payload: Record<string, unknown>): string =>
  `${toBase64Url(JSON.stringify({alg: 'RS256'}))}.${toBase64Url(
    JSON.stringify(payload),
  )}.signature`;

describe('decodeBase64Url', () => {
  it.each([
    ['a'],
    ['ab'],
    ['abc'],
    ['abcd'],
    ['{"exp":1893456000}'],
    ['padding-length-one!'],
  ])('round-trips %p through every padding length', value => {
    expect(decodeBase64Url(toBase64Url(value))).toBe(value);
  });

  it('decodes the base64url alphabet, not plain base64', () => {
    // 0xFB 0xFF encodes to "-_8" in base64url and "+/8" in base64. A decoder
    // that forgot the substitution throws on the '-' and '_'.
    const value = JSON.stringify({name: 'Ünïcode ✓ 😺'});
    expect(decodeBase64Url(toBase64Url(value))).toBe(value);
  });

  it('accepts a segment that already carries padding', () => {
    expect(decodeBase64Url('YWJj')).toBe('abc');
    expect(decodeBase64Url('YWJjZA==')).toBe('abcd');
  });

  it('throws on a character outside the alphabet', () => {
    expect(() => decodeBase64Url('ab*d')).toThrow(/Invalid base64 character/);
  });

  it('throws on a truncated multi-byte UTF-8 sequence', () => {
    // 0xC3 announces a two byte sequence and then nothing follows.
    expect(() => decodeBase64Url('ww')).toThrow(/Malformed UTF-8/);
  });

  it('throws on a stray continuation byte', () => {
    // 0x80 is a continuation byte with no lead byte in front of it.
    expect(() => decodeBase64Url('gA')).toThrow(/Malformed UTF-8/);
  });
});

describe('decodeJwtExpiration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the exp claim in milliseconds', () => {
    const token = buildJwt({sub: 'user-1', exp: 1893456000});
    expect(decodeJwtExpiration(token)).toBe(1893456000 * 1000);
  });

  it('reads an exp claim from a payload containing non-ASCII text', () => {
    const token = buildJwt({name: 'Zoë 😺', exp: 1700000000});
    expect(decodeJwtExpiration(token)).toBe(1700000000 * 1000);
  });

  it('returns undefined for an absent token', () => {
    expect(decodeJwtExpiration(undefined)).toBeUndefined();
    expect(decodeJwtExpiration('')).toBeUndefined();
  });

  it('returns undefined when the token has no payload segment', () => {
    expect(decodeJwtExpiration('header-only')).toBeUndefined();
  });

  it('returns undefined when exp is missing or not a number', () => {
    expect(decodeJwtExpiration(buildJwt({sub: 'user-1'}))).toBeUndefined();
    expect(decodeJwtExpiration(buildJwt({exp: '1893456000'}))).toBeUndefined();
  });

  it('returns undefined and warns when the payload is not valid base64url', () => {
    expect(decodeJwtExpiration('header.not*base64.signature')).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to decode JWT expiration',
      expect.any(Error),
    );
  });

  it('returns undefined and warns when the payload is not JSON', () => {
    expect(
      decodeJwtExpiration(`header.${toBase64Url('not json')}.signature`),
    ).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('decodes a realistic SuperTokens access token payload', () => {
    // A payload long enough to exercise the 12-bit carry across many groups.
    const token = buildJwt({
      iat: 1893452400,
      exp: 1893456000,
      sub: '0f4a1b2c-3d4e-4f50-8a1b-2c3d4e5f6071',
      sessionHandle: '9c8b7a65-4321-4fed-9876-543210fedcba',
      refreshTokenHash1: 'a'.repeat(64),
      parentRefreshTokenHash1: null,
      antiCsrfToken: null,
      tId: 'public',
      rsub: '0f4a1b2c-3d4e-4f50-8a1b-2c3d4e5f6071',
    });

    expect(decodeJwtExpiration(token)).toBe(1893456000 * 1000);
  });
});
