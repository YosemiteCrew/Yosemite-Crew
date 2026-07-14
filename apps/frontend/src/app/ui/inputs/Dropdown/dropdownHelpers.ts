export const DROPDOWN_MAX_HEIGHT = 200;
export const DROPDOWN_MIN_HEIGHT = 72;

/** Wrap the active option index when navigating with the arrow keys. */
export const wrapActiveIndex = (current: number, optionCount: number, delta: 1 | -1): number => {
  if (delta === 1) return current + 1 >= optionCount ? 0 : current + 1;
  return current <= 0 ? optionCount - 1 : current - 1;
};

export type DropdownOption = { key: string | number; label: string; value: string };
