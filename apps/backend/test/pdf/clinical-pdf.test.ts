type PdfOperation =
  | { type: "text"; text: string; page: number; x?: number; y?: number }
  | { type: "rect"; page: number }
  | { type: "line"; page: number }
  | { type: "addPage"; page: number };

class FakePdfDocument {
  public page = { width: 595.28, height: 841.89 };
  public currentPageIndex = 0;
  public pages = [0];
  public operations: PdfOperation[] = [];
  public listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  public currentFontSize = 10.5;

  on(event: string, handler: (...args: unknown[]) => void): this {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return this;
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) ?? [];
    handlers.forEach((handler) => handler(...args));
  }

  addPage(): this {
    this.currentPageIndex += 1;
    this.pages.push(this.currentPageIndex);
    this.operations.push({ type: "addPage", page: this.currentPageIndex });
    return this;
  }

  switchToPage(index: number): this {
    this.currentPageIndex = index;
    return this;
  }

  bufferedPageRange(): { start: number; count: number } {
    return { start: 0, count: this.pages.length };
  }

  end(): this {
    this.emit("data", Buffer.from("%PDF-FAKE"));
    this.emit("end");
    return this;
  }

  destroy(): this {
    return this;
  }

  save(): this {
    return this;
  }

  restore(): this {
    return this;
  }

  font(_fontName: string): this {
    return this;
  }

  fontSize(size: number): this {
    this.currentFontSize = size;
    return this;
  }

  fillColor(_color: string): this {
    return this;
  }

  registerFont(_name: string, _src: string): this {
    return this;
  }

  strokeColor(_color: string): this {
    return this;
  }

  lineWidth(_width: number): this {
    return this;
  }

  moveTo(_x: number, _y: number): this {
    this.operations.push({ type: "line", page: this.currentPageIndex });
    return this;
  }

  lineTo(_x: number, _y: number): this {
    return this;
  }

  stroke(): this {
    return this;
  }

  rect(_x: number, _y: number, _width: number, _height: number): this {
    this.operations.push({ type: "rect", page: this.currentPageIndex });
    return this;
  }

  fillAndStroke(_fill: string, _stroke: string): this {
    return this;
  }

  text(text: string, x?: number, y?: number): this {
    this.operations.push({
      type: "text",
      text,
      page: this.currentPageIndex,
      x,
      y,
    });
    return this;
  }

  widthOfString(value: string): number {
    return Math.max(
      ...value
        .split("\n")
        .map((line) => line.length * this.currentFontSize * 0.52),
    );
  }

  heightOfString(
    value: string,
    options?: { width?: number; lineGap?: number },
  ): number {
    const width = options?.width ?? 9999;
    const lineGap = options?.lineGap ?? 2;
    const approxCharsPerLine = Math.max(
      1,
      Math.floor(width / (this.currentFontSize * 0.52)),
    );
    const lines = value.split("\n").flatMap((line) => {
      if (!line) {
        return [""];
      }

      const words = line.split(/\s+/u);
      const wrapped: string[] = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= approxCharsPerLine) {
          current = candidate;
        } else {
          if (current) {
            wrapped.push(current);
          }
          current = word;
        }
      }
      if (current) {
        wrapped.push(current);
      }
      return wrapped;
    });

    return lines.length * (this.currentFontSize * 1.35 + lineGap);
  }
}

const pdfDocumentInstances: FakePdfDocument[] = [];

jest.mock("pdfkit", () => ({
  __esModule: true,
  default: jest.fn(() => {
    const instance = new FakePdfDocument();
    pdfDocumentInstances.push(instance);
    return instance;
  }),
}));

import {
  generateClinicalPdf,
  generatePdf,
  generateResolvedTemplatePdf,
  type DischargeSummaryDocumentData,
  type InvoiceDocumentData,
  type PrescriptionDocumentData,
  type SoapNoteDocumentData,
} from "@yosemite-crew/lib";

const baseOrganization = {
  name: "PetVet Clinic",
  addressLine1: "123, ABC Road, Pawnee",
  addressLine2: "Pawnee, Indiana, 45787",
  phone: "(512) 444 223",
  email: "info@petvet.com",
  legalName: "PetVet Group of Companies LLC",
  footerText: "Clinical records generated for internal use",
};

