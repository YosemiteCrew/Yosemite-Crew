jest.mock(
  "virtual-test.css",
  () => ({
    active: "active-class-123",
    container: "container-class-456",
  }),
  { virtual: true }
);

import styles from "virtual-test.css";

describe("Global Type Definitions (globals.d.ts)", () => {
  it("should allow importing .css files as a key-value object", () => {

    expect(styles).toBeDefined();
    expect(styles.active).toBe("active-class-123");
    expect(styles.container).toBe("container-class-456");
  });
});