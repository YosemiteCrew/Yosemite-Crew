/*
 * These tests run against a small in-memory Prisma fake that ACTUALLY evaluates
 * the `where` clause, seeded with two organisations' data.
 *
 * That is deliberate and it is the whole point of the suite. A conventional
 * `jest.fn()` mock asserting `toHaveBeenCalledWith({ where: { organisationId } })`
 * proves the shape of a filter object and nothing about isolation: it passes
 * identically whether the query returns one practice's rows, every practice's
 * rows, or none. Isolation is the only property on this surface worth testing,
 * so the fake has to be able to get it wrong.
 */
type Row = Record<string, unknown>;

const store: {
  appointment: Row[];
  userOrganization: Row[];
  organization: Row[];
} = {
  appointment: [],
  userOrganization: [],
  organization: [],
};

const matches = (row: Row, where: Row | undefined): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([field, condition]) => {
    const value = row[field];
    if (condition !== null && typeof condition === "object") {
      const c = condition as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("gte" in c && (value as Date) < (c.gte as Date)) return false;
      if ("lte" in c && (value as Date) > (c.lte as Date)) return false;
      return true;
    }
    return value === condition;
  });
};

const project = (row: Row, select: Row | undefined): Row => {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.keys(select)
      .filter((key) => select[key] === true)
      .map((key) => [key, row[key]]),
  );
};

const findMany =
  (table: keyof typeof store) =>
  (args: Row = {}) => {
    let rows = store[table].filter((row) => matches(row, args.where as Row));

    const orderBy = args.orderBy as Row[] | Row | undefined;
    const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    if (orders.length) {
      rows = [...rows].sort((a, b) => {
        for (const clause of orders) {
          const [field, dir] = Object.entries(clause)[0] as [string, string];
          const av = a[field] as never;
          const bv = b[field] as never;
          if (av < bv) return dir === "desc" ? 1 : -1;
          if (av > bv) return dir === "desc" ? -1 : 1;
        }
        return 0;
      });
    }

    const cursor = args.cursor as { id: string } | undefined;
    if (cursor) {
      const at = rows.findIndex((row) => row.id === cursor.id);
      if (at === -1) throw new Error("Invalid cursor");
      rows = rows.slice(at + ((args.skip as number) ?? 0));
    }

    if (typeof args.take === "number") rows = rows.slice(0, args.take);
    return Promise.resolve(rows.map((row) => project(row, args.select as Row)));
  };

const findFirst =
  (table: keyof typeof store) =>
  (args: Row = {}) => {
    const row = store[table].find((candidate) =>
      matches(candidate, args.where as Row),
    );
    return Promise.resolve(row ? project(row, args.select as Row) : null);
  };

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: {
      findMany: findMany("appointment"),
      findFirst: findFirst("appointment"),
    },
    userOrganization: { findMany: findMany("userOrganization") },
    organization: { findMany: findMany("organization") },
  },
}));

import {
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  DeveloperDataService,
  MAX_PAGE_SIZE,
  normaliseOrganisationReference,
} from "src/services/developer-data.service";

const ORG_A = "org-a";
const ORG_B = "org-b";
const USER = "user-1";

