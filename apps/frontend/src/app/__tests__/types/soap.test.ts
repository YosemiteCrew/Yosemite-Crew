import { GetSOAPResponse } from "../../types/soap";
import { FormSubmission } from "@yosemite-crew/types";

// Mock helper to simulate a FormSubmission object
// We cast to unknown first to avoid needing the full massive type definition
const mockSubmission: FormSubmission = {
  _id: "sub-1",
  formId: "form-A",
  data: { notes: "Patient is doing well" },
  submittedAt: "2023-01-01T12:00:00Z"
} as unknown as FormSubmission;

describe("SOAP Types Definition", () => {

  // --- Section 1: Top-Level Structure ---
  describe("Top-Level Structure", () => {
    it("creates a valid GetSOAPResponse object with required fields", () => {
      const response: GetSOAPResponse = {
        appointmentId: "appt-123",
        soapNotes: {
          Subjective: [],
          Objective: [],
          Assessment: [],
          Plan: [],
          Discharge: [],
        },
      };

      expect(response.appointmentId).toBe("appt-123");
      expect(response.soapNotes).toBeDefined();
    });
  });

  // --- Section 2: Nested SOAP Sections (Empty) ---
  describe("SOAP Sections (Empty Arrays)", () => {
    it("allows empty arrays for all SOAP categories", () => {
      const response: GetSOAPResponse = {
        appointmentId: "appt-456",
        soapNotes: {
          Subjective: [],
          Objective: [],
          Assessment: [],
          Plan: [],
          Discharge: [],
        },
      };

      expect(response.soapNotes.Subjective).toHaveLength(0);
      expect(response.soapNotes.Plan).toHaveLength(0);
    });
  });

  // --- Section 3: Nested SOAP Sections (Populated) ---
  describe("SOAP Sections (Populated)", () => {
    it("allows arrays of FormSubmission objects in SOAP categories", () => {
      const response: GetSOAPResponse = {
        appointmentId: "appt-789",
        soapNotes: {
          Subjective: [mockSubmission],
          Objective: [mockSubmission, mockSubmission],
          Assessment: [],
          Plan: [mockSubmission],
          Discharge: [],
        },
      };

      expect(response.soapNotes.Subjective).toHaveLength(1);
      expect(response.soapNotes.Objective).toHaveLength(2);
      expect(response.soapNotes.Subjective[0]).toEqual(mockSubmission);
    });
  });

  // --- Section 4: Type Integrity & Completeness ---
  describe("Type Integrity", () => {
    it("ensures all specific SOAP keys (Subjective, Objective, etc.) are present", () => {
      // This test ensures that if you typo a key in the object creation, TS (and runtime check) catches it.
      const soapData = {
        Subjective: [],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      };

      const response: GetSOAPResponse = {
        appointmentId: "appt-000",
        soapNotes: soapData,
      };

      const keys = Object.keys(response.soapNotes);
      expect(keys).toContain("Subjective");
      expect(keys).toContain("Objective");
      expect(keys).toContain("Assessment");
      expect(keys).toContain("Plan");
      expect(keys).toContain("Discharge");
    });
  });
});