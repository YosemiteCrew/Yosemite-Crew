import {
  formatDateLabel,
  statusToLabel,
  labelToStatus,
  getCategoryTemplate,
  mapFormToUI,
  buildFHIRPayload,
  questionnaireToForm,
  mapQuestionnaireToUI,
} from "@/app/utils/forms";
import {
  fromFormRequestDTO,
  toFormResponseDTO,
  Form,
} from "@yosemite-crew/types";
// Fixed: Changed import name from 'FormCategory' to 'FormsCategory'
import { FormsCategory } from "@/app/types/forms";

// --- Mocks ---

// Mock external library functions to verify they are called
jest.mock("@yosemite-crew/types", () => ({
  // Pass through relevant types if needed, or just mock functions
  fromFormRequestDTO: jest.fn((dto) => ({
    ...dto,
    _convertedFromDTO: true,
  })),
  toFormResponseDTO: jest.fn((form) => ({
    ...form,
    _convertedToDTO: true,
  })),
}));

// Mock the constants file to control CategoryTemplates data
jest.mock("@/app/types/forms", () => {
  return {
    CategoryTemplates: {
      Medical: [
        { name: "template-field", type: "text", label: "Template Field" },
      ],
      Intake: [], // Empty template
      // Complex mock for recursive test structure
      Group: [
        {
          type: "group",
          name: "g1",
          fields: [{ type: "text", name: "child1", label: "Child" }],
        },
      ],
    },
    // Export FormsCategory as an empty object for type resolution in test scope
    FormsCategory: {}
  };
});

