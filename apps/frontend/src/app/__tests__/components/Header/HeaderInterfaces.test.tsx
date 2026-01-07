import { NavItem } from "@/app/components/Header/HeaderInterfaces";

describe("HeaderInterfaces (Type Validation)", () => {
  // --- 1. Minimal Structure ---

  it("supports a minimal NavItem with only required properties", () => {
    const minimalItem: NavItem = {
      label: "Home",
    };

    expect(minimalItem.label).toBe("Home");
    expect(minimalItem.href).toBeUndefined();
    expect(minimalItem.children).toBeUndefined();
  });

  // --- 2. Optional Properties ---

  it("supports optional href property", () => {
    const linkItem: NavItem = {
      label: "About",
      href: "/about",
    };

    expect(linkItem.label).toBe("About");
    expect(linkItem.href).toBe("/about");
  });

  // --- 3. Recursive Structure (Children) ---

  it("supports recursive structure for nested children", () => {
    const parentItem: NavItem = {
      label: "Services",
      children: [
        {
          label: "Consulting",
          href: "/services/consulting",
        },
        {
          label: "Development",
          href: "/services/dev",
        },
      ],
    };

    expect(parentItem.children).toHaveLength(2);
    expect(parentItem.children?.[0].label).toBe("Consulting");
    expect(parentItem.children?.[1].href).toBe("/services/dev");
  });

  // --- 4. Deep Nesting Edge Case ---

  it("supports deeply nested children levels", () => {
    const deepItem: NavItem = {
      label: "Level 1",
      children: [
        {
          label: "Level 2",
          children: [
            {
              label: "Level 3",
              href: "/deep-link",
            },
          ],
        },
      ],
    };

    expect(deepItem.children?.[0].children?.[0].label).toBe("Level 3");
  });
});
