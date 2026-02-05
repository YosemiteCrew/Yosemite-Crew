import { Primary, Secondary } from "@/app/ui/primitives/Buttons";
import PrimaryComponent from "@/app/ui/primitives/Buttons/Primary";
import SecondaryComponent from "@/app/ui/primitives/Buttons/Secondary";

describe("Buttons barrel file", () => {
  test("re-exports Primary and Secondary buttons", () => {
    expect(Primary).toBe(PrimaryComponent);
    expect(Secondary).toBe(SecondaryComponent);
  });
});
