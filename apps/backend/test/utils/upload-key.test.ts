import { createHash } from "node:crypto";
import {
  isTempUploadKey,
  isUploadKeyIn,
  TEMP_UPLOAD_PREFIX,
  tempUploadPrefixFor,
  uploadKeyToMove,
} from "../../src/utils/upload-key";

const refuse = (): never => {
  throw new Error("refused");
};

const UPLOADER = "user-1";
const OTHER_UPLOADER = "user-2";
const MINE = `${tempUploadPrefixFor(UPLOADER)}0b9a6c4e-1d2f-4a3b-9c8d-7e6f5a4b3c2d.jpg`;
const THEIRS = `${tempUploadPrefixFor(OTHER_UPLOADER)}0b9a6c4e-1d2f-4a3b-9c8d-7e6f5a4b3c2d.jpg`;

// Everything a request could name instead of a fresh upload of its own.
const NOT_FRESH_UPLOADS: Array<[string, unknown]> = [
  ["another person's upload", THEIRS],
  ["an upload from before uploads were kept per person", "temp/uploads/x.jpg"],
  ["a practice file", "companion/pet-1/0f4d.pdf"],
  ["an organisation file", "orgs/org-1/logo.jpg"],
  ["a parent directory segment", `${tempUploadPrefixFor(UPLOADER)}../x.pdf`],
  ["an encoded parent directory", `${tempUploadPrefixFor(UPLOADER)}%2e%2e/x`],
  ["an encoded slash", `${tempUploadPrefixFor(UPLOADER)}a%2Fb.jpg`],
  ["a nested path", `${tempUploadPrefixFor(UPLOADER)}nested/x.jpg`],
  ["a doubled slash", `${tempUploadPrefixFor(UPLOADER)}/x.jpg`],
  ["a backslash", `${tempUploadPrefixFor(UPLOADER)}..\\x.jpg`],
  ["a leading slash", `/${MINE}`],
  ["a different case", MINE.toUpperCase()],
  ["surrounding whitespace", ` ${MINE}`],
  ["a dot file name", `${tempUploadPrefixFor(UPLOADER)}..`],
  ["the bare folder", tempUploadPrefixFor(UPLOADER)],
  ["another temp folder", "temp/other/x.jpg"],
  ["a value that is not a string", { key: MINE }],
];

describe("tempUploadPrefixFor", () => {
  it("names the folder after the uploader without spelling out their id", () => {
    const prefix = tempUploadPrefixFor(UPLOADER);
    const digest = createHash("sha256").update(UPLOADER).digest("hex");

    expect(prefix).toBe(`${TEMP_UPLOAD_PREFIX}${digest.slice(0, 32)}/`);
    expect(prefix).not.toContain(UPLOADER);
    expect(tempUploadPrefixFor(OTHER_UPLOADER)).not.toBe(prefix);
  });
});

describe("isTempUploadKey", () => {
  it("accepts the keys the upload URL issued to the same uploader", () => {
    expect(isTempUploadKey(MINE, UPLOADER)).toBe(true);
    expect(
      isTempUploadKey(`${tempUploadPrefixFor(UPLOADER)}a1_b2-c3`, UPLOADER),
    ).toBe(true);
  });

  it.each(NOT_FRESH_UPLOADS)("rejects %s", (_label, key) => {
    expect(isTempUploadKey(key, UPLOADER)).toBe(false);
  });

  it.each([
    ["no uploader", undefined],
    ["an empty uploader", ""],
  ])("rejects every key for %s", (_label, uploaderId) => {
    expect(isTempUploadKey(MINE, uploaderId)).toBe(false);
    expect(isTempUploadKey(`${TEMP_UPLOAD_PREFIX}x.jpg`, uploaderId)).toBe(
      false,
    );
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
  it("returns the caller's own fresh upload to move", () => {
    expect(uploadKeyToMove(MINE, { uploaderId: UPLOADER }, refuse)).toBe(MINE);
  });

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["null", null],
    ["an https link", "https://cdn.example.test/companion/pet-1/photo.jpg"],
    ["an https link in capitals", "HTTPS://CDN.EXAMPLE.TEST/photo.jpg"],
    ["an inline png", "data:image/png;base64,iVBORw0KGgo="],
    ["an inline jpeg", "data:image/jpeg;base64,/9j/4AAQ"],
    ["an inline gif", "data:image/gif;base64,R0lGODlh"],
    ["an inline webp", "data:image/webp;base64,UklGRg=="],
  ])("saves %s as given, with nothing to move", (_label, value) => {
    expect(uploadKeyToMove(value, { uploaderId: UPLOADER }, refuse)).toBeNull();
  });

  it.each([
    ["an http link", "http://cdn.example.test/photo.jpg"],
    ["a file link", "file:///etc/hosts"],
    ["a script link", "javascript:alert(1)"],
    ["an ftp link", "ftp://files.example.test/photo.jpg"],
    ["a protocol-relative link", "//cdn.example.test/photo.jpg"],
    ["an https link with a space", "https://cdn.example.test/a photo.jpg"],
    ["a bare https scheme", "https://"],
    ["an inline svg", "data:image/svg+xml;base64,PHN2Zz4="],
    ["an inline page", "data:text/html,<p>hi</p>"],
    ["an inline image with no type", "data:,hello"],
    ["a local file link", "file:///var/mobile/photo.jpg"],
  ])("refuses %s", (_label, value) => {
    expect(() =>
      uploadKeyToMove(value, { uploaderId: UPLOADER }, refuse),
    ).toThrow("refused");
  });

  it.each(NOT_FRESH_UPLOADS.filter(([, key]) => typeof key === "string"))(
    "refuses %s",
    (_label, key) => {
      expect(() =>
        uploadKeyToMove(key as string, { uploaderId: UPLOADER }, refuse),
      ).toThrow("refused");
    },
  );

  it("refuses a fresh upload when nobody is named as its uploader", () => {
    expect(() => uploadKeyToMove(MINE, {}, refuse)).toThrow("refused");
  });

  it("keeps the value the record already holds, whatever it is", () => {
    for (const saved of [
      "temp/uploads/x.jpg",
      THEIRS,
      "http://cdn.example.test/photo.jpg",
    ]) {
      expect(
        uploadKeyToMove(
          saved,
          { uploaderId: UPLOADER, current: saved },
          refuse,
        ),
      ).toBeNull();
    }
  });

  it("checks a changed value even when the record holds one", () => {
    expect(() =>
      uploadKeyToMove(
        THEIRS,
        { uploaderId: UPLOADER, current: "https://cdn.example.test/a.jpg" },
        refuse,
      ),
    ).toThrow("refused");
    expect(
      uploadKeyToMove(
        MINE,
        { uploaderId: UPLOADER, current: "https://cdn.example.test/a.jpg" },
        refuse,
      ),
    ).toBe(MINE);
  });
});
