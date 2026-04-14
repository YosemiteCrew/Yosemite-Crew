/**
 * Spacing scale tokens — shared across web and mobile.
 * Values are in rem for web; mobile maps key to px by multiplying by 16.
 * The key represents the t-shirt / numeric step name used in design specs.
 */

export const spacing = {
  '0': '0rem',
  '1': '0.25rem', // 4px
  '1.25': '0.3125rem', // 5px
  '2': '0.5rem', // 8px
  '2.5': '0.625rem', // 10px
  '3': '0.75rem', // 12px
  '3.5': '0.875rem', // 14px
  '4': '1rem', // 16px
  '4.5': '1.125rem', // 18px
  '5': '1.25rem', // 20px
  '6': '1.5rem', // 24px
  '7': '1.75rem', // 28px
  '8': '2rem', // 32px
  '9': '2.25rem', // 36px
  '10': '2.5rem', // 40px
  '11': '2.75rem', // 44px
  '12': '3rem', // 48px
  '14': '3.5rem', // 56px
  '16': '4rem', // 64px
  '18': '4.5rem', // 72px
  '20': '5rem', // 80px
  '24': '6rem', // 96px
  '28': '7rem', // 112px
  '32': '8rem', // 128px
  '36': '9rem', // 144px
  '40': '10rem', // 160px
  '48': '12rem', // 192px
  '64': '16rem', // 256px
  '80': '20rem', // 320px
  '96': '24rem', // 384px
} as const;

/**
 * Semantic spacing roles that map to spacing scale values.
 * Prefer using semantic roles in components when possible.
 */
export const spacingRole = {
  componentPaddingXDefault: spacing['6'], // px-6
  componentPaddingXCompact: spacing['4'], // px-4
  componentPaddingXLarge: spacing['8'], // px-8
  componentPaddingYDefault: spacing['3'], // py-3
  componentPaddingYCompact: spacing['2'], // py-2
  buttonPaddingX: spacing['8'], // px-8
  buttonPaddingYDefault: '0.75rem', // py-3 / 12px
  buttonPaddingYLarge: '0.9375rem', // 15px
  cardPadding: spacing['4'], // p-4
  inputPadding: spacing['3'], // p-3
  sectionGap: spacing['6'], // gap-6
  itemGap: spacing['2.5'], // gap-2.5
  inlineGap: spacing['2'], // gap-2
} as const;

export type SpacingToken = typeof spacing;
