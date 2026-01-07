import {
  CompanionProps,
  StoredParent,
  StoredCompanion,
  CompanionParent,
  RequestCompanion,
  GetCompanionResponse,
} from "../../../pages/Companions/types";

describe("Companions Types", () => {
  it("verifies CompanionProps structure", () => {
    const companionProps: CompanionProps = {
      image: "http://example.com/img.png",
      name: "Buddy",
      breed: "Golden Retriever",
      species: "Dog",
      parent: "John Doe",
      gender: "Male",
      age: "2 years",
      lastMedication: "None",
      vaccineDue: "2025-01-01",
      upcomingAppointent: "2025-02-01",
      upcomingAppointentTime: "10:00 AM",
      status: "active",
      // Optional props
      weight: "20kg",
      color: "Golden",
    };

    // Assert existence to ensure unused variable doesn't trigger linter warnings
    expect(companionProps).toBeDefined();
    expect(companionProps.name).toBe("Buddy");
  });

  it("verifies StoredParent type structure", () => {
    // We cast the base Parent type to 'any' to avoid mocking external library internals (@yosemite-crew/types)
    // We explicitly test the 'id' property which is added by types.ts
    const parent: StoredParent = {
      ...({} as any),
      id: "parent-123",
    };

    expect(parent.id).toBe("parent-123");
  });

  it("verifies StoredCompanion type structure", () => {
    // We explicitely test id, organisationId, and parentId added by types.ts
    const companion: StoredCompanion = {
      ...({} as any),
      id: "comp-123",
      organisationId: "org-1",
      parentId: "parent-123",
    };

    expect(companion.id).toBe("comp-123");
    expect(companion.organisationId).toBe("org-1");
    expect(companion.parentId).toBe("parent-123");
  });

  it("verifies CompanionParent aggregation type", () => {
    const cp: CompanionParent = {
      companion: { id: "c1", organisationId: "o1", parentId: "p1" } as StoredCompanion,
      parent: { id: "p1" } as StoredParent,
    };

    expect(cp.companion.id).toBe("c1");
    expect(cp.parent.id).toBe("p1");
  });

  it("verifies RequestCompanion and Response types", () => {
    const request: RequestCompanion = {
      companion: {} as any, // Mocking CompanionRequestDTO
      parent: {} as any,    // Mocking ParentRequestDTO
    };

    const response: GetCompanionResponse = [request];

    expect(request).toBeDefined();
    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(1);
  });
});