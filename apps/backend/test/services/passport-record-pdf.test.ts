import { buildPassportRecordPdf } from "src/services/passport-record-pdf";

describe("buildPassportRecordPdf", () => {
  it("renders a PDF buffer with a title, subtitle and fields", async () => {
    const pdf = await buildPassportRecordPdf({
      title: "Vaccination record",
      subtitle: "Doggy · microchip 985141000123456",
      fields: [
        { label: "Vaccine", value: "Nobivac Rabies" },
        { label: "Batch", value: "A234B" },
      ],
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders without a subtitle and stops at the page footer", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      label: `Field ${i}`,
      value: `Value ${i}`,
    }));
    const pdf = await buildPassportRecordPdf({
      title: "Many fields",
      fields: many,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
