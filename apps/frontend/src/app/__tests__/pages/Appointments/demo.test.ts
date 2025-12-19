import {
  generateAppointments,
  demoAppointments,
  CompanionDataOptions,
  CompanionData,
} from "../../../pages/Appointments/demo";

describe("Appointments Demo Data Generator", () => {
  // --- Section 1: Core Generation Logic ---

  describe("generateAppointments", () => {
    it("should generate the requested number of appointments", () => {
      const count = 10;
      const data = generateAppointments(count);
      expect(data).toHaveLength(count);
    });

    it("should generate valid appointment structures", () => {
      const data = generateAppointments(1);
      const item = data[0];

      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("parentName");
      expect(item).toHaveProperty("start");
      expect(item).toHaveProperty("end");
      expect(item.start).toBeInstanceOf(Date);
      expect(item.end).toBeInstanceOf(Date);
      // Validate date parsing
      expect(item.start.getTime()).not.toBeNaN();
    });

    it("should respect the forDate parameter", () => {
      const testDate = "2025-01-01";
      const data = generateAppointments(5, testDate);

      data.forEach((apt) => {
        expect(apt.date).toBe(testDate);
        // Check that start date matches the requested day (local time logic in generator)
      });
    });

    it("should assign correct species-specific breeds", () => {
      // Generate enough samples to likely get both cats and dogs
      const data = generateAppointments(50);

      // We manually define the lists from the source to verify logic
      const dogBreeds = [
        "Golden Retriever", "Beagle", "Bulldog", "Poodle", "Labrador",
        "German Shepherd", "Husky", "Boxer", "Pitbull", "Cocker Spaniel",
      ];
      const catBreeds = ["Persian", "Maine Coon", "Ragdoll", "Domestic Shorthair"];

      data.forEach((apt) => {
        if (apt.species === "Dog") {
          expect(dogBreeds).toContain(apt.breed);
        } else if (apt.species === "Cat") {
          expect(catBreeds).toContain(apt.breed);
        }
      });
    });
  });

  // --- Section 2: Time & Duration Logic ---

  describe("Time Calculation Logic", () => {
    it("should handle All-Day events correctly", () => {
      // Mock randomBool to return TRUE (force all-day)
      // The generator calls secureRandom() -> randomBool()
      // We need to spy on the internal random mechanism if possible,
      // OR just generate enough data to find an all-day event.
      // Since we can't easily mock the internal `randomBool` function directly without rewriting the module,
      // we will mock the `crypto` or `Math.random` to control outcomes.

      const originalRandom = Math.random;

      // Force "All Day" path:
      // 1. secureRandom() < 0.1 for isAllDay
      // Mock Math.random to return 0.05
      Math.random = () => 0.05;

      // Note: we need to ensure crypto is undefined to use Math.random fallback for testing deterministic paths
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error Deleting global property for testing fallback logic
      delete globalThis.crypto;

      const data = generateAppointments(1, "2025-05-05");
      const apt = data[0];

      expect(apt.time).toBe("All day");
      // Cleanup
      Math.random = originalRandom;
      globalThis.crypto = originalCrypto;
    });

    it("should handle Normal Timed events correctly", () => {
      const originalRandom = Math.random;
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error Deleting global property for testing fallback logic
      delete globalThis.crypto;

      // Force !isAllDay: return 0.5 (above 0.1 threshold)
      // Then next randoms determine startHour, startMinute, duration
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 0; // petName
        if (callCount === 2) return 0; // parentName
        if (callCount === 3) return 0; // species
        if (callCount === 4) return 0; // breed
        if (callCount === 5) return 0; // reason
        if (callCount === 6) return 0; // emergency
        if (callCount === 7) return 0; // service
        if (callCount === 8) return 0; // room
        if (callCount === 9) return 0; // vet
        if (callCount === 10) return 0; // status
        if (callCount === 11) return 0.9; // isAllDay -> False

        // Time logic:
        if (callCount === 12) return 0.5; // startHour: 0.5 * 24 = 12
        if (callCount === 13) return 0; // startMinute: 0 * 12 * 5 = 0
        if (callCount === 14) return 0.5; // duration: mid-range

        return 0.5; // support staff
      };

      const data = generateAppointments(1, "2025-05-05");
      const apt = data[0];

      expect(apt.time).not.toBe("All day");
      expect(apt.start.getHours()).toBe(12);
      expect(apt.start.getMinutes()).toBe(0);

      // Cleanup
      Math.random = originalRandom;
      globalThis.crypto = originalCrypto;
    });

    it("should clamp duration if start time is near end of day", () => {
      const originalRandom = Math.random;
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error Deleting global property for testing fallback logic
      delete globalThis.crypto;

      let callCount = 0;
      Math.random = () => {
        callCount++;
        // Skip preamble...
        if (callCount === 11) return 0.9; // isAllDay -> False
        // Time logic:
        if (callCount === 12) return 0.99; // startHour: 23
        if (callCount === 13) return 0.99; // startMinute: 55
        // Duration random call will happen inside logic
        return 0.9;
      };

      const data = generateAppointments(1, "2025-05-05");
      const apt = data[0];

      // Start is 23:55
      expect(apt.start.getHours()).toBe(23);
      expect(apt.start.getMinutes()).toBe(55);

      // Max remaining minutes in day = 5 mins.
      // Logic: maxSameDayMinutes = 1440 - 5 - (23*60 + 55) = 1435 - 1435 = 0?
      // Logic check: 24*60 - 5 - startTotalMinutes.
      // 1440 - 5 - 1435 = 0.
      // duration = Math.max(5, 0) = 5.

      const durationMs = apt.end.getTime() - apt.start.getTime();
      expect(durationMs).toBe(5 * 60 * 1000); // Should be clamped to 5 minutes

      // Cleanup
      Math.random = originalRandom;
      globalThis.crypto = originalCrypto;
    });
  });

  // --- Section 3: Crypto / Randomness Coverage ---

  describe("Randomness Fallback", () => {
    it("should use crypto.getRandomValues if available", () => {
      const getRandomValues = jest.fn((buf) => {
        buf[0] = 12345;
        return buf;
      });

      // Mock global crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues },
        writable: true
      });

      generateAppointments(1);
      expect(getRandomValues).toHaveBeenCalled();
    });

    it("should fallback to Math.random if crypto is undefined", () => {
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error Deleting global property for testing fallback logic
      delete globalThis.crypto;

      const randomSpy = jest.spyOn(Math, 'random');

      generateAppointments(1);

      expect(randomSpy).toHaveBeenCalled();

      // Restore
      randomSpy.mockRestore();
      globalThis.crypto = originalCrypto;
    });
  });

  // --- Section 4: Static Data Exports ---

  describe("Static Data", () => {
    it("demoAppointments should contain pre-generated data", () => {
      expect(demoAppointments.length).toBeGreaterThan(0);
      expect(demoAppointments[0]).toHaveProperty("name");
    });

    it("CompanionDataOptions should correctly map CompanionData", () => {
      expect(CompanionDataOptions).toHaveLength(CompanionData.length);

      // Check first mapping
      const firstSource = CompanionData[0];
      const firstOption = CompanionDataOptions[0];

      expect(firstOption.key).toBe(firstSource.id);
      expect(firstOption.value).toBe(`${firstSource.companion}-${firstSource.parent}`);
    });
  });
});