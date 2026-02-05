import { GenderOptions } from "@/app/features/users/types/profile";

describe("profile types", () => {
  it("exposes gender options", () => {
    expect(GenderOptions).toEqual(["MALE", "FEMALE", "OTHER"]);
  });
});
