import {
  Companion,
  CompanionRequestDTO,
  Parent,
  ParentRequestDTO,
} from "@yosemite-crew/types";

export type StoredParent = Parent & {
  id: string;
};

export type StoredCompanion = Companion & {
  id: string;
  organisationId: string;
  parentId: string;
};

export type CompanionParent = {
  companion: StoredCompanion;
  parent: StoredParent;
};

export type RequestCompanion = {
  companion: CompanionRequestDTO;
  parent: ParentRequestDTO;
};

export type GetCompanionResponse = RequestCompanion[];

export type FilterOption = {
  name: string;
  key: string;
};

export type StatusOption = FilterOption & {
  bg?: string;
  text?: string;
};

export const CompanionsSpeciesFilters: FilterOption[] = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Dog",
    key: "dog",
  },
  {
    name: "Horse",
    key: "horse",
  },
  {
    name: "Cat",
    key: "cat",
  },
  {
    name: "Other",
    key: "other",
  },
];

export const CompanionsStatusFilters: StatusOption[] = [
  {
    name: "All",
    key: "all",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Active",
    key: "active",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Inactive",
    key: "inactive",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Archived",
    key: "archived",
    bg: "#747283",
    text: "#fff",
  },
];
