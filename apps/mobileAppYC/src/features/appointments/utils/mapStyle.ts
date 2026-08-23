type Styler = Record<string, string | number>;

const r = (featureType: string, elementType: string, ...stylers: Styler[]) => ({
  featureType,
  elementType,
  stylers,
});

/**
 * Warm-bone map palette.
 *
 * The previous style was a cool blue-grey set - every surface measured R-B
 * negative (landscape -5, poi -10, highway fill -20, water -40) while every app
 * surface measures R-B positive (screen +11, inset +21, hairline +22). The map
 * therefore read as a different product embedded in the app.
 *
 * These values keep each feature's ORIGINAL LIGHTNESS, so the figure/ground
 * relationships that make a map legible are untouched - roads still sit lighter
 * than land, water and parks still sit darker. Only the hue moves, onto the
 * bone family. Water stays cool on purpose: it has to read as water.
 */
const MAP_LIGHT = {
  land: '#F7F5F1',
  landBuilt: '#F3F0EA',
  landNatural: '#EFF1E9',
  poi: '#F2EFE9',
  transit: '#F2EFE9',
  water: '#D2DEE7',
  park: '#DEE7D6',
  road: '#FFFFFF',
  arterial: '#FBFAF7',
  highway: '#F1EDE4',
  roadStroke: '#E9E4DB',
  labelMuted: '#7A7266',
  labelInk: '#302F2E',
  labelHalo: '#FFFFFF',
  highwayStroke: '#257BED',
  highwayLabel: '#1657C9',
  waterLabel: '#257BED',
  parkLabel: '#008F5D',
} as const;

/**
 * Espresso counterpart. Dark maps invert the figure/ground: land goes dark and
 * roads go LIGHTER than land, otherwise the road network disappears. Label
 * haloes flip to the dark ground for the same reason. Hues stay in the warm
 * bone family, and the accents move to their espresso token values, which are
 * the lighter tints - the light-theme blue and green are too dark to read here.
 */
const MAP_DARK = {
  land: '#2A241D',
  landBuilt: '#322B22',
  landNatural: '#2B2F26',
  poi: '#332C23',
  transit: '#332C23',
  water: '#1E2A33',
  park: '#2C3A2C',
  road: '#453C31',
  arterial: '#4E4437',
  highway: '#584B3C',
  roadStroke: '#40362B',
  labelMuted: '#A89E90',
  labelInk: '#E6DDD0',
  labelHalo: '#241F19',
  highwayStroke: '#8FB6F5',
  highwayLabel: '#8FB6F5',
  waterLabel: '#8FB6F5',
  parkLabel: '#2BBD86',
} as const;

type MapPalette = Record<keyof typeof MAP_LIGHT, string>;

const build = (MAP: MapPalette) => [
  r('landscape', 'geometry', {color: MAP.land}),
  r('landscape.man_made', 'geometry', {color: MAP.landBuilt}),
  r('landscape.natural', 'geometry', {color: MAP.landNatural}),
  r('water', 'geometry', {color: MAP.water}),
  r('water', 'labels.text.fill', {color: MAP.waterLabel}),
  r('road.local', 'geometry', {color: MAP.road}),
  r('road.local', 'geometry.stroke', {color: MAP.roadStroke}, {weight: 1}),
  r('road.arterial', 'geometry', {color: MAP.arterial}),
  r('road.arterial', 'geometry.stroke', {color: MAP.roadStroke}, {weight: 1}),
  r('road.arterial', 'labels.text.fill', {color: MAP.labelMuted}),
  r('road.highway', 'geometry', {color: MAP.highway}),
  r(
    'road.highway',
    'geometry.stroke',
    {color: MAP.highwayStroke},
    {weight: 1.5},
  ),
  r('road.highway', 'labels.text.fill', {color: MAP.highwayLabel}),
  r('road.highway', 'labels.text.stroke', {color: MAP.labelHalo}, {weight: 2}),
  r('poi', 'geometry', {color: MAP.poi}),
  r('poi', 'labels', {visibility: 'off'}),
  r('poi.park', 'geometry', {color: MAP.park}),
  r('poi.park', 'labels.text.fill', {color: MAP.parkLabel}),
  r('poi.park', 'labels', {visibility: 'simplified'}),
  r('transit', 'geometry', {color: MAP.transit}),
  r('transit.station', 'labels.text.fill', {color: MAP.labelMuted}),
  r('administrative', 'geometry.stroke', {color: MAP.roadStroke}, {weight: 1}),
  r('administrative.locality', 'labels.text.fill', {color: MAP.labelInk}),
  r('administrative.neighborhood', 'labels.text.fill', {color: MAP.labelMuted}),
  r('all', 'labels.text.fill', {color: MAP.labelInk}),
  r('all', 'labels.text.stroke', {color: MAP.labelHalo}, {weight: 2}),
];

export const YC_MAP_STYLE = build(MAP_LIGHT);
export const YC_MAP_STYLE_DARK = build(MAP_DARK);

/** Pick the map style matching the active theme. */
export const mapStyleFor = (isDark: boolean) =>
  isDark ? YC_MAP_STYLE_DARK : YC_MAP_STYLE;
