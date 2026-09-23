import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import { ParentCompanionController } from "../../src/controllers/app/parent-companion.controller";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import { ParentService } from "../../src/services/parent.service";
import logger from "../../src/utils/logger";

// The controller narrows on `instanceof ParentCompanionServiceError`, so the mocked
// module must expose a real class the tests can throw — an auto-mocked class would
// swallow `statusCode`/`message` and never match the narrowing.
jest.mock("../../src/services/parent-companion.service", () => {
  class MockParentCompanionServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "ParentCompanionServiceError";
    }
  }

  return {
    __esModule: true,
    ParentCompanionServiceError: MockParentCompanionServiceError,
    ParentCompanionService: {
      getLinksForParent: jest.fn(),
      getLinksForCompanion: jest.fn(),
      updatePermissions: jest.fn(),
      promoteToPrimary: jest.fn(),
      removeCoParent: jest.fn(),
    },
  };
});
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

  it("401s when the session user id is only whitespace", async () => {
    req.params = { parentId: OWNER_PARENT_ID };

    await ParentCompanionController.getLinksForParent(
      asRequest("   "),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedParentService.findByLinkedUserId).not.toHaveBeenCalled();
  });

  it("400s a blank parent id in the route", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.params = { parentId: "   " };

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-owner"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid parent ID." });
    expect(mockedLinkService.getLinksForParent).not.toHaveBeenCalled();
  });

  it("500s and logs when the parent record has no id", async () => {
    // resolveParentId throws for a record missing its primary key.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({});

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-owner"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to fetch links.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to get parent companion links",
      expect.any(Error),
    );
  });

  it("500s when the link service blows up", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForParent as any).mockRejectedValue(
      new Error("db down"),
    );

    await ParentCompanionController.getLinksForParent(
      asRequest("auth-owner"),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to fetch links.",
    });
  });
});

describe("ParentCompanionController.getLinksForCompanion error paths", () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = "auth-owner";
  });

  it("400s a blank companion id in the route", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.params = { patientId: "   " };

    await ParentCompanionController.getLinksForCompanion(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid companion ID." });
    expect(mockedLinkService.getLinksForCompanion).not.toHaveBeenCalled();
  });

  it("500s and logs when the link lookup fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.getLinksForCompanion as any).mockRejectedValue(
      new Error("boom"),
    );

    await ParentCompanionController.getLinksForCompanion(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to fetch links.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to get companion links",
      expect.any(Error),
    );
  });
});

describe("ParentCompanionController.updatePermissions", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: {},
      params: { patientId: PATIENT_ID, targetParentId: OUTSIDER_PARENT_ID },
      body: { appointments: true },
    };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = "auth-owner";
  });

  it("forwards the caller's parent id and the body to the service", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    const updated = buildLink(OUTSIDER_PARENT_ID, "ACTIVE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.updatePermissions as any).mockResolvedValue(updated);

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(mockedLinkService.updatePermissions).toHaveBeenCalledWith(
      OWNER_PARENT_ID,
      OUTSIDER_PARENT_ID,
      PATIENT_ID,
      { appointments: true },
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(updated);
  });

  /*
   * `ParentPatient.permissions` is what companion-access.ts reads on every
   * companion-gated route, so the body that writes it is parsed rather than
   * cast (#2710). These three are the boundary: an unknown key, a non-boolean,
   * and the full known set.
   */
  it("400s on an unrecognised key rather than storing it", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.body = { appointments: true, isSuperUser: true };

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(mockedLinkService.updatePermissions).not.toHaveBeenCalled();
  });

  /*
   * A silent drop would answer 200 to a caller who mistyped a feature name,
   * reporting a permission change that never happened.
   */
  it("400s rather than silently dropping a mistyped feature name", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.body = { medicalRecods: false };

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(mockedLinkService.updatePermissions).not.toHaveBeenCalled();
  });

  it.each([
    ["a string", "true"],
    ["a number", 1],
    ["null", null],
    ["an object", {}],
  ])(
    "400s when a permission is %s rather than a boolean",
    async (_l, value) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
        id: OWNER_PARENT_ID,
      });
      req.body = { appointments: value };

      await ParentCompanionController.updatePermissions(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedLinkService.updatePermissions).not.toHaveBeenCalled();
    },
  );

  /*
   * The schema must not be narrower than the type it guards: a feature the
   * product ships and the schema does not know is a 400 on a legitimate call.
   */
  it("accepts every known permission key", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.updatePermissions as any).mockResolvedValue(
      buildLink(OUTSIDER_PARENT_ID, "ACTIVE"),
    );
    const everyKey = {
      assignAsPrimaryParent: false,
      emergencyBasedPermissions: true,
      appointments: true,
      companionProfile: true,
      documents: true,
      expenses: true,
      tasks: true,
      chatWithVet: true,
      medicalRecords: true,
    };
    req.body = everyKey;

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(mockedLinkService.updatePermissions).toHaveBeenCalledWith(
      OWNER_PARENT_ID,
      OUTSIDER_PARENT_ID,
      PATIENT_ID,
      everyKey,
    );
  });

  it("treats a non-object body as an empty update set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.updatePermissions as any).mockResolvedValue(
      buildLink(OUTSIDER_PARENT_ID, "ACTIVE"),
    );
    req.body = null;

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(mockedLinkService.updatePermissions).toHaveBeenCalledWith(
      OWNER_PARENT_ID,
      OUTSIDER_PARENT_ID,
      PATIENT_ID,
      {},
    );
  });

  it("401s when the caller is not a known parent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue(null);

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Not authenticated as parent.",
    });
    expect(mockedLinkService.updatePermissions).not.toHaveBeenCalled();
  });

  it("400s when a route id is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.params = { patientId: PATIENT_ID };

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid parent or companion ID.",
    });
    expect(mockedLinkService.updatePermissions).not.toHaveBeenCalled();
  });

  it("passes a service permission rejection through with its status code", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.updatePermissions as any).mockRejectedValue(
      new ParentCompanionServiceError(
        "You are not authorized to modify this companion.",
        403,
      ),
    );

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "You are not authorized to modify this companion.",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("500s and logs an unexpected failure", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.updatePermissions as any).mockRejectedValue(
      new Error("boom"),
    );

    await ParentCompanionController.updatePermissions(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to update permissions.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to update permissions",
      expect.any(Error),
    );
  });
});

