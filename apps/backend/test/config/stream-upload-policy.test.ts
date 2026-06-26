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
  it("blocks executable/script types and caps size on both upload paths", async () => {
    await configureStreamUploadPolicy();

    expect(mockUpdateAppSettings).toHaveBeenCalledTimes(1);
    const arg = mockUpdateAppSettings.mock.calls[0][0];
    expect(arg.file_upload_config.blocked_file_extensions).toEqual(
      BLOCKED_UPLOAD_EXTENSIONS,
    );
    expect(arg.file_upload_config.blocked_mime_types).toEqual(
      BLOCKED_UPLOAD_MIME_TYPES,
    );
    expect(arg.file_upload_config.size_limit).toBe(MAX_UPLOAD_SIZE_BYTES);
    expect(arg.image_upload_config.blocked_file_extensions).toEqual(
      BLOCKED_UPLOAD_EXTENSIONS,
    );
  });

  it("covers the obvious malware vectors", () => {
    expect(BLOCKED_UPLOAD_EXTENSIONS).toEqual(
      expect.arrayContaining(["exe", "js", "sh", "svg", "html", "bat", "jar"]),
    );
    expect(BLOCKED_UPLOAD_MIME_TYPES).toEqual(
      expect.arrayContaining(["application/x-msdownload", "image/svg+xml"]),
    );
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
