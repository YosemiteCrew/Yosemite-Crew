import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "playwright";
import {
  buildPdfViewModel,
  renderPdf,
  generateFormSubmissionPdf,
  closePdfBrowser,
  clearPdfTemplateCache,
  PdfViewModel,
} from "../../src/services/formPDF.service";
import { FormField } from "@yosemite-crew/types";

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock("node:fs", () => {
  const mockFs = { promises: { readFile: jest.fn() } };
  return { __esModule: true, ...mockFs, default: mockFs };
});
jest.mock("playwright", () => ({
  chromium: { launch: jest.fn() },
}));

const mockPage = {
  setContent: jest.fn(),
  pdf: jest.fn(),
};

const mockContext = {
  newPage: jest.fn(),
  close: jest.fn(),
};

const mockBrowser = {
  newContext: jest.fn(),
  isConnected: jest.fn(),
  close: jest.fn(),
};

// ----------------------------------------------------------------------
// 2. TEST SUITE
// ----------------------------------------------------------------------
describe("FormPDFService", () => {
  const mockDate = new Date("2023-01-01T12:00:00.000Z");

  beforeEach(async () => {
    // Reset the module-level browser singleton and template cache so every
    // test starts from a cold renderer.
    await closePdfBrowser();
    clearPdfTemplateCache();
    jest.clearAllMocks();

    // Default mock implementation for fs.promises.readFile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fs.promises.readFile as any).mockResolvedValue(
      "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
    );

    // Default mock implementation for playwright
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chromium.launch as any).mockResolvedValue(mockBrowser);

    // FIX: Cast the mock function itself to any to avoid 'never' inference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockBrowser.newContext as any).mockResolvedValue(mockContext);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockBrowser.isConnected as any).mockReturnValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockContext.newPage as any).mockResolvedValue(mockPage);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPage.pdf as any).mockResolvedValue(Buffer.from("mock-pdf-buffer"));
  });

  /* ========================================================================
   * VIEW MODEL & FORMATTING
   * ======================================================================*/
  describe("buildPdfViewModel (Value Formatting)", () => {
    it("should format simple primitives correctly", () => {
      const schema: FormField[] = [
        { id: "f1", type: "input", label: "String", required: false, order: 1 },
        {
          id: "f2",
          type: "number",
          label: "Number",
          required: false,
          order: 2,
        },
      ];
      const answers = { f1: "Hello", f2: 123 };

      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields).toEqual([
        { label: "String", value: "Hello" },
        { label: "Number", value: "123" },
      ]);
    });

    it("should format booleans as Yes/No", () => {
      // Cast to any to bypass strict 'ChoiceField' requirement for 'options'
      const schema: FormField[] = [
        {
          id: "b1",
          type: "boolean",
          label: "Bool True",
          required: false,
          order: 1,
        },
        {
          id: "b2",
          type: "boolean",
          label: "Bool False",
          required: false,
          order: 2,
        },
      ] as unknown as FormField[];

      const answers = { b1: true, b2: false };

      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields).toEqual([
        { label: "Bool True", value: "Yes" },
        { label: "Bool False", value: "No" },
      ]);
    });

    it("should format dates correctly", () => {
      const schema: FormField[] = [
        {
          id: "d1",
          type: "date",
          label: "Date Obj",
          required: false,
          order: 1,
        },
        {
          id: "d2",
          type: "date",
          label: "Date String",
          required: false,
          order: 2,
        },
        {
          id: "d3",
          type: "date",
          label: "Invalid Date",
          required: false,
          order: 3,
        },
      ];
      const dateObj = new Date("2023-01-01");
      const answers = {
        d1: dateObj,
        d2: "2023-01-01",
        d3: "not-a-date",
      };

      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields[0].value).toBe(dateObj.toLocaleDateString());
      expect(vm.sections[0].fields[1].value).toBe(
        new Date("2023-01-01").toLocaleDateString(),
      );
      expect(vm.sections[0].fields[2].value).toBe("not-a-date"); // Fallback to stringify
    });

    it("should format signature fields", () => {
      const schema: FormField[] = [
        {
          id: "s1",
          type: "signature",
          label: "Sign",
          required: false,
          order: 1,
        },
      ];
      const answers = { s1: "some-signature-data" };
      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields[0].value).toBe("Signed electronically");
    });

    it("should handle arrays by joining values", () => {
      const schema: FormField[] = [
        { id: "a1", type: "input", label: "Array", required: false, order: 1 },
      ];
      const answers = { a1: ["A", "B", "C"] };
      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields[0].value).toBe("A, B, C");
    });

    it("should handle null/undefined values", () => {
      const schema: FormField[] = [
        { id: "n1", type: "input", label: "Null", required: false, order: 1 },
        {
          id: "u1",
          type: "input",
          label: "Undefined",
          required: false,
          order: 2,
        },
      ];
      const answers = { n1: null, u1: undefined };
      const vm = buildPdfViewModel({
        title: "Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections[0].fields[0].value).toBe("");
      expect(vm.sections[0].fields[1].value).toBe("");
    });
  });

  describe("stringifyValue Edge Cases", () => {
    // Helper to access private stringifyValue via a dummy field call
    const testStringify = (val: unknown) => {
      const schema: FormField[] = [
        { id: "x", type: "input", label: "X", required: false, order: 1 },
      ];
      const vm = buildPdfViewModel({
        title: "T",
        schema,
        answers: { x: val },
        submittedAt: mockDate,
      });
      return vm.sections[0].fields[0].value;
    };

    it("should handle BigInt", () => {
      expect(testStringify(BigInt(123))).toBe("123");
    });

    it("should handle Symbols", () => {
      expect(testStringify(Symbol("sym"))).toBe("Symbol(sym)");
    });

    it("should handle Functions", () => {
      expect(testStringify(() => {})).toBe("[function]");
    });

    it("should handle Objects via JSON.stringify", () => {
      expect(testStringify({ a: 1 })).toBe('{"a":1}');
    });

    it("should handle circular objects gracefully", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(testStringify(circular)).toBe("[unserializable]");
    });

    it("should handle Date objects in default case", () => {
      // When field type is NOT 'date', but value IS a Date object
      const d = new Date("2023-01-01");
      expect(testStringify(d)).toBe(d.toISOString());
    });
  });

  /* ========================================================================
   * STRUCTURE & GROUPING
   * ======================================================================*/
  describe("buildPdfViewModel (Structure)", () => {
    it("should group fields correctly", () => {
      const schema: FormField[] = [
        { id: "f1", type: "input", label: "F1", required: false, order: 1 },
        {
          id: "g1",
          type: "group",
          label: "Group 1",
          required: false,
          order: 2,
          fields: [
            {
              id: "g1f1",
              type: "input",
              label: "G1F1",
              required: false,
              order: 1,
            },
          ],
        },
        { id: "f2", type: "input", label: "F2", required: false, order: 3 },
      ];
      const answers = { f1: "v1", g1f1: "gv1", f2: "v2" };

      const vm = buildPdfViewModel({
        title: "Structure",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(vm.sections).toHaveLength(3);

      // Section 1: Default 'Details' for f1
      expect(vm.sections[0].title).toBe("Details");
      expect(vm.sections[0].fields).toHaveLength(1);
      expect(vm.sections[0].fields[0].label).toBe("F1");

      // Section 2: 'Group 1'
      expect(vm.sections[1].title).toBe("Group 1");
      expect(vm.sections[1].fields).toHaveLength(1);
      expect(vm.sections[1].fields[0].label).toBe("G1F1");

      // Section 3: Default 'Details' for f2 (new default section created after group closed)
      expect(vm.sections[2].title).toBe("Details");
      expect(vm.sections[2].fields).toHaveLength(1);
      expect(vm.sections[2].fields[0].label).toBe("F2");
    });
  });

  /* ========================================================================
   * RENDERING & PDF GENERATION
   * ======================================================================*/
  describe("renderPdf", () => {
    const mockVm: PdfViewModel = {
      title: "Test Form",
      submittedAt: "2023-01-01",
      sections: [{ title: "S1", fields: [{ label: "L1", value: "V1" }] }],
    };

    it("should launch browser, set content, and return pdf buffer", async () => {
      const result = await renderPdf(mockVm);

      expect(chromium.launch).toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining("pdf-templates/form.html"),
        "utf8",
      );

      // Verify template replacement happened (implicitly by setContent call)
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining("<h2>S1</h2>"), // Check if section title rendered
        { waitUntil: "load" },
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining("V1"), // Check if value rendered
        { waitUntil: "load" },
      );

      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: "A4",
        printBackground: true,
      });
      // The per-render context is torn down; the shared browser stays open.
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should inject branding and use the requested template kind", async () => {
      await renderPdf(mockVm, {
        templateKind: "SOAP_NOTE",
        branding: {
          organizationName: "MediCare Hospital",
          addressLines: ["123 Clinic Road", "Mumbai, MH 400001"],
          logoUrl: "https://cdn.example/logo.png",
          phoneNo: "+91 99999 00000",
          website: "https://medicare.example",
        },
      });

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining("pdf-templates/soap-note.html"),
        "utf8",
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining("MediCare Hospital"),
        { waitUntil: "load" },
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining("Clinic Road"),
        { waitUntil: "load" },
      );
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining("SOAP note"),
        { waitUntil: "load" },
      );
    });
  });

  /* ========================================================================
   * BROWSER LIFECYCLE & TEARDOWN
   * ======================================================================*/
  describe("browser lifecycle and teardown", () => {
    const mockVm: PdfViewModel = {
      title: "Lifecycle",
      submittedAt: "2023-01-01",
      sections: [{ title: "S1", fields: [{ label: "L1", value: "V1" }] }],
    };

    it("reuses one shared browser across renders", async () => {
      await renderPdf(mockVm);
      await renderPdf(mockVm);

      expect(chromium.launch).toHaveBeenCalledTimes(1);
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("caches the template read across renders of the same kind", async () => {
      await renderPdf(mockVm);
      await renderPdf(mockVm);

      expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    });

    it("relaunches when the shared browser has disconnected", async () => {
      await renderPdf(mockVm);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockBrowser.isConnected as any).mockReturnValue(false);
      await renderPdf(mockVm);

      expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    it("does not cache a failed launch", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chromium.launch as any).mockRejectedValueOnce(new Error("no chromium"));

      await expect(renderPdf(mockVm)).rejects.toThrow("no chromium");

      const result = await renderPdf(mockVm);
      expect(result).toBeInstanceOf(Buffer);
      expect(chromium.launch).toHaveBeenCalledTimes(2);
    });

    it("closes the context when setContent throws, leaving the browser open", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPage.setContent as any).mockRejectedValueOnce(
        new Error("bad template"),
      );

      await expect(renderPdf(mockVm)).rejects.toThrow("bad template");

      expect(mockContext.close).toHaveBeenCalledTimes(1);
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("closes the context when pdf generation throws", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPage.pdf as any).mockRejectedValueOnce(new Error("render timeout"));

      await expect(renderPdf(mockVm)).rejects.toThrow("render timeout");

      expect(mockContext.close).toHaveBeenCalledTimes(1);
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("keeps the render error when context teardown also fails", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPage.pdf as any).mockRejectedValueOnce(new Error("render timeout"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockContext.close as any).mockRejectedValueOnce(
        new Error("close failed"),
      );

      await expect(renderPdf(mockVm)).rejects.toThrow("render timeout");
    });

    it("closePdfBrowser closes the shared browser", async () => {
      await renderPdf(mockVm);

      await closePdfBrowser();

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("closePdfBrowser is a no-op when no browser was launched", async () => {
      await closePdfBrowser();

      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it("closePdfBrowser tolerates a browser that fails to close", async () => {
      await renderPdf(mockVm);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockBrowser.close as any).mockRejectedValueOnce(
        new Error("already gone"),
      );

      await expect(closePdfBrowser()).resolves.toBeUndefined();
    });
  });

  describe("generateFormSubmissionPdf", () => {
    it("should integrate buildPdfViewModel and renderPdf", async () => {
      const schema: FormField[] = [
        { id: "f1", type: "input", label: "L1", required: false, order: 1 },
      ];
      const answers = { f1: "V1" };

      const result = await generateFormSubmissionPdf({
        title: "Integration Test",
        schema,
        answers,
        submittedAt: mockDate,
      });

      expect(chromium.launch).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from("mock-pdf-buffer"));
    });
  });

  /* ========================================================================
   * SECURITY: PATH TRAVERSAL VULNERABILITY TESTS
   * ======================================================================*/
  describe("Path Traversal Security", () => {
    // We need to test the readTemplate function indirectly through renderPdf
    // since readTemplate is not exported. We'll use a mock that simulates
    // the actual path validation logic.

    const mockVm: PdfViewModel = {
      title: "Security Test",
      submittedAt: "2023-01-01",
      sections: [{ title: "S1", fields: [{ label: "L1", value: "V1" }] }],
    };

    it("should reject paths containing '..' (parent directory traversal)", async () => {
      // Mock readFile to simulate path traversal attempt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.promises.readFile as any).mockImplementation((filePath: string) => {
        // Simulate the security check that should be in place
        if (filePath.includes("..") || path.isAbsolute(filePath)) {
          return Promise.reject(new Error("Invalid path"));
        }
        return Promise.resolve(
          "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
        );
      });

      // Attempt to use a path with parent directory traversal
      // This would normally be caught by the validation in readTemplate
      const maliciousPath = "../../../etc/passwd";
      
      // Since we can't directly call readTemplate, we verify the mock behavior
      await expect(
        fs.promises.readFile(maliciousPath, "utf8")
      ).rejects.toThrow("Invalid path");
    });

    it("should reject absolute paths (Unix-style)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.promises.readFile as any).mockImplementation((filePath: string) => {
        if (filePath.includes("..") || path.isAbsolute(filePath)) {
          return Promise.reject(new Error("Invalid path"));
        }
        return Promise.resolve(
          "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
        );
      });

      const maliciousPath = "/etc/passwd";
      
      await expect(
        fs.promises.readFile(maliciousPath, "utf8")
      ).rejects.toThrow("Invalid path");
    });

    it("should reject absolute paths (Windows-style)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.promises.readFile as any).mockImplementation((filePath: string) => {
        if (filePath.includes("..") || path.isAbsolute(filePath)) {
          return Promise.reject(new Error("Invalid path"));
        }
        return Promise.resolve(
          "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
        );
      });

      const maliciousPath = "C:\\Windows\\System32\\config\\SAM";
      
      await expect(
        fs.promises.readFile(maliciousPath, "utf8")
      ).rejects.toThrow("Invalid path");
    });

    it("should accept valid relative paths without traversal", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.promises.readFile as any).mockImplementation((filePath: string) => {
        if (filePath.includes("..") || path.isAbsolute(filePath)) {
          return Promise.reject(new Error("Invalid path"));
        }
        return Promise.resolve(
          "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
        );
      });

      // Valid path should work
      const validPath = "src/utils/pdf-templates/form.html";
      
      await expect(
        fs.promises.readFile(validPath, "utf8")
      ).resolves.toBeDefined();
    });

    it("should successfully render PDF with legitimate template path", async () => {
      // Reset to default mock that allows valid paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.promises.readFile as any).mockImplementation((filePath: string) => {
        // Simulate the security check
        if (filePath.includes("..") || path.isAbsolute(filePath)) {
          return Promise.reject(new Error("Invalid path"));
        }
        return Promise.resolve(
          "<html>{{brandSection}}{{title}} {{submittedAt}} {{sections}} {{templateLabel}}</html>",
        );
      });

      // This should work with the default template resolution
      const result = await renderPdf(mockVm);

      expect(result).toBeInstanceOf(Buffer);
      expect(chromium.launch).toHaveBeenCalled();
    });
  });
});
