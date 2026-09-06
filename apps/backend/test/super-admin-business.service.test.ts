const mockOrganizationFindMany = jest.fn();
const mockOrganizationFindFirst = jest.fn();
const mockOrganizationUpdate = jest.fn();
const mockUserOrganizationCount = jest.fn();
const mockUserOrganizationFindMany = jest.fn();

const mockPrisma = {
  organization: {
    findMany: mockOrganizationFindMany,
    findFirst: mockOrganizationFindFirst,
    update: mockOrganizationUpdate,
  },
  userOrganization: {
    count: mockUserOrganizationCount,
    findMany: mockUserOrganizationFindMany,
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
    // The count is now the length of the de-duplicated roster rather than a
    // separate query, so the fixture is rows.
    mockUserOrganizationFindMany.mockImplementation(
      async ({
        where,
      }: {
        where: { OR: Array<{ organizationReference: string }> };
      }) =>
        where.OR.some((match) => match.organizationReference === "org-new")
          ? [
              {
                practitionerReference: "user-1",
                roleCode: "doctor",
                roleDisplay: null,
                createdAt: new Date("2026-07-01T09:00:00.000Z"),
              },
              {
                practitionerReference: "Practitioner/user-1",
                roleCode: "doctor",
                roleDisplay: null,
                createdAt: new Date("2026-07-01T09:00:00.000Z"),
              },
              {
                practitionerReference: "user-2",
                roleCode: "doctor",
                roleDisplay: null,
                createdAt: new Date("2026-07-01T09:00:00.000Z"),
              },
            ]
          : [],
    );

    await expect(SuperAdminBusinessService.listBusinesses()).resolves.toEqual([
      {
        id: "org-new",
        name: "New Clinic",
        type: "HOSPITAL",
        isVerified: true,
        isActive: true,
        memberCount: 2,
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
    // Every spelling, for every organisation in the list: the count is what an
    // operator reads as "who is in this clinic", and a list view that matched
    // narrowly than the detail view would disagree with itself.
    expect(mockUserOrganizationFindMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        active: true,
        OR: [
          { organizationReference: "org-new" },
          { organizationReference: "Organization/org-new" },
        ],
      }),
    );
    expect(mockUserOrganizationFindMany.mock.calls[1][0].where).toEqual(
      expect.objectContaining({
        active: true,
        OR: [
          { organizationReference: "org-old" },
          { organizationReference: "Organization/org-old" },
        ],
      }),
    );
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
    mockUserOrganizationFindMany.mockResolvedValue(
      Array.from({ length: 12 }, (_unused, index) => ({
        practitionerReference: `user-${index}`,
        roleCode: "doctor",
        roleDisplay: null,
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
      })),
    );

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
    expect(mockUserOrganizationFindMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        active: true,
        OR: [
          { organizationReference: "org-123" },
          { organizationReference: "Organization/org-123" },
        ],
      }),
    );
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
    mockUserOrganizationFindMany.mockResolvedValue(
      Array.from({ length: 12 }, (_unused, index) => ({
        practitionerReference: `user-${index}`,
        roleCode: "doctor",
        roleDisplay: null,
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
      })),
    );

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
  describe("member resolution", () => {
    const organization = {
      id: "org-123",
      fhirId: "fhir-123",
      name: "Clinic",
      type: "HOSPITAL",
      isVerified: true,
      isActive: true,
      taxId: "TAX-1",
      phoneNo: "+1 111 111 1111",
      website: null,
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
    };

    const referencesOf = (where: {
      OR: Array<{ organizationReference: string }>;
    }) => where.OR.map((match) => match.organizationReference).sort();

    it("counts members by every spelling the reference column can hold", async () => {
      // organizationReference is persisted verbatim from the inbound FHIR
      // resource, so an exact match on organization.id renders Members 0 for a
      // clinic whose memberships were created with a conformant reference.
      mockOrganizationFindFirst.mockResolvedValue(organization);
      mockUserOrganizationFindMany.mockResolvedValue([
        {
          practitionerReference: "user-1",
          roleCode: "doctor",
          roleDisplay: null,
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
        },
      ]);

      await SuperAdminBusinessService.getBusiness("org-123");

      expect(
        referencesOf(mockUserOrganizationFindMany.mock.calls[0][0].where),
      ).toEqual([
        "Organization/fhir-123",
        "Organization/org-123",
        "fhir-123",
        "org-123",
      ]);
    });

    it("lists members with the same predicate as the count, so the two cannot disagree", async () => {
      mockOrganizationFindFirst.mockResolvedValue(organization);
      mockUserOrganizationFindMany.mockResolvedValue([
        {
          practitionerReference: "Practitioner/user-1",
          roleCode: "doctor",
          roleDisplay: "Veterinarian",
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
        },
        {
          practitionerReference: "user-2",
          roleCode: "nurse",
          roleDisplay: null,
          createdAt: new Date("2026-07-02T09:00:00.000Z"),
        },
      ]);

      const members =
        await SuperAdminBusinessService.listBusinessMembers("org-123");

      expect(members).toEqual([
        {
          userId: "user-1",
          roleCode: "doctor",
          roleDisplay: "Veterinarian",
          since: "2026-07-01T09:00:00.000Z",
        },
        {
          userId: "user-2",
          roleCode: "nurse",
          since: "2026-07-02T09:00:00.000Z",
        },
      ]);

      const where = mockUserOrganizationFindMany.mock.calls[0][0].where;
      expect(referencesOf(where)).toEqual([
        "Organization/fhir-123",
        "Organization/org-123",
        "fhir-123",
        "org-123",
      ]);
      expect(where.active).toBe(true);
    });

    it("strips a FHIR practitioner reference so the id is the one user pages are keyed on", async () => {
      // practitionerReference is stored verbatim, exactly like the organisation
      // column. Handing "Practitioner/<id>" out unchanged sends a caller to
      // /users/Practitioner%2F<id>, so the journey would break at the last step
      // for the same reason it broke at the first.
      mockOrganizationFindFirst.mockResolvedValue(organization);
      mockUserOrganizationFindMany.mockResolvedValue([
        {
          practitionerReference: "Practitioner/user-9",
          roleCode: "doctor",
          roleDisplay: null,
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
        },
        {
          practitionerReference: "user-8",
          roleCode: "nurse",
          roleDisplay: null,
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
        },
      ]);

      const members =
        await SuperAdminBusinessService.listBusinessMembers("org-123");

      expect(members?.map((member) => member.userId)).toEqual([
        "user-9",
        "user-8",
      ]);
    });

    it("keeps both rows when one person holds two roles, since the count counts both", async () => {
      // Uniqueness is (practitioner, organisation, role), so this is two rows
      // in the table and two in memberCount. Collapsing them here would make
      // the list disagree with the number beside it.
      mockOrganizationFindFirst.mockResolvedValue(organization);
      mockUserOrganizationFindMany.mockResolvedValue([
        {
          practitionerReference: "user-1",
          roleCode: "doctor",
          roleDisplay: "Veterinarian",
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
        },
        {
          practitionerReference: "user-1",
          roleCode: "admin",
          roleDisplay: "Practice admin",
          createdAt: new Date("2026-07-03T09:00:00.000Z"),
        },
      ]);

      const members =
        await SuperAdminBusinessService.listBusinessMembers("org-123");

      expect(members).toHaveLength(2);
      expect(members?.map((member) => member.roleCode)).toEqual([
        "doctor",
        "admin",
      ]);
    });

    it("counts one person once when the same membership exists under four spellings", async () => {
      // @@unique is over the strings as written, so the same practitioner,
      // organisation and role can be four rows - 2 practitioner spellings x 2
      // organisation spellings - and every one satisfies the constraint.
      // Matching one spelling saw one and under-counted; matching all four
      // sees all four, and Members 4 for one person is the mirror of Members 0
      // for forty-seven.
      mockOrganizationFindFirst.mockResolvedValue(organization);
      mockUserOrganizationFindMany.mockResolvedValue(
        ["user-1", "Practitioner/user-1", "user-1", "Practitioner/user-1"].map(
          (practitionerReference) => ({
            practitionerReference,
            roleCode: "doctor",
            roleDisplay: null,
            createdAt: new Date("2026-07-01T09:00:00.000Z"),
          }),
        ),
      );

      const members =
        await SuperAdminBusinessService.listBusinessMembers("org-123");
      expect(members).toEqual([
        {
          userId: "user-1",
          roleCode: "doctor",
          since: "2026-07-01T09:00:00.000Z",
        },
      ]);

      const business = await SuperAdminBusinessService.getBusiness("org-123");
      expect(business?.memberCount).toBe(1);
    });

    it("returns null for an unknown business rather than an empty roster", async () => {
      // An empty array would render as a clinic with no staff, which is the
      // same screen an operator would read as the cause of the outage.
      mockOrganizationFindFirst.mockResolvedValue(null);

      await expect(
        SuperAdminBusinessService.listBusinessMembers("missing"),
      ).resolves.toBeNull();
      expect(mockUserOrganizationFindMany).not.toHaveBeenCalled();
    });
  });
});
