import { PracticeProfileFieldsController } from "../../../src/controllers/app/practice-profile-fields.controller";
import type { Request, Response } from "express";
import {
  PracticeProfileFieldsError,
  PracticeProfileFieldsService,
} from "../../../src/services/practice-profile-fields.service";

jest.mock("../../../src/services/practice-profile-fields.service", () => ({
  PracticeProfileFieldsError: class PracticeProfileFieldsError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  },
  PracticeProfileFieldsService: {
    list: jest.fn(),
    create: jest.fn(),
    deactivate: jest.fn(),
    saveValues: jest.fn(),
  },
}));
jest.mock("src/utils/logger", () => ({ error: jest.fn() }));

const service = PracticeProfileFieldsService as jest.Mocked<
  typeof PracticeProfileFieldsService
>;

const makeRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    params: {
      entityType: "PATIENT",
      entityId: "9da2fc52-4f92-4411-b499-0c4897ca4a7d",
      fieldId: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
    },
    body: {},
    organisationId: "org-1",
    userPermissions: ["companions:view:any", "companions:edit:any"],
    ...overrides,
  }) as unknown as Request;

const makeResponse = () => {
  let sent = false;
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(() => {
      sent = true;
    }),
    send: jest.fn(() => {
      sent = true;
    }),
    get headersSent() {
      return sent;
    },
  };
  return response as unknown as Response;
};

describe("PracticeProfileFieldsController", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns fields for a valid request", async () => {
    service.list.mockResolvedValue([{ id: "field-1" }] as never);
    const res = makeResponse();

    await PracticeProfileFieldsController.list(makeRequest(), res);

    expect(service.list).toHaveBeenCalledWith(
      "PATIENT",
      "9da2fc52-4f92-4411-b499-0c4897ca4a7d",
      "org-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "field-1" }]);
  });

  it("rejects missing permissions and invalid entity types", async () => {
    const noPermissions = makeResponse();
    await PracticeProfileFieldsController.list(
      makeRequest({ userPermissions: undefined }),
      noPermissions,
    );
    expect(noPermissions.status).toHaveBeenCalledWith(500);

    const invalidType = makeResponse();
    await PracticeProfileFieldsController.list(
      makeRequest({ params: { entityType: "OTHER", entityId: "id" } }),
      invalidType,
    );
    expect(invalidType.status).toHaveBeenCalledWith(400);
    expect(service.list).not.toHaveBeenCalled();

    const invalidId = makeResponse();
    await PracticeProfileFieldsController.list(
      makeRequest({
        params: { entityType: "PATIENT", entityId: "not-a-uuid" },
      }),
      invalidId,
    );
    expect(invalidId.status).toHaveBeenCalledWith(400);
  });

  it("maps known and unexpected list errors", async () => {
    service.list.mockRejectedValueOnce(
      new PracticeProfileFieldsError("Missing", 404),
    );
    const knownError = makeResponse();
    await PracticeProfileFieldsController.list(makeRequest(), knownError);
    expect(knownError.status).toHaveBeenCalledWith(404);

    service.list.mockRejectedValueOnce(new Error("database"));
    const unknownError = makeResponse();
    await PracticeProfileFieldsController.list(makeRequest(), unknownError);
    expect(unknownError.status).toHaveBeenCalledWith(500);
  });

  it("creates a field after validating the body", async () => {
    service.create.mockResolvedValue({ id: "field-1" } as never);
    const res = makeResponse();
    await PracticeProfileFieldsController.create(
      makeRequest({ body: { label: "Color", type: "TEXT" } }),
      res,
    );
    expect(service.create).toHaveBeenCalledWith("PATIENT", "org-1", {
      label: "Color",
      type: "TEXT",
      options: [],
    });
    expect(res.status).toHaveBeenCalledWith(201);

    const invalid = makeResponse();
    await PracticeProfileFieldsController.create(
      makeRequest({ body: { label: "", type: "UNKNOWN" } }),
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  it("maps field-creation errors and rejects a missing organisation", async () => {
    service.create.mockRejectedValueOnce(
      new PracticeProfileFieldsError("Duplicate", 409),
    );
    const conflict = makeResponse();
    await PracticeProfileFieldsController.create(
      makeRequest({ body: { label: "Color", type: "TEXT" } }),
      conflict,
    );
    expect(conflict.status).toHaveBeenCalledWith(409);

    const missingOrganisation = makeResponse();
    await PracticeProfileFieldsController.create(
      makeRequest({ organisationId: undefined }),
      missingOrganisation,
    );
    expect(missingOrganisation.status).toHaveBeenCalledWith(400);
  });

  it("deactivates a field definition", async () => {
    const res = makeResponse();
    await PracticeProfileFieldsController.deactivate(makeRequest(), res);

    expect(service.deactivate).toHaveBeenCalledWith(
      "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
      "org-1",
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("handles deactivation errors and missing organisation context", async () => {
    service.deactivate.mockRejectedValueOnce(new Error("database"));
    const failed = makeResponse();
    await PracticeProfileFieldsController.deactivate(makeRequest(), failed);
    expect(failed.status).toHaveBeenCalledWith(500);

    const missingOrganisation = makeResponse();
    await PracticeProfileFieldsController.deactivate(
      makeRequest({ organisationId: undefined }),
      missingOrganisation,
    );
    expect(missingOrganisation.status).toHaveBeenCalledWith(400);

    const invalidId = makeResponse();
    await PracticeProfileFieldsController.deactivate(
      makeRequest({ params: { fieldId: "not-a-uuid" } }),
      invalidId,
    );
    expect(invalidId.status).toHaveBeenCalledWith(400);
  });

  it("saves a validated list of profile values", async () => {
    const values = [
      { fieldId: "9da2fc52-4f92-4411-b499-0c4897ca4a7d", value: "Blue" },
    ];
    const res = makeResponse();
    await PracticeProfileFieldsController.saveValues(
      makeRequest({ body: { values } }),
      res,
    );
    expect(service.saveValues).toHaveBeenCalledWith(
      "PATIENT",
      "9da2fc52-4f92-4411-b499-0c4897ca4a7d",
      "org-1",
      values,
    );
    expect(res.status).toHaveBeenCalledWith(204);

    const invalid = makeResponse();
    await PracticeProfileFieldsController.saveValues(
      makeRequest({ body: { values: [{ fieldId: "bad", value: "Blue" }] } }),
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);

    const invalidEntityId = makeResponse();
    await PracticeProfileFieldsController.saveValues(
      makeRequest({
        params: { entityType: "PATIENT", entityId: "not-a-uuid" },
        body: { values },
      }),
      invalidEntityId,
    );
    expect(invalidEntityId.status).toHaveBeenCalledWith(400);
  });

  it("maps save errors and rejects a missing organisation", async () => {
    const values = [
      { fieldId: "9da2fc52-4f92-4411-b499-0c4897ca4a7d", value: "Blue" },
    ];
    service.saveValues.mockRejectedValueOnce(
      new PracticeProfileFieldsError("Profile not found.", 404),
    );
    const missingProfile = makeResponse();
    await PracticeProfileFieldsController.saveValues(
      makeRequest({ body: { values } }),
      missingProfile,
    );
    expect(missingProfile.status).toHaveBeenCalledWith(404);

    const missingOrganisation = makeResponse();
    await PracticeProfileFieldsController.saveValues(
      makeRequest({ organisationId: undefined, body: { values } }),
      missingOrganisation,
    );
    expect(missingOrganisation.status).toHaveBeenCalledWith(400);
  });
});
