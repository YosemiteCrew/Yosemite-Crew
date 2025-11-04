import type {RootState} from '@/app/store';

export const selectLinkedBusinesses = (state: RootState) =>
  state.linkedBusinesses.linkedBusinesses;

export const selectLinkedBusinessesByCategory = (category: string) => (state: RootState) =>
  state.linkedBusinesses.linkedBusinesses.filter(b => b.category === category);

export const selectLinkedBusinessesByCompanion = (companionId: string) => (state: RootState) =>
  state.linkedBusinesses.linkedBusinesses.filter(b => b.companionId === companionId);

export const selectLinkedBusinessesLoading = (state: RootState) =>
  state.linkedBusinesses.loading;

export const selectLinkedBusinessesError = (state: RootState) =>
  state.linkedBusinesses.error;

export const selectSelectedCategory = (state: RootState) =>
  state.linkedBusinesses.selectedCategory;
