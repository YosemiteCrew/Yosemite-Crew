export const spacing = {
  '0': 0,
  '1': 4,
  '1.25': 5,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '4.5': 18,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '18': 72,
  '20': 80,
  '24': 96,
  '28': 112,
  '30': 120,
  '32': 128,
  '36': 144,
  '40': 160,
  '44': 176,
  '48': 192,
  '52': 208,
  '56': 224,
  '60': 240,
  '64': 256,
  '72': 288,
  '80': 320,
  '96': 384,
} as const;

export const borderRadius = {
  // Numeric t-shirt scale (kept stable for existing consumers).
  none: 0,
  xs: 16,
  sm: 16,
  base: 16,
  md: 16,
  lg: 16,
  xl: 16,
  '2xl': 16,
  '3xl': 16,
  full: 9999,
  // Warm-bone semantic radii (adopted by redesigned components / screens).
  field: 16,
  cardSmall: 18,
  card: 20,
  button: 18,
  sheet: 28,
  screen: 28,
  chip: 9999,
  pill: 9999,
} as const;

export const shadows = {
  none: {boxShadow: 'none' as const},
  xs: {boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' as const},
  sm: {boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' as const},
  base: {boxShadow: '0px 1px 6px rgba(0,0,0,0.1)' as const},
  md: {boxShadow: '0px 4px 6px rgba(0,0,0,0.15)' as const},
  floatingMd: {boxShadow: '0px 0px 12px rgba(0,0,0,0.18)' as const},
  lg: {boxShadow: '0px 10px 15px rgba(0,0,0,0.15)' as const},
  xl: {boxShadow: '0px 20px 25px rgba(0,0,0,0.25)' as const},
  // Warm-bone semantic elevation (see handoff "Elevation").
  card: {
    boxShadow:
      '0px 1px 2px rgba(29,28,27,0.03), 0px 8px 22px rgba(29,28,27,0.05)' as const,
  },
  screen: {
    boxShadow:
      '0px 2px 6px rgba(29,28,27,0.05), 0px 28px 70px rgba(29,28,27,0.10)' as const,
  },
  cta: {boxShadow: '0px 8px 22px rgba(29,28,27,0.16)' as const},
  companion: {boxShadow: '0px 4px 14px rgba(244,121,190,0.12)' as const},
  glassPill: {
    boxShadow:
      '0px 2px 4px rgba(29,28,27,0.05), 0px 12px 28px rgba(29,28,27,0.10)' as const,
  },
} as const;
