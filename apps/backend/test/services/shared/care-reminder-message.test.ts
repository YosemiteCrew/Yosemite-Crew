import {
  CARE_TYPE_LABELS,
  buildCareReminderMessage,
} from "src/services/shared/care-reminder-message";
import { CareReminderType } from "@prisma/client";

describe("buildCareReminderMessage", () => {
  it("returns the practice's own message untouched when there is one", () => {
    expect(
      buildCareReminderMessage({
        customMessage: "Bring the vaccination card with you.",
        patientName: "Buddy",
        reminderType: "VACCINATION_BOOSTER",
      }),
    ).toBe("Bring the vaccination card with you.");
  });

  it("passes an empty custom message through rather than papering over it", () => {
    // `??` not `||`. An empty custom message is a staff mistake, and falling
    // back to the generated sentence would hide it behind plausible text.
    expect(
      buildCareReminderMessage({
        customMessage: "",
        patientName: "Buddy",
        reminderType: "VACCINATION_BOOSTER",
      }),
    ).toBe("");
  });

  it("names the companion and the care type when the practice wrote nothing", () => {
    expect(
      buildCareReminderMessage({
        customMessage: null,
        patientName: "Buddy",
        reminderType: "PARASITE_TREATMENT",
      }),
    ).toBe(
      "Buddy is due for parasite treatment. Please book an appointment at your earliest convenience.",
    );
  });

  it("has a label for every reminder type the schema can store", () => {
    // Enumerated from the Prisma enum rather than from a hand-written list, so
    // adding a type to the schema without a label fails here rather than
    // reaching an owner as the word "care".
    const types = Object.values(CareReminderType);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(CARE_TYPE_LABELS[type]).toEqual(expect.any(String));
      expect(CARE_TYPE_LABELS[type]).not.toBe("");
    }
  });
});
