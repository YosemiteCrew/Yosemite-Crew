import {
  isTempUploadKey,
  isUploadKeyIn,
  TEMP_UPLOAD_PREFIX,
  uploadKeyToMove,
} from "../../src/utils/upload-key";

const refuse = (): never => {
  throw new Error("refused");
};

// Everything a request could name instead of a fresh upload.
const NOT_FRESH_UPLOADS: Array<[string, unknown]> = [
  ["a practice file", "companion/pet-1/0f4d.pdf"],
  ["an organisation file", "orgs/org-1/logo.jpg"],
  ["a parent directory segment", "temp/uploads/../companion/pet-1/x.pdf"],
  ["an encoded parent directory", "temp/uploads/%2e%2e/companion/x.pdf"],
  ["an encoded slash", "temp/uploads/a%2Fb.jpg"],
  ["a nested path", "temp/uploads/nested/x.jpg"],
  ["a doubled slash", "temp/uploads//x.jpg"],
  ["a backslash", "temp/uploads/..\\x.jpg"],
  ["a leading slash", "/temp/uploads/x.jpg"],
  ["a different case", "Temp/Uploads/x.jpg"],
  ["surrounding whitespace", " temp/uploads/x.jpg"],
  ["a dot file name", "temp/uploads/.."],
  ["the bare prefix", TEMP_UPLOAD_PREFIX],
  ["another temp folder", "temp/other/x.jpg"],
  ["a longer folder name", "temp/uploadsx/x.jpg"],
  ["a value that is not a string", { key: "temp/uploads/x.jpg" }],
];

describe("isTempUploadKey", () => {
  it("accepts the keys the temporary upload URL issues", () => {
    expect(TEMP_UPLOAD_PREFIX).toBe("temp/uploads/");
    expect(
      isTempUploadKey("temp/uploads/0b9a6c4e-1d2f-4a3b-9c8d-7e6f5a4b3c2d.jpg"),
    ).toBe(true);
    expect(isTempUploadKey("temp/uploads/a1_b2-c3")).toBe(true);
  });

  it.each(NOT_FRESH_UPLOADS)("rejects %s", (_label, key) => {
    expect(isTempUploadKey(key)).toBe(false);
  });
});

describe("isUploadKeyIn", () => {
  it("takes a file directly in the named folder only", () => {
    expect(isUploadKeyIn("companion/pet-1/", "companion/pet-1/a.pdf")).toBe(
      true,
    );
    expect(isUploadKeyIn("companion/pet-1/", "companion/pet-12/a.pdf")).toBe(
      false,
    );
    expect(isUploadKeyIn("companion/pet-1/", "companion/pet-1/a/b.pdf")).toBe(
      false,
    );
  });
});

describe("uploadKeyToMove", () => {
  it("returns a fresh upload to move", () => {
    expect(uploadKeyToMove("temp/uploads/photo.jpg", refuse)).toBe(
      "temp/uploads/photo.jpg",
    );
  });

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["null", null],
    ["an https link", "https://cdn.example.test/companion/pet-1/photo.jpg"],
    ["an http link", "HTTP://cdn.example.test/photo.jpg"],
    ["a data link", "data:image/png;base64,iVBORw0KGgo="],
  ])("keeps %s as given, with nothing to move", (_label, value) => {
    expect(uploadKeyToMove(value, refuse)).toBeNull();
  });

  it.each(NOT_FRESH_UPLOADS.filter(([, key]) => typeof key === "string"))(
    "refuses %s",
    (_label, key) => {
      expect(() => uploadKeyToMove(key as string, refuse)).toThrow("refused");
    },
  );
});
