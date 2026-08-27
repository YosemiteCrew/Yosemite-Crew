// src/features/auth/utils/jwt.ts
//
// Base64url + JWT payload decoding that survives the Metro bundle.
//
// This deliberately uses neither `Buffer` nor `atob`. `Buffer` only exists as a
// Node builtin, and Metro's resolver has no `node:` protocol handling, so
// `import {Buffer} from 'node:buffer'` resolved to nothing on device. Because
// the React Native preset inlines requires, the dead require landed inside a
// `try {}` block, Metro classified it as an optional dependency, and the bundle
// shipped with a null dependency slot instead of failing the build. Every call
// then threw "Cannot find module", was swallowed by the catch, and every token
// looked like it had no expiry. `atob` is likewise not part of the React Native
// runtime contract, so this decodes by hand and depends on nothing.
//
// The bit twiddling is written as multiply/divide/modulo rather than <<, >> and
// & so it reads the same to the linter as to a person: these are byte
// boundaries, not clever bit tricks. Payloads are a few hundred bytes, so the
// arithmetic costs nothing measurable.

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const decodeBase64ToBytes = (input: string): number[] => {
  const bytes: number[] = [];
  // `buffer` holds `bits` not-yet-emitted bits, most significant first.
  let buffer = 0;
  let bits = 0;

  for (const char of input) {
    if (char === '=') {
      break;
    }

    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) {
      throw new Error(`Invalid base64 character: ${char}`);
    }

    buffer = buffer * 64 + value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      const divisor = 2 ** bits;
      bytes.push(Math.floor(buffer / divisor));
      buffer %= divisor;
    }
  }

  return bytes;
};

/** Read one UTF-8 continuation byte (10xxxxxx) and return its 6 payload bits. */
const continuation = (byte: number | undefined): number => {
  if (byte === undefined || Math.floor(byte / 64) !== 2) {
    throw new Error('Malformed UTF-8 sequence');
  }
  return byte % 64;
};

const decodeUtf8 = (bytes: number[]): string => {
  let result = '';
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index++];
    let codePoint: number;

    if (byte < 0x80) {
      codePoint = byte;
    } else if (byte >= 0xc2 && byte <= 0xdf) {
      codePoint = (byte % 32) * 64 + continuation(bytes[index++]);
    } else if (byte >= 0xe0 && byte <= 0xef) {
      codePoint =
        (byte % 16) * 4096 +
        continuation(bytes[index++]) * 64 +
        continuation(bytes[index++]);
    } else if (byte >= 0xf0 && byte <= 0xf4) {
      codePoint =
        (byte % 8) * 262144 +
        continuation(bytes[index++]) * 4096 +
        continuation(bytes[index++]) * 64 +
        continuation(bytes[index++]);
    } else {
      // 0x80-0xC1 and 0xF5-0xFF never start a valid sequence.
      throw new Error('Malformed UTF-8 sequence');
    }

    result += String.fromCodePoint(codePoint);
  }

  return result;
};

/**
 * Decode a base64url segment (the `-`/`_` alphabet, padding optional) into a
 * UTF-8 string. Throws on anything that is not well-formed.
 */
export const decodeBase64Url = (segment: string): string => {
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  return decodeUtf8(decodeBase64ToBytes(padded));
};

/**
 * Read the `exp` claim of a JWT and return it in milliseconds, or `undefined`
 * when the token is absent, malformed, or carries no numeric `exp`.
 */
export const decodeJwtExpiration = (token?: string): number | undefined => {
  if (!token) {
    return undefined;
  }

  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return undefined;
    }

    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as {
      exp?: number;
    };

    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  } catch (error) {
    console.warn('Failed to decode JWT expiration', error);
    return undefined;
  }
};
