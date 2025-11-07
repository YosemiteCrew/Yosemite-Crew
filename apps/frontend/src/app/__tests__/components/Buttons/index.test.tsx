import { Primary, Secondary } from "@/app/components/Buttons";
import PrimaryComponent from "@/app/components/Buttons/Primary";
import SecondaryComponent from "@/app/components/Buttons/Secondary";

describe("Buttons barrel file", () => {
  test("re-exports Primary and Secondary buttons", () => {
    expect(Primary).toBe(PrimaryComponent);
    expect(Secondary).toBe(SecondaryComponent);
  });
});