const longDischargeSummaryData: DischargeSummaryDocumentData = {
  title: "Discharge Summary",
  date: new Date("2026-06-19T00:00:00.000Z"),
  appointmentId: "AP134534",
  doctorName: "Dr. Tim Apple",
  patientName: "Bella Hadid",
  speciesBreed: "Canine / Bulldog",
  ageSex: "2y 4m / MN",
  clientName: "Yasmin Hadid",
  clientId: "CL-1001",
  contact: "(512) 555 0111",
  chiefComplaint:
    "Recheck after acute limping and reduced activity. The patient presented with a guarded gait, intermittent vocalization, and reluctance to climb stairs. The history also noted reduced appetite over the previous 24 hours.",
  treatmentSummary:
    "The patient received pain management, rest recommendations, and a short course of anti-inflammatory support.",
  procedures: Array.from(
    { length: 12 },
    (_, index) => `Procedure step ${index + 1}`,
  ),
  diagnostics: Array.from(
    { length: 10 },
    (_, index) => `Diagnostic item ${index + 1}`,
  ),
  dischargeSummary:
    "Bella responded well to treatment and was stable at discharge with improved weight bearing. Owner instructions were reviewed in detail and follow-up was recommended if clinical signs worsen.",
  homeCare: Array.from(
    { length: 14 },
    (_, index) => `Home care instruction ${index + 1}`,
  ),
  emergencyCare: Array.from(
    { length: 6 },
    (_, index) => `Emergency escalation point ${index + 1}`,
  ),
  emergencyContact: "PetVet Clinic emergency line: (512) 444 223 ext. 9",
  printedBy: "Front Desk Coordinator",
  signature: {
    status: "PENDING",
    label: "Authorized By",
  },
};

const soapNoteData: SoapNoteDocumentData = {
  title: "SOAP Note",
  date: new Date("2026-06-19T00:00:00.000Z"),
  appointmentId: "AP-2001",
  doctorName: "Dr. Tim Apple",
  patientName: "Bella Hadid",
  speciesBreed: "Canine / Bulldog",
  ageSex: "2y 4m / MN",
  clientName: "Yasmin Hadid",
  clientId: "CL-1001",
  subjective: "Owner reports improved appetite and more normal energy.",
  objective:
    "Temperature, heart rate, and respiratory rate within expected ranges.",
  assessment: "Clinical signs are improving after treatment.",
  plan: "Continue prescribed medication and recheck in 7 days.",
  printedBy: "Front Desk Coordinator",
};

const prescriptionData: PrescriptionDocumentData = {
  title: "Prescription",
  date: new Date("2026-06-19T00:00:00.000Z"),
  appointmentId: "AP134534",
  prescriptionId: "RX-771",
  leadName: "Dr. Tim Apple",
  patientName: "Bella Hadid",
  clientName: "Yasmin Hadid",
  clientId: "CL-1001",
  clientContact: "(512) 555 0111",
  speciesBreed: "Canine / Bulldog",
  ageSex: "2y 4m / MN",
  items: [
    {
      medication: "Carprofen",
      strength: "25mg",
      dosage: "1 tablet",
      frequency: "BID",
      duration: "7 days",
      quantity: "14",
      instructions: "Give with food.",
    },
  ],
  notes: "Return if vomiting, diarrhea, or lethargy develop.",
  printedBy: "Front Desk Coordinator",
  signature: {
    status: "SIGNED",
    signerName: "Dr. Tim Apple",
    signerRole: "Veterinarian",
    signerDegree: "DVM",
    signedAt: new Date("2026-06-19T10:15:00Z"),
  },
};

const invoiceData: InvoiceDocumentData = {
  title: "Invoice",
  invoiceNumber: "INV-9001",
  currency: "USD",
  date: new Date("2026-06-19T00:00:00.000Z"),
  dueDate: new Date("2026-06-29T00:00:00.000Z"),
  clientName: "Yasmin Hadid",
  clientId: "CL-1001",
  patientName: "Bella Hadid",
  doctorName: "Dr. Tim Apple",
  items: [
    {
      name: "Consultation",
      description: "Exam and triage",
      quantity: 1,
      unitPrice: 75,
      total: 75,
    },
    {
      name: "Medication",
      description: "Carprofen",
      quantity: 1,
      unitPrice: 38.5,
      total: 38.5,
    },
  ],
  subtotal: 113.5,
  discount: 0,
  tax: 10.22,
  grandTotal: 123.72,
  amountPaid: 50,
  balanceDue: 73.72,
  paymentNotes: "Payment due within 10 days.",
  printedBy: "Billing Specialist",
  signature: {
    status: "SIGNED",
    signerName: "Dr. Tim Apple",
    signerRole: "Veterinarian",
    signerDegree: "DVM",
    signedAt: new Date("2026-06-19T10:15:00Z"),
  },
};

const vitalRecordData = {
  title: "Vital Records",
  date: new Date("2026-06-19T00:00:00.000Z"),
  appointmentId: "AP-2091",
  recordedBy: "Vet Nurse Carter",
  patientName: "Bella Hadid",
  speciesBreed: "Canine / Bulldog",
  ageSex: "2y 4m / MN",
  clientName: "Yasmin Hadid",
  clientId: "CL-1001",
  contact: "(512) 555 0111",
  measurements: [
    {
      label: "Temperature",
      value: "101.2",
      unit: "F",
      referenceRange: "100.0 - 102.5",
    },
    {
      label: "Heart Rate",
      value: "96",
      unit: "bpm",
      referenceRange: "60 - 120",
    },
  ],
  notes:
    "Vitals were stable and the patient remained comfortable during the visit.",
  printedBy: "Front Desk Coordinator",
} as const;

