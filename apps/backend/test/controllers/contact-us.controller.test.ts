import { ContactController } from "../../src/controllers/app/contact-us.controller";
import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import {
  ATTACHMENT_MIME_TYPES,
  generatePresignedUrl,
  getURLForKey,
} from "../../src/middlewares/upload";

jest.mock("../../src/services/contact-us.service", () => {
  const actual = jest.requireActual("../../src/services/contact-us.service");
  return {
    ...actual,
    ContactService: {
      createRequest: jest.fn(),
      createWebRequest: jest.fn(),
      listRequests: jest.fn(),
      getById: jest.fn(),
      updateStatus: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  // The real allowlists, so the controller's rejection of a disallowed type is
  // exercised rather than restated by the mock.
  ...jest.requireActual("../../src/middlewares/upload"),
  generatePresignedUrl: jest.fn(),
  getURLForKey: jest.fn(),
}));

const mockedContactService = ContactService as unknown as {
  createRequest: jest.Mock;
  createWebRequest: jest.Mock;
  listRequests: jest.Mock;
  getById: jest.Mock;
  updateStatus: jest.Mock;
};

const mockedAuthUserMobileService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedGeneratePresignedUrl = generatePresignedUrl as jest.Mock;
const mockedGetURLForKey = getURLForKey as jest.Mock;

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("ContactController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("returns 404 when mobile user is not found", async () => {
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null,
      );
      const req = {
        userId: "user-1",
        headers: {},
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Hello",
          message: "World",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found for provided userId.",
      });
      expect(mockedContactService.createRequest).not.toHaveBeenCalled();
    });

    it("creates a contact request using resolved ids", async () => {
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: { toString: () => "parent-123" },
      });
      mockedContactService.createRequest.mockResolvedValueOnce({
        id: "contact-1",
      });
      const req = {
        userId: "user-1",
        headers: {},
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
          email: "a@b.com",
          organisationId: "org-1",
          parentId: "body-parent",
          userId: "body-user",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(mockedContactService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
          email: "a@b.com",
          organisationId: "org-1",
          parentId: "parent-123",
          userId: "user-1",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "contact-1" });
    });

    it("handles ContactServiceError responses", async () => {
      mockedContactService.createRequest.mockRejectedValueOnce(
        new ContactServiceError("invalid", 422),
      );
      const req = {
        headers: {},
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "invalid" });
    });
  });

  describe("list", () => {
    it("returns filtered contact requests", async () => {
      const docs = [{ id: "1" }];
      mockedContactService.listRequests.mockResolvedValueOnce(docs);
      const req = {
        query: { status: "OPEN", type: "DSAR", organisationId: "org-1" },
      } as any;
      const res = createResponse();

      await ContactController.list(req as any, res as any);

      expect(mockedContactService.listRequests).toHaveBeenCalledWith({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org-1",
      });
      expect(res.json).toHaveBeenCalledWith(docs);
    });

    it("handles errors", async () => {
      mockedContactService.listRequests.mockRejectedValueOnce(
        new Error("failed"),
      );
      const req = { query: {} } as any;
      const res = createResponse();

      await ContactController.list(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("createWeb", () => {
    it("discards a submission that filled the honeypot, without storing or forwarding it", async () => {
      /* The site form renders `website` hidden from people and from assistive
         technology, so a non-empty value means a form-filling bot (#2645). */
      const req = {
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MARKETING_SITE",
          message: "buy cheap watches",
          fullName: "Bot",
          email: "bot@spam.example",
          website: "http://spam.example",
        },
      } as any;
      const res = createResponse();

      await ContactController.createWeb(req as any, res as any);

      expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
      /* 201 with a plausible id, deliberately: a bot that learns which
         submissions were dropped stops filling the field and the run continues
         undetected. */
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("treats a whitespace-only honeypot as empty", async () => {
      // A browser or extension that writes a space must not bin a real message.
      mockedContactService.createWebRequest.mockResolvedValueOnce({
        id: "contact-web-ws",
      });
      const req = {
        body: {
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          message: "Help",
          fullName: "Web User",
          email: "web@user.com",
          website: "   ",
        },
      } as any;
      const res = createResponse();

      await ContactController.createWeb(req as any, res as any);

      expect(mockedContactService.createWebRequest).toHaveBeenCalled();
    });

    it("never stores or forwards the honeypot field itself", async () => {
      /* It is a wire-only field. Persisting it would put an attacker-controlled
         string into the CRM mirror that nothing downstream expects. */
      mockedContactService.createWebRequest.mockResolvedValueOnce({
        id: "contact-web-2",
      });
      const req = {
        body: {
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          message: "Help",
          fullName: "Web User",
          email: "web@user.com",
          website: "",
        },
      } as any;
      const res = createResponse();

      await ContactController.createWeb(req as any, res as any);

      const stored = mockedContactService.createWebRequest.mock.calls[0][0];
      expect(stored).not.toHaveProperty("website");
    });

    it("creates a web contact request", async () => {
      mockedContactService.createWebRequest.mockResolvedValueOnce({
        id: "contact-web-1",
      });
      const req = {
        body: {
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          message: "Help",
          fullName: "Web User",
          email: "web@user.com",
          phone: "1234567890",
        },
      } as any;
      const res = createResponse();

      await ContactController.createWeb(req as any, res as any);

      expect(mockedContactService.createWebRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          message: "Help",
          fullName: "Web User",
          email: "web@user.com",
          phone: "1234567890",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "contact-web-1" });
    });

    /* The mirror forward is queued inside createWebRequest, in the same insert
       as the submission (#3329), and drained by a background job. The
       controller sends nothing, so the visitor's 201 cannot be delayed or
       failed by the panel, and a submission whose write failed has no forward
       row to drain. The queuing itself is pinned in the service suite. */
    it("responds without awaiting any panel call", async () => {
      mockedContactService.createWebRequest.mockResolvedValueOnce({
        id: "contact-web-2",
      });
      const body = {
        type: "GENERAL_ENQUIRY",
        source: "PMS_WEB",
        message: "Help",
        fullName: "Web User",
        email: "web@user.com",
        phone: "1234567890",
      };
      const res = createResponse();

      await ContactController.createWeb({ body } as any, res as any);

      expect(mockedContactService.createWebRequest).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "contact-web-2" });
    });

    it("handles ContactServiceError responses", async () => {
      mockedContactService.createWebRequest.mockRejectedValueOnce(
        new ContactServiceError("invalid", 422),
      );
      const req = {
        body: {
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          message: "Help",
          fullName: "Web User",
          email: "web@user.com",
        },
      } as any;
      const res = createResponse();

      await ContactController.createWeb(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "invalid" });
    });

    describe("bot check", () => {
      const SITEVERIFY_URL =
        "https://challenges.cloudflare.com/turnstile/v0/siteverify";
      const REQUIRED_ERROR = {
        message: "Complete bot verification before sending your message.",
      };
      const REJECTED_ERROR = {
        message:
          "We could not verify this message. Please refresh and try again.",
      };
      const originalFetch = globalThis.fetch;
      const originalSecret = process.env.TURNSTILE_SECRET_KEY;
      const originalDomain = process.env.AUTH_WEBSITE_DOMAIN;
      let fetchMock: jest.Mock;

      const restoreEnv = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };

      const answerWith = (result: Record<string, unknown>) => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => result });
      };

      const webRequest = (extra: Record<string, unknown> = {}) =>
        ({
          ip: "198.51.100.7",
          body: {
            type: "GENERAL_ENQUIRY",
            source: "PMS_WEB",
            message: "Help",
            fullName: "Web User",
            email: "web@user.com",
            website: "",
            ...extra,
          },
        }) as any;

      beforeEach(() => {
        fetchMock = jest.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        process.env.TURNSTILE_SECRET_KEY = "synthetic secret value";
        process.env.AUTH_WEBSITE_DOMAIN = "https://site.example.test";
        mockedContactService.createWebRequest.mockResolvedValue({
          id: "contact-web-verified",
        });
      });

      afterEach(() => {
        globalThis.fetch = originalFetch;
        restoreEnv("TURNSTILE_SECRET_KEY", originalSecret);
        restoreEnv("AUTH_WEBSITE_DOMAIN", originalDomain);
        mockedContactService.createWebRequest.mockReset();
      });

      it("is not required when no secret is configured", async () => {
        process.env.TURNSTILE_SECRET_KEY = "   ";
        const res = createResponse();

        await ContactController.createWeb(webRequest(), res as any);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockedContactService.createWebRequest).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "contact-web-verified" });
      });

      it("refuses a submission with no token, without calling Cloudflare", async () => {
        const res = createResponse();

        await ContactController.createWeb(webRequest(), res as any);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(REQUIRED_ERROR);
      });

      it("refuses an oversized token, without calling Cloudflare", async () => {
        const res = createResponse();

        await ContactController.createWeb(
          webRequest({ turnstileToken: "x".repeat(2049) }),
          res as any,
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(REQUIRED_ERROR);
      });

      it("accepts a verified token and never passes it on", async () => {
        answerWith({
          success: true,
          action: "contact_form",
          hostname: "site.example.test",
        });
        const res = createResponse();

        await ContactController.createWeb(
          webRequest({ turnstileToken: "synthetic widget token" }),
          res as any,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(SITEVERIFY_URL);
        const body = init.body as URLSearchParams;
        expect(body.get("secret")).toBe("synthetic secret value");
        expect(body.get("response")).toBe("synthetic widget token");
        expect(body.get("remoteip")).toBe("198.51.100.7");

        const stored = mockedContactService.createWebRequest.mock.calls[0][0];
        expect(stored).not.toHaveProperty("turnstileToken");
        expect(JSON.stringify(stored)).not.toContain("synthetic widget token");
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "contact-web-verified" });
      });

      it.each([
        [
          "a different action",
          {
            success: true,
            action: "business_signup",
            hostname: "site.example.test",
          },
        ],
        [
          "a different hostname",
          {
            success: true,
            action: "contact_form",
            hostname: "other.example.test",
          },
        ],
        [
          "an unsuccessful answer",
          {
            success: false,
            action: "contact_form",
            hostname: "site.example.test",
          },
        ],
      ])("refuses a token with %s", async (_label, result) => {
        answerWith(result);
        const res = createResponse();

        await ContactController.createWeb(
          webRequest({ turnstileToken: "synthetic widget token" }),
          res as any,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(REJECTED_ERROR);
      });

      it("fails closed when Cloudflare cannot be reached", async () => {
        fetchMock.mockRejectedValue(new Error("synthetic network failure"));
        const res = createResponse();

        await ContactController.createWeb(
          webRequest({ turnstileToken: "synthetic widget token" }),
          res as any,
        );

        expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(REJECTED_ERROR);
        expect(console.error).toHaveBeenCalledWith(
          "[auth] Turnstile verification failed",
          expect.any(Error),
        );
      });

      it.each([
        ["unset", undefined],
        ["not a URL", "not a url"],
      ])(
        "fails closed without a 500 when the site domain is %s",
        async (_label, domain) => {
          restoreEnv("AUTH_WEBSITE_DOMAIN", domain);
          const res = createResponse();

          await ContactController.createWeb(
            webRequest({ turnstileToken: "synthetic widget token" }),
            res as any,
          );

          expect(fetchMock).not.toHaveBeenCalled();
          expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith(REJECTED_ERROR);
        },
      );

      it("still lets the honeypot answer first, without calling Cloudflare", async () => {
        const res = createResponse();

        await ContactController.createWeb(
          webRequest({ website: "http://spam.example" }),
          res as any,
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockedContactService.createWebRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      });
    });
  });

  describe("getById", () => {
    it("returns 404 when not found", async () => {
      mockedContactService.getById.mockResolvedValueOnce(null);
      const req = { params: { id: "missing" } } as any;
      const res = createResponse();

      await ContactController.getById(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("returns document when found", async () => {
      const doc = { id: "contact-1" };
      mockedContactService.getById.mockResolvedValueOnce(doc);
      const req = { params: { id: "contact-1" } } as any;
      const res = createResponse();

      await ContactController.getById(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(doc);
    });
  });

  describe("updateStatus", () => {
    it("rejects invalid status", async () => {
      const req = { params: { id: "1" }, body: { status: "INVALID" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid status value",
      });
      expect(mockedContactService.updateStatus).not.toHaveBeenCalled();
    });

    it("returns 404 when contact is missing", async () => {
      mockedContactService.updateStatus.mockResolvedValueOnce(null);
      const req = { params: { id: "1" }, body: { status: "RESOLVED" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(mockedContactService.updateStatus).toHaveBeenCalledWith(
        "1",
        "RESOLVED",
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("updates status successfully", async () => {
      const updated = { id: "1", status: "RESOLVED" };
      mockedContactService.updateStatus.mockResolvedValueOnce(updated);
      const req = { params: { id: "1" }, body: { status: "RESOLVED" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });

  describe("getAttachmentUploadUrl", () => {
    it("returns 400 if mimeType is missing", async () => {
      const req = { body: {} } as any;
      const res = createResponse();

      await ContactController.getAttachmentUploadUrl(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "A supported mimeType is required.",
      });
    });

    // This route is reachable without a session, so a disallowed type must never reach S3.
    it.each(["text/html", "application/javascript", "image/svg+xml"])(
      "returns 400 without minting a URL for %s",
      async (mimeType) => {
        const req = { body: { mimeType } } as any;
        const res = createResponse();

        await ContactController.getAttachmentUploadUrl(req as any, res as any);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockedGeneratePresignedUrl).not.toHaveBeenCalled();
      },
    );

    it("returns 400 when mimeType is a structured value", async () => {
      const req = { body: { mimeType: { not: null } } } as any;
      const res = createResponse();

      await ContactController.getAttachmentUploadUrl(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedGeneratePresignedUrl).not.toHaveBeenCalled();
    });

    it("returns presigned upload URL with fileUrl", async () => {
      mockedGeneratePresignedUrl.mockResolvedValueOnce({
        url: "https://upload.url",
        key: "contact-us/abc.png",
      });
      mockedGetURLForKey.mockReturnValueOnce("https://cdn/abc.png");
      const req = { body: { mimeType: "image/png" } } as any;
      const res = createResponse();

      await ContactController.getAttachmentUploadUrl(req as any, res as any);

      expect(mockedGeneratePresignedUrl).toHaveBeenCalledWith(
        "image/png",
        "custom",
        "contact-us",
        ATTACHMENT_MIME_TYPES,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        uploadUrl: "https://upload.url",
        s3Key: "contact-us/abc.png",
        fileUrl: "https://cdn/abc.png",
      });
    });

    it("handles errors", async () => {
      mockedGeneratePresignedUrl.mockRejectedValueOnce(new Error("fail"));
      const req = { body: { mimeType: "image/png" } } as any;
      const res = createResponse();

      await ContactController.getAttachmentUploadUrl(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to generate upload URL",
      });
    });
  });
});
