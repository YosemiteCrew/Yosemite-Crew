import { PracticeWebsiteController } from "../../src/controllers/web/practice-website.controller";
import { PublicSiteController } from "../../src/controllers/app/public-site.controller";
import {
  PracticeWebsiteError,
  PracticeWebsiteService,
} from "../../src/services/practice-website.service";
import { PublicBookingError } from "../../src/services/public-booking.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/practice-website.service", () => {
  const actual = jest.requireActual(
    "../../src/services/practice-website.service",
  );
  return {
    ...actual,
    PracticeWebsiteService: {
      getConfig: jest.fn(),
      saveConfig: jest.fn(),
      getPublicSite: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const service = PracticeWebsiteService as unknown as {
  getConfig: jest.Mock;
  saveConfig: jest.Mock;
  getPublicSite: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const orgRequest = (
  body: unknown = {},
  organisationId: string | null = "org-1",
) =>
  ({
    organisationId: organisationId ?? undefined,
    params: { organisationId: "other-org" },
    body,
  }) as never;

const validBody = {
  templateId: "city-vets",
  headline: "  Park Vets  ",
  tagline: "",
  about: "Family practice.",
  published: true,
};

describe("PracticeWebsiteController", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the config for the authorized organisation, not the route param", async () => {
    service.getConfig.mockResolvedValue({ headline: "Park Vets" });
    const res = createResponse();

    await PracticeWebsiteController.getConfig(orgRequest(), res as never);

    expect(service.getConfig).toHaveBeenCalledWith("org-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { headline: "Park Vets" } });
  });

  it("400s when no organisation was authorized", async () => {
    const res = createResponse();

    await PracticeWebsiteController.getConfig(
      orgRequest({}, null),
      res as never,
    );
    await PracticeWebsiteController.saveConfig(
      orgRequest(validBody, null),
      res as never,
    );

    expect(res.status).toHaveBeenNthCalledWith(1, 400);
    expect(res.status).toHaveBeenNthCalledWith(2, 400);
    expect(service.getConfig).not.toHaveBeenCalled();
    expect(service.saveConfig).not.toHaveBeenCalled();
  });

  it("trims copy and turns blank optional fields into null before saving", async () => {
    service.saveConfig.mockResolvedValue({});
    const res = createResponse();

    await PracticeWebsiteController.saveConfig(
      orgRequest(validBody),
      res as never,
    );

    expect(service.saveConfig).toHaveBeenCalledWith("org-1", {
      templateId: "city-vets",
      headline: "Park Vets",
      tagline: null,
      about: "Family practice.",
      published: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    ["an unknown template", { ...validBody, templateId: "brutalist" }],
    ["an empty headline", { ...validBody, headline: "   " }],
    ["an overlong headline", { ...validBody, headline: "x".repeat(121) }],
    ["an overlong about", { ...validBody, about: "x".repeat(2001) }],
    ["a missing published flag", { ...validBody, published: undefined }],
  ])("rejects %s", async (_label, body) => {
    const res = createResponse();

    await PracticeWebsiteController.saveConfig(orgRequest(body), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.saveConfig).not.toHaveBeenCalled();
  });

  it("passes a deliberate service error through with its status", async () => {
    service.saveConfig.mockRejectedValue(
      new PracticeWebsiteError("Turn on online booking first.", 409),
    );
    const res = createResponse();

    await PracticeWebsiteController.saveConfig(
      orgRequest(validBody),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Turn on online booking first.",
    });
  });

  it("hides an unexpected failure behind a flat 500", async () => {
    service.getConfig.mockRejectedValue(new Error("db down"));
    const res = createResponse();

    await PracticeWebsiteController.getConfig(orgRequest(), res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Something went wrong" });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("PublicSiteController", () => {
  const slugRequest = { params: { slug: "park-vets" } } as never;

  beforeEach(() => jest.clearAllMocks());

  it("returns a published site", async () => {
    service.getPublicSite.mockResolvedValue({
      kind: "site",
      site: { headline: "Park Vets" },
    });
    const res = createResponse();

    await PublicSiteController.getSite(slugRequest, res as never);

    expect(service.getPublicSite).toHaveBeenCalledWith("park-vets");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { headline: "Park Vets" } });
  });

  it("tells the page where a retired slug went", async () => {
    service.getPublicSite.mockResolvedValue({
      kind: "redirect",
      slug: "new-vets",
    });
    const res = createResponse();

    await PublicSiteController.getSite(slugRequest, res as never);

    expect(res.json).toHaveBeenCalledWith({ data: { redirectTo: "new-vets" } });
  });

  it.each([
    [new PracticeWebsiteError("Site not found", 404)],
    [new PublicBookingError("Not found", 404)],
  ])("answers a declined lookup with its own status", async (error) => {
    service.getPublicSite.mockRejectedValue(error);
    const res = createResponse();

    await PublicSiteController.getSite(slugRequest, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("hides an unexpected failure behind a flat 500", async () => {
    service.getPublicSite.mockRejectedValue(new Error("db down"));
    const res = createResponse();

    await PublicSiteController.getSite(slugRequest, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Something went wrong" });
  });
});
