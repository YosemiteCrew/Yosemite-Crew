import { createSubmission, fetchSubmissions } from "../../services/soapService";
import { getData, postData } from "../../services/axios";
import { toFormSubmissionResponseDTO, FormSubmission } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("../../services/axios");
jest.mock("@yosemite-crew/types", () => ({
  toFormSubmissionResponseDTO: jest.fn(),
}));

const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedToDTO = toFormSubmissionResponseDTO as jest.Mock;

describe("SOAP Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: createSubmission ---
  describe("createSubmission", () => {
    const mockInputSubmission: FormSubmission = {
      formId: "form-123",
      data: { some: "value" },
    } as unknown as FormSubmission;

    const mockTransformedDTO = {
      resourceType: "QuestionnaireResponse",
      item: [],
    };

    const mockResponseData: FormSubmission = {
      // FIX: Cast to 'any' to prevent TS error about overwriting properties
      ...(mockInputSubmission as any),
      _id: "sub-999",
    } as unknown as FormSubmission;

    it("transforms input, sends POST request, and returns data on success", async () => {
      // Setup mocks
      mockedToDTO.mockReturnValue(mockTransformedDTO);
      mockedPostData.mockResolvedValue({ data: mockResponseData });

      const result = await createSubmission(mockInputSubmission);

      // Verify transformation was called
      expect(mockedToDTO).toHaveBeenCalledWith(mockInputSubmission);

      // Verify POST called with correct URL and transformed body
      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/form/admin/form-123/submit",
        mockTransformedDTO
      );

      // Verify return value
      expect(result).toEqual(mockResponseData);
    });

    it("logs error and rethrows when API fails", async () => {
      const error = new Error("Network Error");
      mockedToDTO.mockReturnValue(mockTransformedDTO);
      mockedPostData.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createSubmission(mockInputSubmission)).rejects.toThrow("Network Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to create appointment:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: fetchSubmissions ---
  describe("fetchSubmissions", () => {
    const mockSoapResponse = {
      appointmentId: "appt-1",
      soapNotes: {
        Subjective: [],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    };

    it("throws error immediately if appointmentId is missing", async () => {
      // Cast to string to simulate runtime failure or empty string input
      await expect(fetchSubmissions("")).rejects.toThrow("Appointment Id is required");
      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("sends GET request and returns data on success", async () => {
      mockedGetData.mockResolvedValue({ data: mockSoapResponse });

      const result = await fetchSubmissions("appt-1");

      expect(mockedGetData).toHaveBeenCalledWith(
        "fhir/v1/form/appointments/appt-1/soap-notes"
      );
      expect(result).toEqual(mockSoapResponse);
    });

    it("logs error and rethrows when API fails", async () => {
      const error = new Error("Fetch Failed");
      mockedGetData.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(fetchSubmissions("appt-1")).rejects.toThrow("Fetch Failed");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to create appointment:", error);
      consoleSpy.mockRestore();
    });
  });
});