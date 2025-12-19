import { useRouter, useSearchParams, usePathname } from "../../jest.mocks/nextNavigation";

describe("Next.js Navigation Mocks", () => {
  // --- Section 1: useRouter ---
  describe("useRouter", () => {
    it("should return a router object with mock functions", () => {
      const router = useRouter();

      expect(router).toHaveProperty("push");
      expect(router).toHaveProperty("replace");
      expect(router).toHaveProperty("prefetch");

      // Verify they are Jest mocks
      expect(jest.isMockFunction(router.push)).toBe(true);
      expect(jest.isMockFunction(router.replace)).toBe(true);
      expect(jest.isMockFunction(router.prefetch)).toBe(true);
    });

    it("should allow calling the mock functions", () => {
      const router = useRouter();
      router.push("/new-path");
      expect(router.push).toHaveBeenCalledWith("/new-path");
    });
  });

  // --- Section 2: useSearchParams ---
  describe("useSearchParams", () => {
    it("should return a searchParams object with mock functions", () => {
      const params = useSearchParams();

      expect(params).toHaveProperty("get");
      expect(params).toHaveProperty("entries");

      expect(jest.isMockFunction(params.get)).toBe(true);
      expect(jest.isMockFunction(params.entries)).toBe(true);
    });
    
    it("should return an iterator for entries()", () => {
      const params = useSearchParams();
      const entries = params.entries();
      // Should be an empty iterator by default based on the mock implementation
      expect(entries.next().done).toBe(true);
    });
  });

  // --- Section 3: usePathname ---
  describe("usePathname", () => {
    it("should return the root path '/' by default", () => {
      expect(usePathname()).toBe("/");
    });
  });
});