import { renderEmailTemplate } from "src/utils/email-templates";

const BASE = {
  organisationName: "Bramble Vets",
  reporterName: "Ada Lovelace",
  reporterEmail: "ada@example.com",
  reporterPhone: "+44 20 7946 0000",
  companionName: "Poppy",
  productName: "Vaccine X",
  brandName: "BrandCo",
  batchNumber: "LOT-42",
  quantityUsed: "2 ml",
  administrationMethod: "Subcutaneous",
  eventDate: "2026-09-01",
  conditionBefore: "Bright",
  conditionAfter: "Lethargic",
};

const render = (data: Partial<typeof BASE> & Record<string, unknown> = {}) =>
  renderEmailTemplate("adverseEventReported", { ...BASE, ...data });

describe("adverseEventReported email", () => {
  it("names the companion and product in the subject", () => {
    const { subject } = render();
    expect(subject).toContain("Poppy");
    expect(subject).toContain("Vaccine X");
  });

  it("carries the detail a vet needs to act", () => {
    const { htmlBody, textBody } = render();
    for (const value of [
      "Ada Lovelace",
      "Poppy",
      "BrandCo",
      "LOT-42",
      "2 ml",
      "Subcutaneous",
      "Lethargic",
      "ada@example.com",
    ]) {
      expect(htmlBody).toContain(value);
      expect(textBody).toContain(value);
    }
  });

  /*
   * The whole point of the mail. Nothing is transmitted to a regulator or a
   * manufacturer, so a clinic must not be left thinking the report has been
   * filed - they are the only party who can act on it.
   */
  it("says plainly that nothing has been forwarded", () => {
    const { htmlBody, textBody } = render();
    expect(htmlBody).toMatch(/not.*forwarded/i);
    expect(textBody).toMatch(/NOT forwarded/i);
  });

  it("names the country's authority when one is known", () => {
    const { htmlBody } = render({
      authorityName: "Veterinary Medicines Directorate (VMD)",
      authorityUrl: "https://www.gov.uk/report-veterinary-medicine-problem",
    });
    expect(htmlBody).toContain("Veterinary Medicines Directorate (VMD)");
    expect(htmlBody).toContain(
      "https://www.gov.uk/report-veterinary-medicine-problem",
    );
  });

  it("still disclaims forwarding when no authority is known", () => {
    const { htmlBody } = render({
      authorityName: undefined,
      authorityUrl: undefined,
    });
    expect(htmlBody).toMatch(/not.*forwarded/i);
  });

  it("omits a detail row rather than printing an empty one", () => {
    const { htmlBody } = render({
      batchNumber: undefined,
      brandName: undefined,
    });
    expect(htmlBody).not.toContain("Batch number:");
    expect(htmlBody).toContain("Vaccine X");
  });

  /*
   * createEmailTemplate renders the HTML pass over escapeDeep(data), so the
   * builder must NOT escape again - a second pass turns `&` into `&amp;` in a
   * clinic's own name. This is the regression guard for that.
   */
  it("escapes exactly once, so an ampersand survives intact", () => {
    const { htmlBody, textBody } = render({
      organisationName: "Smith & Jones",
    });
    expect(htmlBody).toContain("Smith &amp; Jones");
    expect(htmlBody).not.toContain("&amp;amp;");
    // The plaintext body renders raw data and must carry no entities at all.
    expect(textBody).toContain("Smith & Jones");
  });

  it("escapes markup in a supplied value rather than emitting it", () => {
    const { htmlBody } = render({
      companionName: '<img src=x onerror="alert(1)">',
    });
    expect(htmlBody).not.toMatch(/<img[^>]+onerror/i);
    expect(htmlBody).toContain("&lt;img");
  });

  it("falls back to a neutral greeting when the practice has no name", () => {
    const { htmlBody } = render({ organisationName: undefined });
    expect(htmlBody).toContain("your practice");
  });
});
