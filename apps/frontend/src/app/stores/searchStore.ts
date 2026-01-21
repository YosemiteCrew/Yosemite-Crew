import { create } from "zustand";

type SearchState = {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  clear: () => set({ query: "" }),
}));
