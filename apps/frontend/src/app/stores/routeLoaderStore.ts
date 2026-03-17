import { create } from 'zustand';

type RouteLoaderState = {
  isLoading: boolean;
  start: () => void;
  stop: () => void;
};

export const useRouteLoaderStore = create<RouteLoaderState>((set) => ({
  isLoading: false,
  start: () => set({ isLoading: true }),
  stop: () => set({ isLoading: false }),
}));
