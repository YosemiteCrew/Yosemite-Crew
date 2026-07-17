import { Types } from "mongoose";

import { OrganisationInviteService } from "../../src/services/organisation-invite.service";
import OrganisationInviteModel from "../../src/models/organisationInvite";
import OrganizationModel from "../../src/models/organization";
import { isReadFromPostgres } from "src/config/read-switch";

jest.mock("../../src/models/organisationInvite", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/speciality", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organisationInvite: { findMany: jest.fn() },
    organization: { findFirst: jest.fn() },
  },
}));

jest.mock("../../src/utils/dual-write", () => ({
  shouldDualWrite: false,
  handleDualWriteError: jest.fn(),
}));

jest.mock("../../src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("./../../src/services/user-organization.service", () => ({
  UserOrganizationService: {},
  UserOrganizationServiceError: class extends Error {},
}));

const buildInviteDoc = (organisationId: string) => ({
  _id: new Types.ObjectId(),
  organisationId,
  invitedByUserId: "user-1",
  departmentIds: [],
  inviteeEmail: "vet@example.com",
  inviteeName: "Vet",
  role: "VET",
  employmentType: "FULL_TIME",
  token: "token-1",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 1000),
  acceptedAt: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  toObject: () => ({
    _id: new Types.ObjectId(),
    organisationId,
    invitedByUserId: "user-1",
    departmentIds: [],
    inviteeEmail: "vet@example.com",
    inviteeName: "Vet",
    role: "VET",
    employmentType: "FULL_TIME",
    token: "token-1",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 1000),
    acceptedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
});

const mockInviteFind = (docs: unknown[]) => {
  (OrganisationInviteModel.find as jest.Mock).mockReturnValue({
    sort: jest.fn().mockResolvedValue(docs),
  });
};

const mockOrganisationFindOne = (organisation: unknown) => {
  (OrganizationModel.findOne as jest.Mock).mockReturnValue({
    setOptions: jest.fn().mockResolvedValue(organisation),
  });
};

describe("OrganisationInviteService.listPendingInvitesForEmail (mongo)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
  });

  it("resolves the organisation for an ObjectId organisationId", async () => {
    const orgId = new Types.ObjectId().toHexString();
    mockInviteFind([buildInviteDoc(orgId)]);
    mockOrganisationFindOne({ name: "Clinic", type: "CLINIC" });

    const results =
      await OrganisationInviteService.listPendingInvitesForEmail(
        "vet@example.com",
      );

    // A 24-char hex id is a valid ObjectId *and* a valid fhirId, so the lookup
    // matches on either - the same predicate findOrganisationOrThrow builds.
    expect(OrganizationModel.findOne).toHaveBeenCalledWith({
      $or: [{ _id: orgId }, { fhirId: orgId }],
    });
    expect(results[0].organisationName).toBe("Clinic");
  });

  it("resolves a fhir-style organisationId without throwing", async () => {
    // Post-migration invites carry a Postgres uuid / FHIR id, not an ObjectId.
    const orgId = "0f9d3e1a-6c2b-4f77-9a1e-2b7c5d8e4f13";
    mockInviteFind([buildInviteDoc(orgId)]);
    mockOrganisationFindOne({ name: "Referral Hospital", type: "HOSPITAL" });

    const results =
      await OrganisationInviteService.listPendingInvitesForEmail(
        "vet@example.com",
      );

    expect(OrganizationModel.findOne).toHaveBeenCalledWith({ fhirId: orgId });
    expect(results[0].organisationName).toBe("Referral Hospital");
    expect(results[0].organisationType).toBe("HOSPITAL");
  });
});
