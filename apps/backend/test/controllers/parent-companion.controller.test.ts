import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import { ParentCompanionController } from "../../src/controllers/app/parent-companion.controller";
import { ParentCompanionService } from "../../src/services/parent-companion.service";
import { ParentService } from "../../src/services/parent.service";

jest.mock("../../src/services/parent-companion.service");
jest.mock("../../src/services/parent.service");
jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedLinkService = jest.mocked(ParentCompanionService);
const mockedParentService = jest.mocked(ParentService);

const OWNER_PARENT_ID = "parent-owner";
const OUTSIDER_PARENT_ID = "parent-outsider";
const PATIENT_ID = "patient-1";

const buildLink = (parentId: string, status: string) =>
  ({
    parentId,
    role: "PRIMARY",
    status,
    permissions: {},
    parent: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phoneNumber: "+15550100",
      profileImageUrl: "https://example.com/ada.png",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("ParentCompanionController.getLinksForCompanion", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { headers: {}, params: { patientId: PATIENT_ID }, body: {} };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
  });

  const asRequest = (userId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = userId;
    return req as Request;
  };

  it("returns the links to a parent holding an ACTIVE link", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    const links = [buildLink(OWNER_PARENT_ID, "ACTIVE")];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForCompanion as any).mockResolvedValue(links);

    await ParentCompanionController.getLinksForCompanion(
      asRequest("auth-owner"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ links });
  });

  it("404s a parent with no link to the companion and leaks no parent PII", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OUTSIDER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForCompanion as any).mockResolvedValue([
      buildLink(OWNER_PARENT_ID, "ACTIVE"),
    ]);

    await ParentCompanionController.getLinksForCompanion(
      asRequest("auth-outsider"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Companion not found." });
    expect(jsonMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ links: expect.anything() }),
    );
  });

  it("404s a parent whose own link is still PENDING", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OUTSIDER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForCompanion as any).mockResolvedValue([
      buildLink(OWNER_PARENT_ID, "ACTIVE"),
      buildLink(OUTSIDER_PARENT_ID, "PENDING"),
    ]);

    await ParentCompanionController.getLinksForCompanion(
      asRequest("auth-outsider"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it("401s when the caller is not a known parent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue(null);

    await ParentCompanionController.getLinksForCompanion(
      asRequest("auth-unknown"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedLinkService.getLinksForCompanion).not.toHaveBeenCalled();
  });
});

describe("ParentCompanionController.getLinksForParent", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { headers: {}, params: { parentId: OWNER_PARENT_ID }, body: {} };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
  });

  const asRequest = (userId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = userId;
    return req as Request;
  };

  it("returns the links to the parent they belong to", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    const links = [buildLink(OWNER_PARENT_ID, "ACTIVE")];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForParent as any).mockResolvedValue(links);

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-owner"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ links });
  });

  it("404s another parent's id without disclosing whether it exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OUTSIDER_PARENT_ID,
    });

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-outsider"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Parent not found." });
    expect(mockedLinkService.getLinksForParent).not.toHaveBeenCalled();
  });

  it("401s when the caller is not a known parent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue(null);

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-unknown"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedLinkService.getLinksForParent).not.toHaveBeenCalled();
  });

  it("401s when the request carries no verified session user", async () => {
    await ParentCompanionController.getLinksForParent(
      asRequest(undefined),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedParentService.findByLinkedUserId).not.toHaveBeenCalled();
    expect(mockedLinkService.getLinksForParent).not.toHaveBeenCalled();
  });
});
