import type {VetBusiness} from '../types';

export interface ClinicMapItem {
  type: 'clinic';
  clinic: VetBusiness;
}

export interface ClusterMapItem {
  type: 'cluster';
  id: string;
  lat: number;
  lng: number;
  count: number;
}

export type MapItem = ClinicMapItem | ClusterMapItem;
const CLUSTER_LAT_DELTA_THRESHOLD = 0.08;
const GRID_DIVISIONS = 5;
export const clusterClinics = (
  clinics: VetBusiness[],
  latitudeDelta: number,
): MapItem[] => {
  if (latitudeDelta < CLUSTER_LAT_DELTA_THRESHOLD || clinics.length < 2) {
    return clinics.map(c => ({type: 'clinic', clinic: c}));
  }

  const cellSize = latitudeDelta / GRID_DIVISIONS;
  const cells = new Map<string, VetBusiness[]>();

  for (const clinic of clinics) {
    if (clinic.lat == null || clinic.lng == null) continue;
    const row = Math.floor(clinic.lat / cellSize);
    const col = Math.floor(clinic.lng / cellSize);
    const key = `${row}:${col}`;
    const group = cells.get(key) ?? [];
    group.push(clinic);
    cells.set(key, group);
  }

  const result: MapItem[] = [];
  for (const [key, group] of cells.entries()) {
    if (group.length === 1) {
      result.push({type: 'clinic', clinic: group[0]});
    } else {
      const lat =
        group.reduce((sum, c) => sum + (c.lat ?? 0), 0) / group.length;
      const lng =
        group.reduce((sum, c) => sum + (c.lng ?? 0), 0) / group.length;
      result.push({
        type: 'cluster',
        id: `cluster_${key}`,
        lat,
        lng,
        count: group.length,
      });
    }
  }
  return result;
};
