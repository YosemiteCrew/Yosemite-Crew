import {colors} from '@/theme';
type Styler = Record<string, string | number>;

const r = (featureType: string, elementType: string, ...stylers: Styler[]) => ({
  featureType,
  elementType,
  stylers,
});

export const YC_MAP_STYLE = [
  r('landscape', 'geometry', {color: '#F5F7FA'}),
  r('landscape.man_made', 'geometry', {color: '#F0F4FA'}),
  r('landscape.natural', 'geometry', {color: '#EDF4EE'}),
  r('water', 'geometry', {color: '#C8DCF0'}),
  r('water', 'labels.text.fill', {color: colors.blue}),
  r('road.local', 'geometry', {color: colors.white}),
  r('road.local', 'geometry.stroke', {color: '#EAEAEA'}, {weight: 1}),
  r('road.arterial', 'geometry', {color: '#F5F8FF'}),
  r('road.arterial', 'geometry.stroke', {color: '#D4E3F8'}, {weight: 1}),
  r('road.arterial', 'labels.text.fill', {color: '#747473'}),
  r('road.highway', 'geometry', {color: '#E9F2FD'}),
  r('road.highway', 'geometry.stroke', {color: colors.blue}, {weight: 1.5}),
  r('road.highway', 'labels.text.fill', {color: '#1A5FBD'}),
  r('road.highway', 'labels.text.stroke', {color: colors.white}, {weight: 2}),
  r('poi', 'geometry', {color: '#EEF2F8'}),
  r('poi', 'labels', {visibility: 'off'}),
  r('poi.park', 'geometry', {color: '#D4EDDA'}),
  r('poi.park', 'labels.text.fill', {color: colors.success}),
  r('poi.park', 'labels', {visibility: 'simplified'}),
  r('transit', 'geometry', {color: '#E9F2FD'}),
  r('transit.station', 'labels.text.fill', {color: '#747473'}),
  r('administrative', 'geometry.stroke', {color: '#EAEAEA'}, {weight: 1}),
  r('administrative.locality', 'labels.text.fill', {color: colors.inkBody}),
  r('administrative.neighborhood', 'labels.text.fill', {color: '#747473'}),
  r('all', 'labels.text.fill', {color: colors.inkBody}),
  r('all', 'labels.text.stroke', {color: colors.white}, {weight: 2}),
];
