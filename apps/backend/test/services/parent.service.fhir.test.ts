import { toFHIR, toFHIRFromPrisma } from "../../src/services/parent.service";

// These two exports are pure mappers, so the real @yosemite-crew/types DTO layer is
// used here (unlike parent.service.test.ts, which stubs it) to assert the actual
// FHIR RelatedPerson that leaves the API.
jest.mock("src/config/prisma", () => ({
  prisma: {
    parent: {},
    parentAddress: {},
    parentPatient: {},
    authUserMobile: {},
  },
}));

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getAuthUserMobileIdByProviderId: jest.fn(),
    linkParent: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordAlertMutation: jest.fn() },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "parent/image-key"),
  moveFile: jest.fn(),
}));

const PROFILE_COMPLETION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/parent-profile-completed";
const TIMEZONE_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/parent-timezone";
const ALERTS_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/parent-alerts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extensionByUrl = (resource: any, url: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource.extension?.find((ext: any) => ext.url === url);

describe("ParentService.toFHIR", () => {
  it("maps a mongoose-style document through toObject()", () => {
    const source = {
      toObject: () => ({
        _id: { toString: () => "mongo-parent-1" },
        firstName: "Jane",
        lastName: "Doe",
        birthDate: new Date("1990-05-04T00:00:00.000Z"),
        email: "jane@example.com",
        phoneNumber: "+15550100",
        currency: "USD",
        timezone: "Asia/Kolkata",
        profileImageUrl: "https://cdn.example.com/jane.png",
        isProfileComplete: true,
        linkedUserId: { toString: () => "auth-1" },
        createdFrom: "mobile",
        alerts: [{ title: "Aggressive", severity: "high" }],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        address: {
          addressLine: "1 Main St",
          country: "US",
          city: "Austin",
          state: "TX",
          postalCode: "73301",
          latitude: 30.2,
          longitude: -97.7,
        },
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIR(source) as any;

    expect(resource.resourceType).toBe("RelatedPerson");
    expect(resource.id).toBe("mongo-parent-1");
    expect(resource.name).toEqual([
      {
        use: "official",
        text: "Jane Doe",
        given: ["Jane"],
        family: "Doe",
      },
    ]);
    expect(resource.telecom).toEqual([
      { system: "phone", value: "+15550100" },
      { system: "email", value: "jane@example.com" },
    ]);
    expect(resource.birthDate).toBe("1990-05-04");
    expect(resource.photo).toEqual([
      { url: "https://cdn.example.com/jane.png" },
    ]);
    expect(resource.address).toHaveLength(1);
    expect(resource.address[0]).toMatchObject({
      city: "Austin",
      state: "TX",
      postalCode: "73301",
      country: "US",
    });
    expect(extensionByUrl(resource, PROFILE_COMPLETION_URL)).toEqual({
      url: PROFILE_COMPLETION_URL,
      valueBoolean: true,
    });
    expect(extensionByUrl(resource, TIMEZONE_URL)).toEqual({
      url: TIMEZONE_URL,
      valueString: "Asia/Kolkata",
    });
    expect(extensionByUrl(resource, ALERTS_URL)?.extension).toEqual([
      {
        url: "alert",
        extension: [
          { url: "title", valueString: "Aggressive" },
          { url: "severity", valueString: "high" },
        ],
      },
    ]);
  });

  it("maps a plain object with a string linkedUserId and no toObject()", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIR({
      id: "parent-1",
      firstName: "Alex",
      lastName: null,
      email: "alex@example.com",
      phoneNumber: null,
      linkedUserId: "auth-2",
      createdFrom: "pms",
      isProfileComplete: false,
      address: {
        city: "Austin",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as any;

    expect(resource.id).toBe("parent-1");
    expect(resource.name).toEqual([
      { use: "official", text: "Alex", given: ["Alex"], family: undefined },
    ]);
    // No phone number means the whole telecom block is dropped, email included.
    expect(resource.telecom).toBeUndefined();
    expect(resource.photo).toBeUndefined();
    expect(resource.birthDate).toBeUndefined();
    expect(resource.address).toHaveLength(1);
    expect(extensionByUrl(resource, PROFILE_COMPLETION_URL)).toEqual({
      url: PROFILE_COMPLETION_URL,
      valueBoolean: false,
    });
    expect(extensionByUrl(resource, TIMEZONE_URL)).toBeUndefined();
    expect(extensionByUrl(resource, ALERTS_URL)).toBeUndefined();
  });

  it("falls back to empty defaults for a document with no fields set", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIR({} as any) as any;

    // An empty id string is dropped rather than emitted as `id: ""`.
    expect(resource.id).toBeUndefined();
    expect(resource.name).toBeUndefined();
    expect(resource.telecom).toBeUndefined();
    expect(resource.address).toBeUndefined();
    expect(resource.photo).toBeUndefined();
    expect(extensionByUrl(resource, PROFILE_COMPLETION_URL)).toEqual({
      url: PROFILE_COMPLETION_URL,
      valueBoolean: false,
    });
  });

  it("nulls out address fields the document omits", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIR({
      id: "parent-1",
      firstName: "Alex",
      email: "alex@example.com",
      address: {
        addressLine: "1 Main St",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as any;

    expect(resource.address).toHaveLength(1);
    expect(resource.address[0].city).toBeUndefined();
    expect(resource.address[0].state).toBeUndefined();
    expect(resource.address[0].postalCode).toBeUndefined();
    expect(resource.address[0].country).toBeUndefined();
  });

  it("prefers an explicit id over a mongo _id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIR({
      id: "postgres-id",
      _id: { toString: () => "mongo-id" },
      firstName: "Jane",
      email: "jane@example.com",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as any;

    expect(resource.id).toBe("postgres-id");
  });
});

describe("ParentService.toFHIRFromPrisma", () => {
  const prismaRecord = {
    id: "parent-1",
    firstName: "Jane",
    lastName: "Doe",
    birthDate: new Date("1990-05-04T00:00:00.000Z"),
    email: "jane@example.com",
    phoneNumber: "+15550100",
    currency: "USD",
    timezone: "UTC",
    profileImageUrl: null,
    isProfileComplete: true,
    linkedUserId: null,
    createdFrom: "pms" as const,
    alerts: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    address: null,
  };

  it("maps a prisma record with no address and no alerts", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = toFHIRFromPrisma(prismaRecord) as any;

    expect(resource.resourceType).toBe("RelatedPerson");
    expect(resource.id).toBe("parent-1");
    expect(resource.name[0]).toMatchObject({
      text: "Jane Doe",
      given: ["Jane"],
      family: "Doe",
    });
    expect(resource.address).toBeUndefined();
    expect(resource.photo).toBeUndefined();
    expect(extensionByUrl(resource, TIMEZONE_URL)).toEqual({
      url: TIMEZONE_URL,
      valueString: "UTC",
    });
    expect(extensionByUrl(resource, ALERTS_URL)).toBeUndefined();
  });

  it("drops an alerts column that is not an array", () => {
    const resource = toFHIRFromPrisma({
      ...prismaRecord,
      // A malformed JSON column must not reach the FHIR extension builder.
      alerts: { corrupted: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    expect(extensionByUrl(resource, ALERTS_URL)).toBeUndefined();
  });

  it("emits the address and alert extensions when both are populated", () => {
    const resource = toFHIRFromPrisma({
      ...prismaRecord,
      profileImageUrl: "https://cdn.example.com/jane.png",
      alerts: [{ title: "Allergy", severity: "critical" }],
      address: {
        addressLine: "1 Main St",
        country: "US",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
        latitude: null,
        longitude: null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    expect(resource.address).toHaveLength(1);
    expect(resource.photo).toEqual([
      { url: "https://cdn.example.com/jane.png" },
    ]);
    expect(extensionByUrl(resource, ALERTS_URL)?.extension?.[0]).toEqual({
      url: "alert",
      extension: [
        { url: "title", valueString: "Allergy" },
        { url: "severity", valueString: "critical" },
      ],
    });
  });
});
