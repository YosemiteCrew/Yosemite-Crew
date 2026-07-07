import {
  compactParams,
  cursorParam,
  isoDateTimeParam,
  limitParam,
  uuidParam,
} from '../src/params.js';
import { SAMPLE_UUID } from './helpers.js';

describe('limitParam', () => {
  it('defaults to 50 and enforces the 1-100 window', () => {
    expect(limitParam.parse(undefined)).toBe(50);
    expect(limitParam.parse(1)).toBe(1);
    expect(limitParam.parse(100)).toBe(100);
    expect(limitParam.safeParse(0).success).toBe(false);
    expect(limitParam.safeParse(101).success).toBe(false);
    expect(limitParam.safeParse(2.5).success).toBe(false);
  });
});

describe('cursorParam', () => {
  it('is optional but rejects empty strings', () => {
    expect(cursorParam.parse(undefined)).toBeUndefined();
    expect(cursorParam.parse('eyJpZCI6...')).toBe('eyJpZCI6...');
    expect(cursorParam.safeParse('').success).toBe(false);
  });
});

describe('isoDateTimeParam', () => {
  const schema = isoDateTimeParam('a timestamp');

  it('accepts ISO 8601 timestamps with offsets or Z', () => {
    expect(schema.safeParse('2026-07-01T00:00:00+00:00').success).toBe(true);
    expect(schema.safeParse('2026-07-01T00:00:00Z').success).toBe(true);
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('rejects date-only strings and prose', () => {
    expect(schema.safeParse('2026-07-01').success).toBe(false);
    expect(schema.safeParse('yesterday').success).toBe(false);
  });

  it('carries the provided description', () => {
    expect(schema.description).toBe('a timestamp');
  });
});

describe('uuidParam', () => {
  const schema = uuidParam('The widget ID');

  it('accepts UUIDs and rejects other strings', () => {
    expect(schema.safeParse(SAMPLE_UUID).success).toBe(true);
    expect(schema.safeParse('not-a-uuid').success).toBe(false);
    expect(schema.safeParse('').success).toBe(false);
  });

  it('carries the provided description', () => {
    expect(schema.description).toBe('The widget ID');
  });
});

describe('compactParams', () => {
  it('drops undefined values and keeps everything else', () => {
    expect(
      compactParams({ limit: 50, cursor: undefined, status: 'PAID', flag: false, zero: 0 })
    ).toEqual({ limit: 50, status: 'PAID', flag: false, zero: 0 });
  });

  it('returns an empty object when every value is undefined', () => {
    expect(compactParams({ a: undefined, b: undefined })).toEqual({});
  });
});
