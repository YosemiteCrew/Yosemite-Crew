import { GenderOptions } from "@/app/types/profile";

describe("profile types", () => {
  it("exposes gender options", () => {
    expect(GenderOptions).toEqual(["MALE", "FEMALE", "OTHER"]);
  });
});
