const mockUserOrganizationFindMany = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    userOrganization: { findMany: mockUserOrganizationFindMany },
  },
}));

import {
  filterUserIdsInOrganisation,
  organisationReferenceMatches,
} from "src/services/shared/organisation-membership";

const references = (matches: Array<{ organizationReference: string }>) =>
  matches.map((match) => match.organizationReference).sort();

describe("organisationReferenceMatches", () => {
  it("matches the bare id and the conformant FHIR reference", () => {
    // The create path stores dto.organization.reference verbatim, so a
    // membership for org-1 is on disk as either spelling depending only on
    // what the client sent.
    expect(references(organisationReferenceMatches("org-1"))).toEqual([
      "Organization/org-1",
      "org-1",
    ]);
  });

  it("covers the fhirId as well, because an organisation is addressable by both", () => {
    // findOrganizationById resolves { OR: [{ id }, { fhirId }] }, so a caller
    // holding one id may be looking at an organisation whose memberships were
    // written against the other.
    expect(references(organisationReferenceMatches("org-1", "fhir-1"))).toEqual(
      ["Organization/fhir-1", "Organization/org-1", "fhir-1", "org-1"],
    );
  });

  it("does not double-prefix a reference that already carries one", () => {
    expect(
      references(organisationReferenceMatches("Organization/org-1")),
    ).toEqual(["Organization/org-1", "org-1"]);
  });

  it("strips the prefix only at the start", () => {
    // A mid-string replace would silently rewrite this id into something that
    // matches nothing, which is indistinguishable from an organisation with no
    // members.
    expect(
      references(organisationReferenceMatches("a/Organization/b")),
    ).toEqual(["Organization/a/Organization/b", "a/Organization/b"]);
  });

  it("drops blank and missing ids instead of matching everything prefixed", () => {
    expect(organisationReferenceMatches(undefined, null, "   ")).toEqual([]);
  });

  it("de-duplicates when the same id arrives twice", () => {
    expect(organisationReferenceMatches("org-1", "org-1")).toHaveLength(2);
  });
});

describe("filterUserIdsInOrganisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserOrganizationFindMany.mockResolvedValue([]);
  });

  it("asks for both spellings, so an offboarding check cannot pass by missing the rows", async () => {
    await filterUserIdsInOrganisation(["user-1"], "org-1");

    const where = mockUserOrganizationFindMany.mock.calls[0][0].where;
    expect(references(where.OR)).toEqual(["Organization/org-1", "org-1"]);
    expect(where.active).toBe(true);
  });

  it("returns only the ids with an active membership", async () => {
    mockUserOrganizationFindMany.mockResolvedValue([
      { practitionerReference: "user-1" },
    ]);

    const inOrg = await filterUserIdsInOrganisation(
      ["user-1", "user-2"],
      "org-1",
    );

    expect([...inOrg]).toEqual(["user-1"]);
  });

  it("does not query at all without an organisation", async () => {
    expect([...(await filterUserIdsInOrganisation(["user-1"], ""))]).toEqual(
      [],
    );
    expect(mockUserOrganizationFindMany).not.toHaveBeenCalled();
  });
});