describe("Forms Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Functions ---

  describe("formatDateLabel", () => {
    it("formats a valid Date object", () => {
      const date = new Date("2023-10-27T10:00:00Z");
      const result = formatDateLabel(date);
      expect(result).not.toBe("");
      expect(result).not.toBe("Invalid Date");
    });

    it("formats a valid date string", () => {
      const result = formatDateLabel("2023-10-27");
      expect(result).not.toBe("");
    });

    it("returns empty string for null/undefined", () => {
      expect(formatDateLabel()).toBe("");
      expect(formatDateLabel(null as any)).toBe("");
    });

    it("returns empty string for invalid date", () => {
      expect(formatDateLabel("invalid-date-string")).toBe("");
    });
  });

  describe("Status Mappers", () => {
    it("statusToLabel maps correctly", () => {
      expect(statusToLabel("draft")).toBe("Draft");
      expect(statusToLabel("published")).toBe("Published");
      expect(statusToLabel("archived")).toBe("Archived");
    });

    it("statusToLabel defaults to 'Draft'", () => {
      expect(statusToLabel()).toBe("Draft");
      expect(statusToLabel("unknown" as any)).toBe("Draft");
    });

    it("labelToStatus maps correctly", () => {
      expect(labelToStatus("Draft")).toBe("draft");
      expect(labelToStatus("Published")).toBe("published");
      expect(labelToStatus("Archived")).toBe("archived");
    });

    it("labelToStatus defaults to 'draft'", () => {
      expect(labelToStatus()).toBe("draft");
      expect(labelToStatus("Unknown" as any)).toBe("draft");
    });
  });

  // --- 2. Template Logic ---

  describe("getCategoryTemplate", () => {
    // Fixed: Casting to FormsCategory
    it("returns deep cloned template fields for known category", () => {
      const fields = getCategoryTemplate("Medical" as FormsCategory);
      expect(fields).toHaveLength(1);
      expect((fields[0] as any).name).toBe("template-field");
    });

    it("returns empty array for unknown category", () => {
      const fields = getCategoryTemplate("Unknown" as any);
      expect(fields).toEqual([]);
    });

    it("deep clones groups correctly (Recursive check)", async () => {
      jest.resetModules();

      const fields = getCategoryTemplate("Group" as any);
      const groupField = fields[0] as any;

      expect(groupField.type).toBe("group");
      expect(groupField.fields).toHaveLength(1);
      expect(groupField.fields[0].name).toBe("child1");
    });
  });

  // --- 3. UI Mapping Logic ---

  describe("mapFormToUI", () => {
    const baseForm: Form = {
      _id: "123",
      orgId: "org-1",
      name: "Test Form",
      category: "Medical" as FormsCategory,
      status: "draft",
      schema: [],
      visibilityType: "Internal",
    } as any;

    it("maps basic fields correctly", () => {
      const ui = mapFormToUI(baseForm);
      expect(ui._id).toBe("123");
      expect(ui.name).toBe("Test Form");
      expect(ui.status).toBe("Draft");
      expect(ui.category).toBe("Medical");
    });

    it("handles toList for services", () => {
      // Single string
      const single = mapFormToUI({ ...baseForm, serviceId: "s1" } as any);
      expect(single.services).toEqual(["s1"]);

      // Array
      const arr = mapFormToUI({ ...baseForm, serviceId: ["s1", "s2"] } as any);
      expect(arr.services).toEqual(["s1", "s2"]);

      // Undefined
      const none = mapFormToUI({ ...baseForm, serviceId: undefined } as any);
      expect(none.services).toEqual([]);
    });

    it("handles visibility normalization logic", () => {
      // Standard
      expect(
        mapFormToUI({ ...baseForm, visibilityType: "Internal" } as any).usage
      ).toBe("Internal");

      // Normalize logic
      expect(
        mapFormToUI({ ...baseForm, visibilityType: "internal_external" } as any)
          .usage
      ).toBe("Internal & External");
      expect(
        mapFormToUI({ ...baseForm, visibilityType: "internal&external" } as any)
          .usage
      ).toBe("Internal & External");
      expect(
        mapFormToUI({ ...baseForm, visibilityType: "interna_external" } as any)
          .usage
      ).toBe("Internal & External"); // Typo coverage

      // Unknown string fallback
      expect(
        mapFormToUI({ ...baseForm, visibilityType: "CustomVisibility" } as any)
          .usage
      ).toBe("CustomVisibility");

      // Null fallback
      expect(
        mapFormToUI({ ...baseForm, visibilityType: null } as any).usage
      ).toBe("Internal");
    });

    it("formats lastUpdated date", () => {
      const form = { ...baseForm, updatedAt: new Date("2023-01-01") };
      const ui = mapFormToUI(form as any);
      expect(ui.lastUpdated).not.toBe("");
    });

    it("falls back to createdAt if updatedAt missing", () => {
      const form = {
        ...baseForm,
        updatedAt: null,
        createdAt: new Date("2023-01-01"),
      };
      const ui = mapFormToUI(form as any);
      expect(ui.lastUpdated).not.toBe("");
    });
  });

  describe("DTO Wrappers", () => {
    it("questionnaireToForm calls fromFormRequestDTO", () => {
      const dto = { some: "data" } as any;
      const result = questionnaireToForm(dto);
      expect(fromFormRequestDTO).toHaveBeenCalledWith(dto);
      expect(result).toEqual(
        expect.objectContaining({ _convertedFromDTO: true })
      );
    });

    it("mapQuestionnaireToUI composes functions correctly", () => {
      const dto = { name: "DTO Form", status: "published" } as any;
      // Mock the return of fromFormRequestDTO to be a valid Form-like object for mapFormToUI
      (fromFormRequestDTO as jest.Mock).mockReturnValue({
        _id: "dto-id",
        name: "DTO Form",
        status: "published",
        visibilityType: "Internal",
      });

      const result = mapQuestionnaireToUI(dto);
      expect(result._id).toBe("dto-id");
      expect(result.status).toBe("Published");
    });
  });

  // --- 4. Payload Building ---

  describe("buildFHIRPayload", () => {
    // Fixed: Casting category to FormsCategory
    const mockUIForm = {
      _id: "ui-1",
      name: "UI Form",
      category: "Medical" as FormsCategory,
      status: "Draft",
      usage: "Internal",
      schema: [], // Empty schema to test fallback
    } as any;

    it("builds payload with correct basic fields", () => {
      const result = buildFHIRPayload({
        form: mockUIForm,
        orgId: "org-1",
        userId: "user-1",
      });

      // Verify toFormResponseDTO was called with normalized object
      expect(toFormResponseDTO).toHaveBeenCalled();
      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];

      expect(normalized.name).toBe("UI Form");
      expect(normalized.orgId).toBe("org-1");
      expect(normalized.updatedBy).toBe("user-1");
      expect(normalized.status).toBe("draft");
    });

    it("uses template schema if fallbackToTemplate is true and schema is empty", () => {
      // MockUIForm has empty schema and category "Medical" (which has a template in our mock)
      buildFHIRPayload({
        form: mockUIForm,
        orgId: "org-1",
        userId: "user-1",
        fallbackToTemplate: true,
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.schema).toHaveLength(1);
      expect((normalized.schema[0] as any).name).toBe("template-field");
    });

    it("does NOT use template if fallbackToTemplate is false", () => {
      buildFHIRPayload({
        form: mockUIForm,
        orgId: "org-1",
        userId: "user-1",
        fallbackToTemplate: false,
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.schema).toEqual([]);
    });

    it("uses existing schema if present (ignores template)", () => {
      const formWithSchema = {
        ...mockUIForm,
        schema: [{ name: "existing", type: "text" }],
      };

      buildFHIRPayload({
        form: formWithSchema,
        orgId: "org-1",
        userId: "user-1",
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect((normalized.schema[0] as any).name).toBe("existing");
    });

    it("maps 'Internal & External' usage to 'Internal_External' for backend", () => {
      const externalForm = { ...mockUIForm, usage: "Internal & External" };

      buildFHIRPayload({
        form: externalForm,
        orgId: "org-1",
        userId: "user-1",
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.visibilityType).toBe("Internal_External");
    });

    it("preserves createdBy if existing in form object", () => {
      // We force cast to include createdBy which might exist on the object but not on the UI props strictly
      const formWithCreator = { ...mockUIForm, createdBy: "creator-user" };

      buildFHIRPayload({
        form: formWithCreator,
        orgId: "org-1",
        userId: "editor-user",
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.createdBy).toBe("creator-user");
      expect(normalized.updatedBy).toBe("editor-user");
    });

    it("sets createdBy to userId if new form", () => {
      buildFHIRPayload({
        form: mockUIForm, // no createdBy
        orgId: "org-1",
        userId: "new-user",
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.createdBy).toBe("new-user");
    });
  });
});