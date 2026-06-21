export const PDF_PAGE_SIZE = {
  width: 595,
  height: 842,
} as const;

export const PDF_LAYOUT = {
  marginX: 20,
  headerLogo: {
    x: 12,
    y: 12,
    width: 64,
    height: 48,
  },
  headerOrgX: 84,
  headerOrgY: 16,
  headerContactX: 481,
  headerContactY: 16,
  headerSeparatorY: 160,
  titleY: 89,
  metadataY: 111,
  bodyStartY: 184,
  footerSeparatorY: 781,
  footerTextY: 793,
  footerTimestampY: 819,
  pageNumberX: 575,
} as const;

export const PDF_COLORS = {
  text: '#302F2E',
  muted: '#5C5956',
  border: '#D6D1CD',
  panel: '#FAF8F6',
  brand: '#302F2E',
  brandDark: '#302F2E',
  success: '#1E7A4C',
} as const;

export const PDF_FONT_SIZES = {
  headerOrg: 12,
  headerContact: 10,
  title: 14,
  metadataLabel: 10,
  metadataValue: 10,
  sectionTitle: 11,
  body: 10,
  footer: 10,
  pageNumber: 10,
  small: 10,
} as const;

export const PDF_SPACING = {
  contentTopGap: 24,
  contentBottomGap: 0,
  sectionGap: 24,
  paragraphGap: 8,
  itemGap: 2,
  tableCellPaddingX: 8,
  tableCellPaddingY: 6,
} as const;
