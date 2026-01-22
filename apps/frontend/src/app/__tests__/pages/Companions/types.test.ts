import {
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
  FilterOption,
  StatusOption,
} from "@/app/pages/Companions/types";

describe("Companions types", () => {
  it("exposes species filter options", () => {
    const keys = CompanionsSpeciesFilters.map((item: FilterOption) => item.key);

    expect(keys).toEqual(["all", "dog", "horse", "cat", "other"]);
    expect(CompanionsSpeciesFilters[0].name).toBe("All");
  });

  it("exposes status filters with colors", () => {
    const statusKeys = CompanionsStatusFilters.map(
      (item: StatusOption) => item.key
    );

    expect(statusKeys).toEqual(["all", "active", "inactive", "archived"]);
    CompanionsStatusFilters.forEach((item) => {
      expect(item.bg).toBeTruthy();
      expect(item.text).toBeTruthy();
    });
  });
});
