import {describeStaleness} from '@/shared/utils/staleness';

const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('describeStaleness', () => {
  it('reports "just now" under a minute', () => {
    expect(describeStaleness(NOW, NOW)).toEqual({
      key: 'common.stale_updated_just_now',
    });
    expect(describeStaleness(NOW - (MINUTE - 1), NOW)).toEqual({
      key: 'common.stale_updated_just_now',
    });
  });

  it('reports whole minutes below an hour', () => {
    expect(describeStaleness(NOW - MINUTE, NOW)).toEqual({
      key: 'common.stale_updated_minutes',
      count: 1,
    });
    expect(describeStaleness(NOW - 59 * MINUTE, NOW)).toEqual({
      key: 'common.stale_updated_minutes',
      count: 59,
    });
  });

  it('reports whole hours below a day', () => {
    expect(describeStaleness(NOW - HOUR, NOW)).toEqual({
      key: 'common.stale_updated_hours',
      count: 1,
    });
    expect(describeStaleness(NOW - 23 * HOUR, NOW)).toEqual({
      key: 'common.stale_updated_hours',
      count: 23,
    });
  });

  it('reports whole days beyond that', () => {
    expect(describeStaleness(NOW - DAY, NOW)).toEqual({
      key: 'common.stale_updated_days',
      count: 1,
    });
    expect(describeStaleness(NOW - 400 * DAY, NOW)).toEqual({
      key: 'common.stale_updated_days',
      count: 400,
    });
  });

  // "never successfully fetched" is a different statement from "fetched a long
  // time ago" and gets its own copy rather than a misleading huge count.
  it('reports the unknown case when there is no timestamp', () => {
    expect(describeStaleness(undefined, NOW)).toEqual({
      key: 'common.stale_updated_unknown',
    });
    expect(describeStaleness(Number.NaN, NOW)).toEqual({
      key: 'common.stale_updated_unknown',
    });
    expect(describeStaleness(Infinity, NOW)).toEqual({
      key: 'common.stale_updated_unknown',
    });
  });

  // Clock skew, or a device whose time moved backwards: never render a
  // negative count.
  it('treats a future timestamp as just now', () => {
    expect(describeStaleness(NOW + DAY, NOW)).toEqual({
      key: 'common.stale_updated_just_now',
    });
  });

  it('defaults to the current clock', () => {
    expect(describeStaleness(Date.now())).toEqual({
      key: 'common.stale_updated_just_now',
    });
  });
});