describe("ParentCompanionController.promoteToPrimary", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: {},
      params: { patientId: PATIENT_ID, targetParentId: OUTSIDER_PARENT_ID },
      body: {},
    };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = "auth-owner";
  });

  it("promotes the target parent and returns the updated link", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    const promoted = buildLink(OUTSIDER_PARENT_ID, "ACTIVE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.promoteToPrimary as any).mockResolvedValue(promoted);

    await ParentCompanionController.promoteToPrimary(
      req as Request,
      res as Response,
    );

    expect(mockedLinkService.promoteToPrimary).toHaveBeenCalledWith(
      OWNER_PARENT_ID,
      PATIENT_ID,
      OUTSIDER_PARENT_ID,
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(promoted);
  });

  it("401s when the caller is not a known parent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue(null);

    await ParentCompanionController.promoteToPrimary(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedLinkService.promoteToPrimary).not.toHaveBeenCalled();
  });

  it("400s when the target parent id is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.params = { targetParentId: OUTSIDER_PARENT_ID };

    await ParentCompanionController.promoteToPrimary(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid parent or companion ID.",
    });
    expect(mockedLinkService.promoteToPrimary).not.toHaveBeenCalled();
  });

  it("passes a service rejection through with its status code", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.promoteToPrimary as any).mockRejectedValue(
      new ParentCompanionServiceError("Co-parent link not found.", 404),
    );

    await ParentCompanionController.promoteToPrimary(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Co-parent link not found.",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("500s and logs an unexpected failure", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.promoteToPrimary as any).mockRejectedValue(
      new Error("boom"),
    );

    await ParentCompanionController.promoteToPrimary(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to promote to primary.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to promote parent to primary",
      expect.any(Error),
    );
  });
});

describe("ParentCompanionController.removeCoParent", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    req = {
      headers: {},
      params: { patientId: PATIENT_ID, coParentId: OUTSIDER_PARENT_ID },
      body: {},
    };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).userId = "auth-owner";
  });

  it("hard-removes the co-parent and answers 204 with no body", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.removeCoParent as any).mockResolvedValue(undefined);

    await ParentCompanionController.removeCoParent(
      req as Request,
      res as Response,
    );

    expect(mockedLinkService.removeCoParent).toHaveBeenCalledWith(
      OWNER_PARENT_ID,
      OUTSIDER_PARENT_ID,
      PATIENT_ID,
      false,
    );
    expect(statusMock).toHaveBeenCalledWith(204);
    expect(sendMock).toHaveBeenCalledWith();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it("401s when the caller is not a known parent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue(null);

    await ParentCompanionController.removeCoParent(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockedLinkService.removeCoParent).not.toHaveBeenCalled();
  });

  it("400s when the co-parent id is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    req.params = { patientId: PATIENT_ID };

    await ParentCompanionController.removeCoParent(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid parent or companion ID.",
    });
    expect(mockedLinkService.removeCoParent).not.toHaveBeenCalled();
  });

  it("passes the service's 403 through when the caller is not primary", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OUTSIDER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.removeCoParent as any).mockRejectedValue(
      new ParentCompanionServiceError(
        "You are not authorized to modify this companion.",
        403,
      ),
    );

    await ParentCompanionController.removeCoParent(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "You are not authorized to modify this companion.",
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("500s and logs an unexpected failure", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedParentService.findByLinkedUserId as any).mockResolvedValue({
      id: OWNER_PARENT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedLinkService.removeCoParent as any).mockRejectedValue(
      new Error("boom"),
    );

    await ParentCompanionController.removeCoParent(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unable to remove co-parent.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to remove co-parent",
      expect.any(Error),
    );
  });
});
