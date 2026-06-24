export const PDF_PAGE_SIZE = {
  width: 595,
  height: 842,
} as const;

export const PDF_LAYOUT = {
  marginX: 20,
  // Logo left edge aligns with marginX so the letterhead lines up with the
  // header rule, metadata, tables and footer (all at marginX).
  headerLogo: {
    x: 20,
    y: 12,
    width: 44,
    height: 44,
  },
  headerOrgX: 78,
  headerOrgY: 16,
  headerContactX: 481,
  headerContactY: 16,
  // The header rule sits just below the org letterhead (logo ends at y60), so it
  // never cuts through the document title/metadata. Body content begins right
  // below it on every page — including continuation pages (no large top gap).
  headerSeparatorY: 70,
  titleY: 88,
  metadataY: 110,
  bodyStartY: 88,
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
