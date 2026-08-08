const mockOrganizationFindMany = jest.fn();
const mockOrganizationFindFirst = jest.fn();
const mockOrganizationUpdate = jest.fn();
const mockUserOrganizationCount = jest.fn();

const mockPrisma = {
  organization: {
    findMany: mockOrganizationFindMany,
    findFirst: mockOrganizationFindFirst,
    update: mockOrganizationUpdate,
  },
  userOrganization: {
    count: mockUserOrganizationCount,
  },
};

jest.mock("src/config/prisma", () => ({ prisma: mockPrisma }));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  SuperAdminBusinessService,
  SuperAdminBusinessServiceError,
} from "src/services/super-admin-business.service";

describe("SuperAdminBusinessService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists businesses ordered by createdAt desc with member counts", async () => {
    mockOrganizationFindMany.mockResolvedValue([
      {
        id: "org-new",
        name: "New Clinic",
        type: "HOSPITAL",
        isVerified: true,
        isActive: true,
        taxId: "TAX-2",
        phoneNo: "+1 222 222 2222",
        website: "https://new.example",
        createdAt: new Date("2026-07-22T12:00:00.000Z"),
      },
      {
        id: "org-old",
        name: "Old Clinic",
        type: "GROOMER",
        isVerified: false,
        isActive: true,
        taxId: "TAX-1",
        phoneNo: "+1 111 111 1111",
        website: null,
        createdAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ]);
    mockUserOrganizationCount.mockImplementation(
      async ({ where }: { where: { organizationReference: string } }) =>
        where.organizationReference === "org-new" ? 3 : 0,
    );

    await expect(SuperAdminBusinessService.listBusinesses()).resolves.toEqual([
      {
        id: "org-new",
        name: "New Clinic",
        type: "HOSPITAL",
        isVerified: true,
        isActive: true,
        memberCount: 3,
        createdAt: "2026-07-22T12:00:00.000Z",
        taxId: "TAX-2",
        phoneNo: "+1 222 222 2222",
        website: "https://new.example",
      },
      {
        id: "org-old",
        name: "Old Clinic",
        type: "GROOMER",
        isVerified: false,
        isActive: true,
        memberCount: 0,
        createdAt: "2026-07-21T12:00:00.000Z",
        taxId: "TAX-1",
        phoneNo: "+1 111 111 1111",
      },
    ]);

    expect(mockOrganizationFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });
    expect(mockUserOrganizationCount).toHaveBeenNthCalledWith(1, {
      where: { active: true, organizationReference: "org-new" },
    });
    expect(mockUserOrganizationCount).toHaveBeenNthCalledWith(2, {
      where: { active: true, organizationReference: "org-old" },
    });
  });

  it("returns a business detail by id or fhirId", async () => {
    mockOrganizationFindFirst.mockResolvedValue({
      id: "org-123",
      name: "Acme Vet",
      type: "HOSPITAL",
      isVerified: true,
      isActive: false,
      taxId: "ABC123",
      phoneNo: "+1 555 123 4567",
      website: "https://example.com",
      dunsNumber: "123456789",
      imageUrl: "https://cdn.example.com/org.png",
      healthAndSafetyCertNo: "HS-100",
      animalWelfareComplianceCertNo: "AW-200",
      fireAndEmergencyCertNo: "FE-300",
      googlePlacesId: "ChIJ....",
      averageRating: 4.7,
      ratingCount: 108,
      createdAt: new Date("2026-07-22T10:20:30.000Z"),
      updatedAt: new Date("2026-07-22T11:15:00.000Z"),
      address: {
        addressLine: "12 Main St",
        city: "Austin",
        state: "TX",
        country: "US",
        postalCode: "78701",
      },
    });
    mockUserOrganizationCount.mockResolvedValue(12);

    await expect(
      SuperAdminBusinessService.getBusiness("org_123"),
    ).resolves.toEqual({
      id: "org-123",
      name: "Acme Vet",
      type: "HOSPITAL",
      isVerified: true,
      isActive: false,
      memberCount: 12,
      createdAt: "2026-07-22T10:20:30.000Z",
      taxId: "ABC123",
      phoneNo: "+1 555 123 4567",
      website: "https://example.com",
      updatedAt: "2026-07-22T11:15:00.000Z",
      DUNSNumber: "123456789",
      imageURL: "https://cdn.example.com/org.png",
      address: {
        addressLine: "12 Main St",
        city: "Austin",
        state: "TX",
        country: "US",
        postalCode: "78701",
      },
      healthAndSafetyCertNo: "HS-100",
      animalWelfareComplianceCertNo: "AW-200",
      fireAndEmergencyCertNo: "FE-300",
      googlePlacesId: "ChIJ....",
      averageRating: 4.7,
      ratingCount: 108,
    });

    expect(mockOrganizationFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: "org_123" }, { fhirId: "org_123" }] },
      include: { address: true },
    });
    expect(mockUserOrganizationCount).toHaveBeenCalledWith({
      where: { organizationReference: "org-123", active: true },
    });
  });

  it("throws on invalid business ids and empty updates", async () => {
    await expect(
      SuperAdminBusinessService.getBusiness("bad id"),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_BUSINESS_ID",
    });

    mockOrganizationFindFirst.mockResolvedValue({
      id: "org-123",
    });

    await expect(
      SuperAdminBusinessService.updateBusiness("org-123", {}),
    ).rejects.toBeInstanceOf(SuperAdminBusinessServiceError);

    await expect(
      SuperAdminBusinessService.updateBusiness("bad id", { isActive: true }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_BUSINESS_ID",
    });
  });

  it("updates a single business status field", async () => {
    mockOrganizationFindFirst.mockResolvedValue({
      id: "org-123",
    });
    mockOrganizationUpdate.mockResolvedValue({
      id: "org-123",
      name: "Acme Vet",
      type: "HOSPITAL",
      isVerified: true,
      isActive: false,
      taxId: "ABC123",
      phoneNo: "+1 555 123 4567",
      website: "https://example.com",
      dunsNumber: null,
      imageUrl: null,
      healthAndSafetyCertNo: null,
      animalWelfareComplianceCertNo: null,
      fireAndEmergencyCertNo: null,
      googlePlacesId: null,
      averageRating: 0,
      ratingCount: 0,
      createdAt: new Date("2026-07-22T10:20:30.000Z"),
      updatedAt: new Date("2026-07-22T11:15:00.000Z"),
      address: null,
    });
    mockUserOrganizationCount.mockResolvedValue(12);

    await expect(
      SuperAdminBusinessService.updateBusiness("org-123", { isActive: false }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "org-123",
        isActive: false,
        memberCount: 12,
      }),
    );

    expect(mockOrganizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-123" },
      data: { isActive: false },
      include: { address: true },
    });
  });
});
