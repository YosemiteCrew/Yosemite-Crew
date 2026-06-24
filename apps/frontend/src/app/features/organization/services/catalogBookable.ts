import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';

/** A breakdown is bookable if any item (recursively) is flagged bookable. */
export const hasBookableBreakdownItem = (items: PackageBreakdownItem[]): boolean =>
  items.some((item) => item.isBookable || hasBookableBreakdownItem(item.nestedBreakdown ?? []));

/** A breakdown prefers inpatient if any item (recursively) is flagged inpatient. */
export const hasInpatientBreakdownItem = (items: PackageBreakdownItem[]): boolean =>
  items.some(
    (item) => item.isInpatientPreferred || hasInpatientBreakdownItem(item.nestedBreakdown ?? [])
  );

/** Count breakdown items that resolve to a bookable product, treating each item once. */
export const countBookableBreakdownItems = (items: PackageBreakdownItem[]): number =>
  items.reduce(
    (count, item) =>
      item.isBookable || hasBookableBreakdownItem(item.nestedBreakdown ?? []) ? count + 1 : count,
    0
  );
