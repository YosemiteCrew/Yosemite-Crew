import { getOrganizationStatusStyle } from '@/app/ui/tables/tableUtils';

describe('getOrganizationStatusStyle', () => {
  /* The two pill inks are the 800/900 members of their ramps, not the mid-ramp
     fills. Measured on the deployed organization list, --color-success-400 on
     --color-success-100 was 2.23:1 and --color-warning-600 on --color-warning-100
     was 2.32:1, against a 4.5 bar. The ink members clear 6.23 and 6.42 on those
     same tints. This is the same fill-as-ink pair already corrected in
     paymentStatus.ts for the Paid/Unpaid line. */
  it("returns the success INK style for 'Active' (case insensitive)", () => {
    const expected = {
      color: 'var(--success-text)',
      backgroundColor: 'var(--color-success-100)',
    };
    expect(getOrganizationStatusStyle('Active')).toEqual(expected);
    expect(getOrganizationStatusStyle('active')).toEqual(expected);
  });

  it("returns the warning INK style for 'Pending'", () => {
    expect(getOrganizationStatusStyle('Pending')).toEqual({
      color: 'var(--color-warning-900)',
      backgroundColor: 'var(--color-warning-100)',
    });
  });

  it('returns the default style for an unknown status', () => {
    expect(getOrganizationStatusStyle('Unknown')).toEqual({
      color: 'var(--color-pill-neutral-text)',
      backgroundColor: 'var(--color-pill-neutral-bg)',
    });
  });
});
