import { isHttpsImageUrl } from "@/app/utils/urls";

describe("isHttpsImageUrl", () => {
  it("returns true for https urls", () => {
    expect(isHttpsImageUrl("https://example.com/image.png")).toBe(true);
    expect(isHttpsImageUrl("https://cdn.example.com/path/to/img.jpg")).toBe(true);
  });

  it("returns false for non-https or missing values", () => {
    expect(isHttpsImageUrl("http://example.com/image.png")).toBe(false);
    expect(isHttpsImageUrl("ftp://example.com/image.png")).toBe(false);
    expect(isHttpsImageUrl(undefined)).toBe(false);
    expect(isHttpsImageUrl(null)).toBe(false);
    expect(isHttpsImageUrl("")).toBe(false);
  });
});