const templateRenderInput = {
  organization: baseOrganization,
  template: {
    templateId: "template-1",
    templateVersion: 3,
    templateVersionId: "template-version-1",
    source: "ORGANISATION" as const,
    ownerUserId: null,
    kind: "SOAP_NOTE" as const,
    name: "SOAP Note",
    schemaSnapshot: {
      sections: [
        {
          id: "subjective",
          title: "Subjective",
          order: 1,
          description: "Patient-reported information.",
          fields: [
            {
              key: "chiefComplaint",
              label: "Chief complaint",
              type: "textarea" as const,
              order: 1,
            },
            {
              key: "followUp",
              label: "Follow up",
              type: "datetime" as const,
              order: 2,
            },
          ],
        },
        {
          id: "plan",
          title: "Plan",
          order: 2,
          fields: [
            {
              key: "medications",
              label: "Medications",
              type: "medicationLine" as const,
              order: 1,
              rules: {
                columns: ["drug", "dose", "frequency", "duration"],
              },
            },
          ],
        },
      ],
    },
    renderConfigSnapshot: null,
    validationSnapshot: null,
    appliesTo: null,
    reason: "Resolved from the template module.",
  },
  data: {
    chiefComplaint: "Reduced activity and appetite.",
    followUp: new Date("2026-06-20T10:00:00.000Z"),
    medications: [
      {
        drug: "Carprofen",
        dose: "25mg",
        frequency: "BID",
        duration: "7 days",
      },
    ],
  },
};

afterEach(() => {
  pdfDocumentInstances.length = 0;
});

describe("generateClinicalPdf", () => {
  it.each([
    ["DISCHARGE_SUMMARY", longDischargeSummaryData],
    ["SOAP_NOTE", soapNoteData],
    ["PRESCRIPTION", prescriptionData],
    ["VITAL_RECORD", vitalRecordData],
    ["INVOICE", invoiceData],
  ] as const)("renders %s clinical PDFs", async (documentType, data) => {
    const buffer = await generateClinicalPdf({
      documentType,
      organization: baseOrganization,
      data,
    });

    expect(buffer.subarray(0, 9).toString()).toBe("%PDF-FAKE");
    expect(pdfDocumentInstances).toHaveLength(1);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === baseOrganization.name,
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text?.includes("Page 1 of"),
      ),
    ).toBe(true);
  });

  it("paginates long discharge summaries and keeps the pending signature block together", async () => {
    const buffer = await generateClinicalPdf({
      documentType: "DISCHARGE_SUMMARY",
      organization: baseOrganization,
      data: longDischargeSummaryData,
    });

    expect(buffer.subarray(0, 9).toString()).toBe("%PDF-FAKE");
    expect(pdfDocumentInstances[0].pages.length).toBeGreaterThan(1);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "Pending signature",
      ),
    ).toBe(true);
  });

  it("renders signer metadata for signed documents", async () => {
    const buffer = await generateClinicalPdf({
      documentType: "INVOICE",
      organization: baseOrganization,
      data: invoiceData,
    });

    expect(buffer.subarray(0, 9).toString()).toBe("%PDF-FAKE");
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) =>
          op.type === "text" && op.text === invoiceData.signature?.signerName,
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text?.includes("Signed 19/06/2026"),
      ),
    ).toBe(true);
  });

  it("renders a resolved template snapshot through the shared adapter", async () => {
    const buffer = await generateResolvedTemplatePdf({
      ...templateRenderInput,
      printedBy: "Template Coordinator",
    });

    expect(buffer.subarray(0, 9).toString()).toBe("%PDF-FAKE");
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "SOAP Note",
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "Template Name",
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "Chief complaint:",
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) =>
          op.type === "text" && op.text === "Reduced activity and appetite.",
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "Carprofen",
      ),
    ).toBe(true);
  });

  it("renders a generic pdf config through the reusable template surface", async () => {
    const buffer = await generatePdf({
      documentType: "soap-note",
      title: "SOAP Notes",
      organization: baseOrganization,
      metadataGroups: [[{ label: "Date", value: "2026-06-19" }]],
      sections: [
        {
          title: "Subjective",
          content: [
            { type: "paragraph", text: "Owner reports improved appetite." },
          ],
        },
      ],
    });

    expect(buffer.subarray(0, 9).toString()).toBe("%PDF-FAKE");
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "SOAP Notes",
      ),
    ).toBe(true);
    expect(
      pdfDocumentInstances[0].operations.some(
        (op) => op.type === "text" && op.text === "Subjective",
      ),
    ).toBe(true);
  });
});
