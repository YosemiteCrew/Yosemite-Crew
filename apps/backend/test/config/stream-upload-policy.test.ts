const mockUpdateAppSettings = jest.fn();

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: jest.fn(() => ({ updateAppSettings: mockUpdateAppSettings })),
  },
}));

import {
  configureStreamUploadPolicy,
  BLOCKED_UPLOAD_EXTENSIONS,
  BLOCKED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "src/config/stream-upload-policy";
import { StreamChat } from "stream-chat";

const origKey = process.env.STREAM_API_KEY;
const origSecret = process.env.STREAM_API_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STREAM_API_KEY = "key";
  process.env.STREAM_API_SECRET = "secret";
  mockUpdateAppSettings.mockResolvedValue({});
});

afterAll(() => {
  process.env.STREAM_API_KEY = origKey;
  process.env.STREAM_API_SECRET = origSecret;
});

describe("configureStreamUploadPolicy", () => {
  it("blocks executable/script types on the file path and caps size", async () => {
    await configureStreamUploadPolicy();

    expect(mockUpdateAppSettings).toHaveBeenCalledTimes(1);
    const arg = mockUpdateAppSettings.mock.calls[0][0];
    expect(arg.file_upload_config.blocked_file_extensions).toEqual(
      BLOCKED_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`),
    );
    expect(arg.file_upload_config.blocked_mime_types).toEqual(
      BLOCKED_UPLOAD_MIME_TYPES,
    );
    expect(arg.file_upload_config.size_limit).toBe(MAX_UPLOAD_SIZE_BYTES);
  });

  // The image endpoint is directly callable by any Stream token holder, so it
  // needs the same blocklist as the file endpoint - otherwise `.html`, `.js` and
  // `.exe` upload here and become shareable CDN links.
  it("applies the full block policy to image uploads too", async () => {
    await configureStreamUploadPolicy();

    const arg = mockUpdateAppSettings.mock.calls[0][0];
    expect(arg.image_upload_config.blocked_file_extensions).toEqual(
      BLOCKED_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`),
    );
    expect(arg.image_upload_config.blocked_mime_types).toEqual(
      BLOCKED_UPLOAD_MIME_TYPES,
    );
    expect(arg.image_upload_config.blocked_file_extensions).toEqual(
      expect.arrayContaining([".html", ".js", ".exe", ".jar", ".hta"]),
    );
    expect(arg.image_upload_config.size_limit).toBe(MAX_UPLOAD_SIZE_BYTES);
  });

  // An earlier version of this policy was narrowed to the SVG family because
  // legitimate photos were being rejected. That cannot come from these lists:
  // they contain no raster image type at all. Asserting it means a future edit
  // that adds one fails here instead of silently blocking customer photos.
  it("never blocks a raster image type", () => {
    const rasterExtensions = [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "heic",
      "heif",
      "bmp",
      "tiff",
      "avif",
    ];
    for (const extension of rasterExtensions) {
      expect(BLOCKED_UPLOAD_EXTENSIONS).not.toContain(extension);
      expect(BLOCKED_UPLOAD_MIME_TYPES).not.toContain(`image/${extension}`);
    }
    // `image/svg+xml` is the deliberate exception: SVG carries active content.
    expect(
      BLOCKED_UPLOAD_MIME_TYPES.filter((type) => type.startsWith("image/")),
    ).toEqual(["image/svg+xml"]);
  });

  it("covers the obvious malware vectors", () => {
    expect(BLOCKED_UPLOAD_EXTENSIONS).toEqual(
      expect.arrayContaining(["exe", "js", "sh", "svg", "html", "bat", "jar"]),
    );
    expect(BLOCKED_UPLOAD_MIME_TYPES).toEqual(
      expect.arrayContaining(["application/x-msdownload", "image/svg+xml"]),
    );
  });

  // Stream validates every entry with a `startswith` tag, so ONE bare
  // extension rejects the entire updateAppSettings call - and the failure is
  // caught and logged, not thrown. That is how a bare list shipped and the
  // policy silently never applied on any environment while the code called it
  // the authoritative control. Verified live: ["exe"] rejected, [".exe"] accepted.
  it("sends every blocked extension with the leading dot Stream requires", async () => {
    await configureStreamUploadPolicy();

    const arg = mockUpdateAppSettings.mock.calls[0][0];
    for (const config of [arg.file_upload_config, arg.image_upload_config]) {
      expect(config.blocked_file_extensions.length).toBe(
        BLOCKED_UPLOAD_EXTENSIONS.length,
      );
      for (const extension of config.blocked_file_extensions) {
        expect(extension.startsWith(".")).toBe(true);
      }
    }
  });

  it("skips when Stream credentials are missing", async () => {
    delete process.env.STREAM_API_KEY;
    await configureStreamUploadPolicy();
    expect(StreamChat.getInstance).not.toHaveBeenCalled();
    expect(mockUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("never throws when Stream rejects the update", async () => {
    mockUpdateAppSettings.mockRejectedValue(new Error("stream down"));
    await expect(configureStreamUploadPolicy()).resolves.toBeUndefined();
  });
});
