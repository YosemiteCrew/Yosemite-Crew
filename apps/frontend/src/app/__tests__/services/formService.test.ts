import {
  loadForms,
  fetchForm,
  saveFormDraft,
  publishForm,
  unpublishForm,
  archiveForm,
} from "@/app/services/formService";
import * as axiosService from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { useFormsStore } from "@/app/stores/formsStore";
import { useAuthStore } from "@/app/stores/authStore";
import * as formUtils from "@/app/utils/forms";
import axios from "axios";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

jest.mock("axios", () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
      get: jest.fn(),
      post: jest.fn(),
    })),
    isAxiosError: jest.fn((payload) => payload?.isAxiosError === true),
  };
});

jest.mock("@/app/services/axios", () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
  patchData: jest.fn(),
}));

jest.mock("@/app/stores/orgStore");
jest.mock("@/app/stores/formsStore");
jest.mock("@/app/stores/authStore");
jest.mock("@/app/utils/forms");

describe("formService", () => {
  // Store Mock Functions
  const mockSetLoading = jest.fn();
  const mockSetForms = jest.fn();
  const mockSetError = jest.fn();
  const mockUpsertForm = jest.fn();
  const mockUpdateFormStatus = jest.fn();
  const mockSetLastFetched = jest.fn();

  beforeEach(() => {
    // Reset all mocks to default states
    jest.resetAllMocks();

    // Default Store State Mocks
    (useFormsStore.getState as jest.Mock).mockReturnValue({
      setLoading: mockSetLoading,
      setForms: mockSetForms,
      setError: mockSetError,
      upsertForm: mockUpsertForm,
      updateFormStatus: mockUpdateFormStatus,
      setLastFetched: mockSetLastFetched,
      lastFetchedAt: null,
      loading: false,
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });

    (useAuthStore.getState as jest.Mock).mockReturnValue({
      attributes: { sub: "user-sub-123" },
      user: { getUsername: () => "username-123" },
    });

    // Default Utils Mocks
    (formUtils.mapQuestionnaireToUI as jest.Mock).mockImplementation((data) => ({
      ...data,
      mapped: true,
    }));
    (formUtils.mapFormToUI as jest.Mock).mockImplementation((data) => ({
      ...data,
      mapped: true,
    }));
    (formUtils.buildFHIRPayload as jest.Mock).mockReturnValue({ payload: "fhir" });

    // Default Axios Success Mocks
    (axiosService.getData as jest.Mock).mockResolvedValue({ data: [] });
    (axiosService.postData as jest.Mock).mockResolvedValue({ data: {} });
    (axiosService.putData as jest.Mock).mockResolvedValue({ data: {} });
  });

  // ===========================================================================
  // 1. loadForms
  // ===========================================================================

  describe("loadForms", () => {
    it("fetches forms successfully and updates store", async () => {
      const mockData = [{ id: "form-1" }, { id: "form-2" }];
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await loadForms();

      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(axiosService.getData).toHaveBeenCalledWith(
        "/fhir/v1/form/admin/org-123/forms"
      );
      expect(formUtils.mapQuestionnaireToUI).toHaveBeenCalledTimes(2);
      expect(mockSetForms).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ mapped: true })])
      );
      expect(result).toHaveLength(2);
      expect(mockSetLoading).toHaveBeenCalledWith(false);
      expect(mockSetLastFetched).toHaveBeenCalledTimes(1);
    });

    it("throws error if no primary org is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });

      await expect(loadForms()).rejects.toThrow("No primary organisation selected");
      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(mockSetLoading).toHaveBeenCalledWith(false); // Finally block
    });

    it("handles axios errors correctly", async () => {
      const error = {
          isAxiosError: true,
          response: { data: { message: "API Error" } }
      };
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadForms()).rejects.toEqual(error);
      expect(mockSetError).toHaveBeenCalledWith("API Error");
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });

    it("handles generic errors correctly", async () => {
      const error = new Error("Generic Error");
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(loadForms()).rejects.toThrow("Generic Error");
      expect(mockSetError).toHaveBeenCalledWith("Failed to load forms");
    });
  });

  // ===========================================================================
  // 2. fetchForm
  // ===========================================================================

  describe("fetchForm", () => {
    it("fetches a single form successfully", async () => {
      const mockForm = { id: "form-1" };
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockForm });

      const result = await fetchForm("form-1");

      expect(axiosService.getData).toHaveBeenCalledWith(
        "/fhir/v1/form/admin/org-123/form-1"
      );
      expect(formUtils.mapQuestionnaireToUI).toHaveBeenCalledWith(mockForm);
      expect(mockUpsertForm).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ mapped: true }));
    });

    it("handles failure to fetch form", async () => {
      const error = new Error("Network");
      (axiosService.getData as jest.Mock).mockRejectedValue(error);
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);

      await expect(fetchForm("form-1")).rejects.toThrow("Network");
      expect(mockSetError).toHaveBeenCalledWith("Failed to fetch form");
    });
  });

  // ===========================================================================
  // 3. saveFormDraft
  // ===========================================================================

  describe("saveFormDraft", () => {
    const mockFormProps: FormsProps = {
      name: "Test Form",
      category: "Consent form",
      description: "Test Desc",
      usage: "Internal",
      species: [],
      services: [],
      schema: [],
    } as unknown as FormsProps;

    it("creates a new form if _id is missing (POST)", async () => {
      const responseData = { id: "new-id", resourceType: "Questionnaire" };
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: responseData });

      const result = await saveFormDraft(mockFormProps);

      // Check User ID resolution (from attributes.sub)
      expect(formUtils.buildFHIRPayload).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-sub-123", orgId: "org-123" })
      );

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/fhir/v1/form/admin/org-123",
        expect.anything()
      );

      // Should use mapQuestionnaireToUI for Questionnaire resourceType
      expect(formUtils.mapQuestionnaireToUI).toHaveBeenCalled();
      expect(mockUpsertForm).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ mapped: true }));
    });

    it("updates existing form if _id is present (PUT)", async () => {
      const formWithId = { ...mockFormProps, _id: "existing-id" };
      const responseData = { id: "existing-id", resourceType: "Form" };
      (axiosService.putData as jest.Mock).mockResolvedValue({ data: responseData });

      const result = await saveFormDraft(formWithId);

      expect(axiosService.putData).toHaveBeenCalledWith(
        "/fhir/v1/form/admin/org-123/existing-id",
        expect.anything()
      );

      // Should use mapFormToUI for "Form" resourceType (or non-Questionnaire)
      expect(formUtils.mapFormToUI).toHaveBeenCalled();
      expect(mockUpsertForm).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ mapped: true, _id: "existing-id" }));
    });

    it("resolves user ID from username if sub is missing", async () => {
      (useAuthStore.getState as jest.Mock).mockReturnValue({
        attributes: null,
        user: { getUsername: () => "fallback-username" },
      });
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: {} });

      await saveFormDraft(mockFormProps);

      expect(formUtils.buildFHIRPayload).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "fallback-username" })
      );
    });

    it("resolves user ID to 'web-admin' if all auth missing", async () => {
        (useAuthStore.getState as jest.Mock).mockReturnValue({
          attributes: null,
          user: null,
        });
        (axiosService.postData as jest.Mock).mockResolvedValue({ data: {} });

        await saveFormDraft(mockFormProps);

        expect(formUtils.buildFHIRPayload).toHaveBeenCalledWith(
          expect.objectContaining({ userId: "web-admin" })
        );
      });

    it("handles save errors (axios)", async () => {
      const error = { isAxiosError: true, response: { data: { message: "Save Failed" } }, message: "AxiosMsg" };
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      (axiosService.postData as jest.Mock).mockRejectedValue(error);

      await expect(saveFormDraft(mockFormProps)).rejects.toEqual(error);
      expect(mockSetError).toHaveBeenCalledWith("Save Failed");
    });

    it("handles save errors (generic)", async () => {
        const error = new Error("Boom");
        (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
        (axiosService.postData as jest.Mock).mockRejectedValue(error);

        await expect(saveFormDraft(mockFormProps)).rejects.toThrow("Boom");
        expect(mockSetError).toHaveBeenCalledWith("Unable to save form");
      });
  });

  // ===========================================================================
  // 4. Publish / Unpublish / Archive
  // ===========================================================================

  describe("Status Actions", () => {
    const formId = "f1";

    // --- Publish ---
    it("publishes form successfully", async () => {
      await publishForm(formId);
      expect(axiosService.postData).toHaveBeenCalledWith(
        `/fhir/v1/form/admin/${formId}/publish`
      );
      expect(mockUpdateFormStatus).toHaveBeenCalledWith(formId, "Published");
    });

    it("handles publish error", async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error("Fail"));

      await expect(publishForm(formId)).rejects.toThrow("Fail");
      expect(mockSetError).toHaveBeenCalledWith("Unable to publish form");
    });

    // --- Unpublish ---
    it("unpublishes form successfully", async () => {
      await unpublishForm(formId);
      expect(axiosService.postData).toHaveBeenCalledWith(
        `/fhir/v1/form/admin/${formId}/unpublish`
      );
      expect(mockUpdateFormStatus).toHaveBeenCalledWith(formId, "Draft");
    });

    it("handles unpublish error", async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error("Fail"));

      await expect(unpublishForm(formId)).rejects.toThrow("Fail");
      expect(mockSetError).toHaveBeenCalledWith("Unable to unpublish form");
    });

    // --- Archive ---
    it("archives form successfully", async () => {
      await archiveForm(formId);
      expect(axiosService.postData).toHaveBeenCalledWith(
        `/fhir/v1/form/admin/${formId}/archive`
      );
      expect(mockUpdateFormStatus).toHaveBeenCalledWith(formId, "Archived");
    });

    it("handles archive error", async () => {
        (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
        (axiosService.postData as jest.Mock).mockRejectedValue(new Error("Fail"));

        await expect(archiveForm(formId)).rejects.toThrow("Fail");
        expect(mockSetError).toHaveBeenCalledWith("Unable to archive form");
      });
  });
});