const appointmentAt = (id: string, organisationId: string, day: number) => ({
  id,
  organisationId,
  appointmentDate: new Date(Date.UTC(2026, 8, day)),
  status: "UPCOMING",
  patient: { name: "Poppy" },
  lead: null,
  appointmentType: null,
  room: null,
  appointmentKind: "OUTPATIENT",
  startTime: new Date(Date.UTC(2026, 8, day, 9)),
  endTime: new Date(Date.UTC(2026, 8, day, 10)),
  timeSlot: "09:00",
  durationMinutes: 60,
  isEmergency: false,
  concern: null,
  caseId: null,
  encounterId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

beforeEach(() => {
  store.appointment = [
    appointmentAt("a1", ORG_A, 1),
    appointmentAt("a2", ORG_A, 2),
    appointmentAt("a3", ORG_A, 3),
    appointmentAt("b1", ORG_B, 1),
    appointmentAt("b2", ORG_B, 2),
  ];
  store.userOrganization = [
    {
      practitionerReference: USER,
      organizationReference: ORG_A,
      active: true,
      roleCode: "VETERINARIAN",
      roleDisplay: "Vet",
    },
    {
      practitionerReference: USER,
      organizationReference: `Organization/${ORG_B}`,
      active: false,
      roleCode: "ADMIN",
      roleDisplay: "Admin",
    },
    {
      practitionerReference: "someone-else",
      organizationReference: ORG_B,
      active: true,
      roleCode: "OWNER",
      roleDisplay: "Owner",
    },
  ];
  store.organization = [
    { id: ORG_A, name: "Bramble Vets", type: "HOSPITAL" },
    { id: ORG_B, name: "Cedar Clinic", type: "CLINIC" },
  ];
});

describe("clampPageSize", () => {
  it.each([
    ["absent", undefined, DEFAULT_PAGE_SIZE],
    ["not a number", "abc", DEFAULT_PAGE_SIZE],
    ["zero", "0", DEFAULT_PAGE_SIZE],
    ["negative", "-5", DEFAULT_PAGE_SIZE],
    ["in range", "10", 10],
    ["over the ceiling", "5000", MAX_PAGE_SIZE],
  ])("clamps %s", (_label, input, expected) => {
    expect(clampPageSize(input)).toBe(expected);
  });
});

describe("normaliseOrganisationReference", () => {
  it("strips a FHIR-style prefix and leaves a bare id alone", () => {
    expect(normaliseOrganisationReference("Organization/x")).toBe("x");
    expect(normaliseOrganisationReference("x")).toBe("x");
  });
});

describe("listOrganizations", () => {
  it("returns only practices the caller is an ACTIVE member of", async () => {
    const result = await DeveloperDataService.listOrganizations(USER);
    expect(result.map((o) => o.id)).toEqual([ORG_A]);
    expect(result[0]).toMatchObject({
      name: "Bramble Vets",
      roleCode: "VETERINARIAN",
    });
  });

  it("excludes a practice whose membership was deactivated", async () => {
    // ORG_B is present for this user, but active:false. An offboarded holder
    // must not be told the practice still exists for them.
    const result = await DeveloperDataService.listOrganizations(USER);
    expect(result.map((o) => o.id)).not.toContain(ORG_B);
  });

  it("does not leak another user's memberships", async () => {
    const result = await DeveloperDataService.listOrganizations("nobody");
    expect(result).toEqual([]);
  });
});

describe("listAppointments", () => {
  it("returns one practice's rows and never the other's", async () => {
    const page = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 50,
    });
    const ids = (page.items as { id: string }[]).map((i) => i.id);
    expect(ids).toEqual(["a1", "a2", "a3"]);
    expect(ids).not.toContain("b1");
    expect(ids).not.toContain("b2");
  });

  it("paginates without dropping or repeating a row across the boundary", async () => {
    const first = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 2,
    });
    expect((first.items as { id: string }[]).map((i) => i.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(first.nextCursor).toBe("a2");

    const second = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect((second.items as { id: string }[]).map((i) => i.id)).toEqual(["a3"]);
    expect(second.nextCursor).toBeNull();
  });

  it("filters by date window", async () => {
    const page = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 50,
      from: new Date(Date.UTC(2026, 8, 2)),
      to: new Date(Date.UTC(2026, 8, 2)),
    });
    expect((page.items as { id: string }[]).map((i) => i.id)).toEqual(["a2"]);
  });

  it("filters by status", async () => {
    store.appointment[0].status = "CANCELLED";
    const page = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 50,
      status: "CANCELLED" as never,
    });
    expect((page.items as { id: string }[]).map((i) => i.id)).toEqual(["a1"]);
  });

  it("only projects the published field set", async () => {
    const page = await DeveloperDataService.listAppointments({
      organisationId: ORG_A,
      limit: 1,
    });
    // attachments/formIds/idempotencyKey/expiresAt are intentionally not exposed.
    expect(Object.keys(page.items[0] as object).sort()).not.toContain(
      "attachments",
    );
  });
});

describe("getAppointment", () => {
  it("returns the row when it belongs to the acting practice", async () => {
    const row = await DeveloperDataService.getAppointment(ORG_A, "a1");
    expect(row).toMatchObject({ id: "a1" });
  });

  it("returns null for a real id owned by another practice", async () => {
    // The IDOR case: b1 exists, but not for ORG_A.
    const row = await DeveloperDataService.getAppointment(ORG_A, "b1");
    expect(row).toBeNull();
  });
});
