import {
  buildInspectionObligations,
  getNextProgrammeReviewDueOn,
} from '@/app/features/animalWelfare/utils/inspectionClock';

describe('inspection clock', () => {
  describe('getNextProgrammeReviewDueOn', () => {
    it('sets the next review six calendar months after the completed review', () => {
      expect(getNextProgrammeReviewDueOn('2026-01-15')).toBe('2026-07-15');
    });

    it('clips end-of-month reviews to the final day of the due month', () => {
      expect(getNextProgrammeReviewDueOn('2025-08-31')).toBe('2026-02-28');
      expect(getNextProgrammeReviewDueOn('2023-08-31')).toBe('2024-02-29');
    });

    it.each(['', '2026-02-30', '01/15/2026'])('rejects invalid date-only value %p', (value) => {
      expect(getNextProgrammeReviewDueOn(value)).toBeNull();
    });
  });

  describe('buildInspectionObligations', () => {
    it('opens an obligation after the six-month review due date', () => {
      expect(
        buildInspectionObligations({
          lastProgrammeReviewCompletedOn: '2026-01-15',
          deficiencies: [],
          asOf: '2026-07-16',
        })
      ).toEqual([{ kind: 'PROGRAMME_REVIEW', dueOn: '2026-07-15' }]);
    });

    it('does not mark a review overdue on its due date', () => {
      expect(
        buildInspectionObligations({
          lastProgrammeReviewCompletedOn: '2026-01-15',
          deficiencies: [],
          asOf: '2026-07-15',
        })
      ).toEqual([]);
    });

    it('includes only open significant deficiencies past their correction date', () => {
      expect(
        buildInspectionObligations({
          lastProgrammeReviewCompletedOn: '2026-06-01',
          asOf: '2026-10-04',
          deficiencies: [
            {
              id: 'significant-overdue',
              classification: 'SIGNIFICANT',
              correctionDueOn: '2026-09-30',
            },
            {
              id: 'significant-corrected',
              classification: 'SIGNIFICANT',
              correctionDueOn: '2026-09-29',
              correctedOn: '2026-09-28',
            },
            { id: 'minor-overdue', classification: 'MINOR', correctionDueOn: '2026-09-01' },
            {
              id: 'significant-upcoming',
              classification: 'SIGNIFICANT',
              correctionDueOn: '2026-10-05',
            },
          ],
        })
      ).toEqual([
        {
          kind: 'SIGNIFICANT_DEFICIENCY',
          dueOn: '2026-09-30',
          deficiencyId: 'significant-overdue',
        },
      ]);
    });

    it('orders open obligations by due date', () => {
      expect(
        buildInspectionObligations({
          lastProgrammeReviewCompletedOn: '2026-01-15',
          asOf: '2026-10-04',
          deficiencies: [
            { id: 'later', classification: 'SIGNIFICANT', correctionDueOn: '2026-09-30' },
            { id: 'earlier', classification: 'SIGNIFICANT', correctionDueOn: '2026-06-01' },
          ],
        })
      ).toEqual([
        {
          kind: 'SIGNIFICANT_DEFICIENCY',
          dueOn: '2026-06-01',
          deficiencyId: 'earlier',
        },
        { kind: 'PROGRAMME_REVIEW', dueOn: '2026-07-15' },
        {
          kind: 'SIGNIFICANT_DEFICIENCY',
          dueOn: '2026-09-30',
          deficiencyId: 'later',
        },
      ]);
    });

    it('returns no obligations when the reference date is invalid', () => {
      expect(
        buildInspectionObligations({
          lastProgrammeReviewCompletedOn: '2026-01-15',
          deficiencies: [],
          asOf: 'not-a-date',
        })
      ).toEqual([]);
    });
  });
});
