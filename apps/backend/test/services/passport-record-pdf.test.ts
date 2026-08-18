import {
  buildPassportRecordPdf,
  toWinAnsiSafe,
} from "src/services/passport-record-pdf";

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

  // The standard-14 fonts are WinAnsi (CP1252) encoded and pdf-lib throws on
  // anything outside it, so untrusted clinical free text must not reach them raw.
  it("renders a pet name and lab with non-CP1252 characters instead of throwing", async () => {
    const pdf = await buildPassportRecordPdf({
      title: "Rabies antibody titration",
      subtitle: "Bāsil · microchip 985141000123456",
      fields: [
        { label: "Laboratory", value: "Лаборатория" },
        { label: "Manufacturer", value: "Łukasiewicz Ż" },
        { label: "Note", value: "healthy 🐶" },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("toWinAnsiSafe", () => {
  it("passes CP1252 text through untouched", () => {
    expect(toWinAnsiSafe("Nobivac Rabies — café ½ °C · Ünder")).toBe(
      "Nobivac Rabies — café ½ °C · Ünder",
    );
  });

  it("strips combining marks from Latin characters outside CP1252", () => {
    expect(toWinAnsiSafe("Bāsil")).toBe("Basil");
    expect(toWinAnsiSafe("Łukasiewicz Ż")).toBe("Lukasiewicz Z");
    // š/ž are WinAnsi specials (0x9A/0x9E) so they survive untouched; only č
    // has to be decomposed.
    expect(toWinAnsiSafe("čšž")).toBe("cšž");
  });

  it("replaces characters with no Latin equivalent", () => {
    expect(toWinAnsiSafe("Лаб")).toBe("???");
    expect(toWinAnsiSafe("犬")).toBe("?");
    expect(toWinAnsiSafe("ok 🐶")).toBe("ok ?");
  });

  it("keeps newlines and normalises other whitespace controls", () => {
    expect(toWinAnsiSafe("line one\nline two")).toBe("line one\nline two");
    expect(toWinAnsiSafe("a\tb\rc")).toBe("a b c");
  });

  it("drops a bare combining mark", () => {
    expect(toWinAnsiSafe("á́")).toBe("á");
  });
});
