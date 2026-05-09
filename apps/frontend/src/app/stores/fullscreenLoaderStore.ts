import { create } from 'zustand';

type FullscreenLoaderState = {
  activeSources: Record<string, true>;
  show: (source: string) => void;
  hide: (source: string) => void;
};

export const useFullscreenLoaderStore = create<FullscreenLoaderState>((set) => ({
  activeSources: {},
  show: (source) =>
    set((state) => ({
      activeSources: {
        ...state.activeSources,
        [source]: true,
      },
    })),
  hide: (source) =>
    set((state) => {
      if (!state.activeSources[source]) return state;
      const nextSources = { ...state.activeSources };
      delete nextSources[source];
      return { activeSources: nextSources };
    }),
}));
