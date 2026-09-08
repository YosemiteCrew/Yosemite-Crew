import { test, expect } from '@playwright/test';
import {
  contradictoryStateViolations,
  isReportableConsoleError,
  countMismatchViolations,
  duplicateHeadingViolations,
  placeholderValueViolations,
  rawEnumViolations,
  rawIdViolations,
  staleForwardLookingViolations,
  throttleDelayMs,
} from './support/pageInvariants';

/**
 * The checkers are tested against the ACTUAL defects observed on the deployed
 * app, and against the near-misses that must not trip them. A rule that fires on
 * ordinary product vocabulary gets switched off within a week, so the negative
 * cases matter as much as the positive ones.
 */

test.describe('raw enums', () => {
  test('catches the value seen on the patient history', () => {
    expect(rawEnumViolations(['PARENT_TASK'])).toHaveLength(1);
    expect(rawEnumViolations(['OUT_OF_STOCK', 'LOW_STOCK'])).toHaveLength(2);
  });

  test('does not fire on this product vocabulary', () => {
    // Real strings from the PIMS: vaccine, standard, controlled-drug schedule,
    // blood group. Every one is legitimately upper case with no underscore.
    expect(rawEnumViolations(['DHPP', 'FHIR', 'DEA', 'NSAID', 'ABC', 'PDF'])).toHaveLength(0);
  });

  test('does not fire on a humanised label', () => {
    expect(rawEnumViolations(['Out of stock', 'Parent task', 'Low stock'])).toHaveLength(0);
  });
});

test.describe('raw identifiers', () => {
  test('catches the patient id printed on the overview', () => {
    const found = rawIdViolations(['Patient ID: 6971e5d25934bff94ee07942']);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toBe('6971e5d25934bff94ee07942');
  });

  test('does not fire on a microchip number or a short hex code', () => {
    expect(rawIdViolations(['Microchip ID: 1234', 'colour #a1b2c3'])).toHaveLength(0);
  });
});

test.describe('unformatted values', () => {
  test('catches what a missing format leaves behind', () => {
    expect(placeholderValueViolations(['undefined 114.00'])).toHaveLength(1);
    expect(placeholderValueViolations(['Total: NaN'])).toHaveLength(1);
    expect(placeholderValueViolations(['[object Object]'])).toHaveLength(1);
  });

  test('does not fire on the words inside ordinary copy', () => {
    // "undefined" as a substring of prose, not as a rendered value.
    expect(placeholderValueViolations(['This field is currently undefinedish'])).toHaveLength(0);
    expect(placeholderValueViolations(['Nandina is not toxic'])).toHaveLength(0);
  });
});

test.describe('duplicate headings', () => {
  test('catches Check-in board nested inside Front desk', () => {
    const found = duplicateHeadingViolations(['Front desk', 'Check-in board', 'Check-in board']);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('check-in board');
  });

  test('is case insensitive, because a reader cannot tell them apart', () => {
    expect(duplicateHeadingViolations(['Board', 'board'])).toHaveLength(1);
  });

  test('does not fire on distinct headings', () => {
    expect(duplicateHeadingViolations(['Waitlist', 'Front desk', 'Board'])).toHaveLength(0);
  });
});

test.describe('contradictory panel state', () => {
  test('catches the problem list showing an error AND an empty state', () => {
    const found = contradictoryStateViolations([
      { name: 'Problem list', hasError: true, hasEmptyState: true },
    ]);
    expect(found).toHaveLength(1);
  });

  test('does not fire when a panel shows exactly one of them', () => {
    expect(
      contradictoryStateViolations([
        { name: 'Allergies', hasError: true, hasEmptyState: false },
        { name: 'Patient flags', hasError: false, hasEmptyState: true },
      ])
    ).toHaveLength(0);
  });
});

test.describe('count mismatch', () => {
  test('catches 0 items below reorder point above a Low stock panel of 21', () => {
    const found = countMismatchViolations([
      {
        label: 'items below reorder point',
        sources: [
          { where: 'page header', value: 0 },
          { where: 'Low stock panel', value: 21 },
        ],
      },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('page header=0');
    expect(found[0].detail).toContain('Low stock panel=21');
  });

  test('does not fire when both sources agree', () => {
    expect(
      countMismatchViolations([
        { label: 'low stock', sources: [{ where: 'header', value: 21 }, { where: 'panel', value: 21 }] },
      ])
    ).toHaveLength(0);
  });
});

test.describe('past dates in forward-looking sections', () => {
  test('catches 222 DAYS AGO under Expiring soon', () => {
    const found = staleForwardLookingViolations([
      { section: 'Expiring soon', label: 'dsdsd', daysFromNow: -222 },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('222 days in the past');
  });

  test('does not fire on a past date in a section that does not promise the future', () => {
    expect(
      staleForwardLookingViolations([{ section: 'Expired', label: 'x', daysFromNow: -222 }])
    ).toHaveLength(0);
  });

  test('does not fire on a future date under Expiring soon', () => {
    expect(
      staleForwardLookingViolations([{ section: 'Expiring soon', label: 'y', daysFromNow: 14 }])
    ).toHaveLength(0);
  });
});

test.describe('console noise', () => {
  test('ignores rate limiting the sweep caused itself', () => {
    expect(
      isReportableConsoleError(
        'Failed to load resource: the server responded with a status of 429 (Too Many Requests)'
      )
    ).toBe(false);
  });

  test('still reports a genuine application error', () => {
    expect(isReportableConsoleError("TypeError: Cannot read properties of undefined")).toBe(true);
    expect(
      isReportableConsoleError('Failed to load resource: the server responded with a status of 500')
    ).toBe(true);
  });
});

test.describe('rate-limit throttling', () => {
  const NOW = 1_700_000_000_000;

  test('does not wait while the API reports headroom', () => {
    expect(throttleDelayMs({ remaining: 400, resetAtMs: NOW + 60_000, now: NOW })).toBe(0);
  });

  test('does not wait before any response has been seen', () => {
    // The first navigation has no headers yet; blocking on that would add a
    // delay to every run for no reason.
    expect(throttleDelayMs({ now: NOW })).toBe(0);
  });

  test('waits exactly until the window resets when the budget is nearly spent', () => {
    expect(throttleDelayMs({ remaining: 5, resetAtMs: NOW + 42_000, now: NOW })).toBe(42_000);
  });

  test('never returns a negative wait once the reset has passed', () => {
    expect(throttleDelayMs({ remaining: 0, resetAtMs: NOW - 10_000, now: NOW })).toBe(0);
  });

  test('does not guess a wait when the budget is low but no reset was reported', () => {
    // Waiting on a duration nobody told us costs time on every route for no
    // reason. Without a reset the only honest answer is not to wait.
    expect(throttleDelayMs({ remaining: 1, now: NOW })).toBe(0);
  });

  test('respects the low-water mark it is given', () => {
    expect(throttleDelayMs({ remaining: 50, resetAtMs: NOW + 1_000, now: NOW, lowWater: 10 })).toBe(0);
    expect(throttleDelayMs({ remaining: 50, resetAtMs: NOW + 1_000, now: NOW, lowWater: 100 })).toBe(1_000);
  });
});
