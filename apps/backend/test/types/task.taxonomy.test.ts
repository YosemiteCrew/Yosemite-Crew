import {
  TASK_CATEGORY_TAXONOMY,
  TASK_KIND_TAXONOMY,
} from "@yosemite-crew/types";

describe("task taxonomy", () => {
  it("exposes the expected task categories", () => {
    expect(TASK_CATEGORY_TAXONOMY).toEqual([
      "MEDICATION",
      "CARE",
      "DIET",
      "PROCEDURE",
      "DIAGNOSTIC",
      "COMMUNICATION",
      "BILLING",
      "RECORD",
      "ADMIN",
      "CUSTOM",
    ]);
  });

  it("exposes the expected task kinds", () => {
    expect(TASK_KIND_TAXONOMY).toEqual([
      "MEDICATION",
      "OBSERVATION_TOOL",
      "HYGIENE",
      "DIET",
      "CUSTOM",
    ]);
  });
});
