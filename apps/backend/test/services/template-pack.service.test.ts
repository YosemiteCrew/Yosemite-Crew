import {
  TemplatePackService,
  TemplatePackServiceError,
} from "../../src/services/template-pack.service";
import { prisma } from "../../src/config/prisma";
import { emitDeveloperEvent } from "../../src/utils/developer-events";

jest.mock("../../src/config/prisma", () => {
  const tx = {
    template: { create: jest.fn() },
    templateVersion: { create: jest.fn() },
    templatePackInstall: { create: jest.fn() },
  };
  return {
    prisma: {
      template: { findMany: jest.fn() },
      templateVersion: { findMany: jest.fn() },
      templatePack: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      templatePackInstall: {
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      __tx: tx,
    },
  };
});

jest.mock("src/utils/developer-events", () => ({
  emitDeveloperEvent: jest.fn(),
}));

type DelegateMocks = Record<string, jest.Mock>;
const mockPrisma = prisma as unknown as {
  template: DelegateMocks;
  templateVersion: DelegateMocks;
  templatePack: DelegateMocks;
  templatePackInstall: DelegateMocks;
  $transaction: jest.Mock;
  __tx: Record<string, DelegateMocks>;
};
const tx = mockPrisma.__tx;
const mockEmit = emitDeveloperEvent as jest.Mock;

const publishedTemplate = {
  id: "tpl-1",
  organisationId: "publisher-org",
  ownership: "ORG_TEMPLATE",
  status: "PUBLISHED",
  publishedVersion: 3,
};

describe("TemplatePackService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a DRAFT pack pinning each template's publishedVersion", async () => {
    mockPrisma.template.findMany.mockResolvedValue([publishedTemplate]);
    mockPrisma.templatePack.create.mockResolvedValue({ id: "pack-1" });

    await TemplatePackService.create({
      publisherOrganisationId: "publisher-org",
      name: "Dental Pack",
      slug: "dental-pack",
      description: "Dental templates",
      templateIds: ["tpl-1"],
    });

    expect(mockPrisma.templatePack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherOrganisationId: "publisher-org",
          slug: "dental-pack",
          items: {
            create: [{ templateId: "tpl-1", snapshotVersion: 3 }],
          },
        }),
      }),
    );
  });

  it("404s templates that are missing or belong to another org (no existence leak)", async () => {
    mockPrisma.template.findMany.mockResolvedValue([
      { ...publishedTemplate, organisationId: "other-org" },
    ]);
    await expect(
      TemplatePackService.create({
        publisherOrganisationId: "publisher-org",
        name: "Pack",
        slug: "pack",
        templateIds: ["tpl-1"],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "not_found" });
  });

  it("rejects YC_LIBRARY templates like foreign ones", async () => {
    mockPrisma.template.findMany.mockResolvedValue([
      {
        ...publishedTemplate,
        organisationId: null,
        ownership: "YC_LIBRARY",
      },
    ]);
    await expect(
      TemplatePackService.create({
        publisherOrganisationId: "publisher-org",
        name: "Pack",
        slug: "pack",
        templateIds: ["tpl-1"],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s templates that are not PUBLISHED", async () => {
    mockPrisma.template.findMany.mockResolvedValue([
      { ...publishedTemplate, status: "DRAFT", publishedVersion: null },
    ]);
    await expect(
      TemplatePackService.create({
        publisherOrganisationId: "publisher-org",
        name: "Pack",
        slug: "pack",
        templateIds: ["tpl-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "template_not_published",
    });
  });

  it("maps the unique slug violation to 409 slug_taken", async () => {
    mockPrisma.template.findMany.mockResolvedValue([publishedTemplate]);
    mockPrisma.templatePack.create.mockRejectedValue({ code: "P2002" });
    await expect(
      TemplatePackService.create({
        publisherOrganisationId: "publisher-org",
        name: "Pack",
        slug: "taken",
        templateIds: ["tpl-1"],
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "slug_taken" });
  });
});

describe("TemplatePackService.publish", () => {
  beforeEach(() => jest.clearAllMocks());

  it("publishes a DRAFT pack owned by the caller", async () => {
    mockPrisma.templatePack.findFirst.mockResolvedValue({
      id: "pack-1",
      status: "DRAFT",
    });
    mockPrisma.templatePack.update.mockResolvedValue({
      id: "pack-1",
      status: "PUBLISHED",
    });
    await TemplatePackService.publish("publisher-org", "pack-1");
    expect(mockPrisma.templatePack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pack-1", publisherOrganisationId: "publisher-org" },
      }),
    );
    expect(mockPrisma.templatePack.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } }),
    );
  });

  it("404s packs owned by another org", async () => {
    mockPrisma.templatePack.findFirst.mockResolvedValue(null);
    await expect(
      TemplatePackService.publish("publisher-org", "pack-x"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s non-DRAFT packs (suspension is admin-lifted, not republished)", async () => {
    mockPrisma.templatePack.findFirst.mockResolvedValue({
      id: "pack-1",
      status: "SUSPENDED",
    });
    await expect(
      TemplatePackService.publish("publisher-org", "pack-1"),
    ).rejects.toMatchObject({ statusCode: 409, code: "invalid_status" });
  });
});

describe("TemplatePackService.catalog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists PUBLISHED packs with keyset pagination", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `pack-${index}`,
      createdAt: new Date(`2026-07-0${index + 1}T00:00:00.000Z`),
    }));
    mockPrisma.templatePack.findMany.mockResolvedValue(rows);
    const page = await TemplatePackService.catalog({ limit: 2 });
    expect(mockPrisma.templatePack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        take: 3,
      }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.pagination.hasMore).toBe(true);
    expect(page.pagination.nextCursor).toEqual(expect.any(String));
  });
});

describe("TemplatePackService.install", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.templatePack.findUnique.mockResolvedValue({
      id: "pack-1",
      slug: "dental-pack",
      status: "PUBLISHED",
      publisherOrganisationId: "publisher-org",
      items: [{ templateId: "tpl-1", snapshotVersion: 3 }],
    });
    mockPrisma.templatePackInstall.findUnique.mockResolvedValue(null);
    mockPrisma.templateVersion.findMany.mockResolvedValue([
      {
        templateId: "tpl-1",
        version: 3,
        schemaSnapshot: { sections: [] },
        renderConfigSnapshot: { layout: "a4" },
        validationSnapshot: null,
        template: {
          kind: "SOAP_NOTE",
          name: "Dental Chart",
          description: "Charting",
          scope: "ORGANISATION",
          rules: null,
        },
      },
    ]);
    tx.template.create.mockResolvedValue({ id: "new-tpl-1" });
    tx.templateVersion.create.mockResolvedValue({ id: "new-ver-1" });
    tx.templatePackInstall.create.mockResolvedValue({
      id: "install-1",
      packId: "pack-1",
      organisationId: "clinic-org",
      materializedTemplateIds: ["new-tpl-1"],
    });
  });

  it("materializes every item as a NEW DRAFT template and records the install", async () => {
    const install = await TemplatePackService.install({
      packId: "pack-1",
      organisationId: "clinic-org",
      installedBy: "user-1",
    });

    expect(tx.template.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "clinic-org",
        ownership: "ORG_TEMPLATE",
        status: "DRAFT",
        publishedVersion: null,
        kind: "SOAP_NOTE",
        name: "Dental Chart",
        createdBy: "user-1",
      }),
    });
    // Never auto-published (ADR 0005 gate).
    expect(tx.template.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(tx.templateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "new-tpl-1",
        version: 1,
        schemaSnapshot: { sections: [] },
        renderConfigSnapshot: { layout: "a4" },
        createdBy: "user-1",
      }),
    });
    expect(tx.templatePackInstall.create).toHaveBeenCalledWith({
      data: {
        packId: "pack-1",
        organisationId: "clinic-org",
        materializedTemplateIds: ["new-tpl-1"],
      },
    });
    expect(install).toMatchObject({ id: "install-1" });
  });

  it("emits template_pack.installed to the publisher org without the installer's identity", async () => {
    await TemplatePackService.install({
      packId: "pack-1",
      organisationId: "clinic-org",
      installedBy: "user-1",
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "template_pack.installed",
      "publisher-org",
      { packId: "pack-1", slug: "dental-pack" },
    );
    const payload = mockEmit.mock.calls[0][2] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain("clinic-org");
  });

  it("404s DRAFT packs exactly like missing ones", async () => {
    mockPrisma.templatePack.findUnique.mockResolvedValue({
      id: "pack-1",
      slug: "s",
      status: "DRAFT",
      publisherOrganisationId: "publisher-org",
      items: [],
    });
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("blocks new installs of SUSPENDED packs with 409 pack_suspended", async () => {
    mockPrisma.templatePack.findUnique.mockResolvedValue({
      id: "pack-1",
      slug: "s",
      status: "SUSPENDED",
      publisherOrganisationId: "publisher-org",
      items: [],
    });
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "pack_suspended" });
    expect(tx.template.create).not.toHaveBeenCalled();
  });

  it("409s a second install by the same org", async () => {
    mockPrisma.templatePackInstall.findUnique.mockResolvedValue({
      id: "install-1",
    });
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "already_installed" });
  });

  it("maps a racing install's unique violation to the same 409 already_installed", async () => {
    // Both installs pass the findUnique pre-check; the loser's install row
    // insert hits the unique (packId, organisationId) constraint.
    tx.templatePackInstall.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "already_installed" });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("rethrows non-unique transaction failures from install", async () => {
    tx.templatePackInstall.create.mockRejectedValue(new Error("db down"));
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toThrow("db down");
  });

  it("409s when a pinned snapshot version is missing", async () => {
    mockPrisma.templateVersion.findMany.mockResolvedValue([]);
    await expect(
      TemplatePackService.install({
        packId: "pack-1",
        organisationId: "clinic-org",
        installedBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "snapshot_missing" });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("TemplatePackService.uninstall", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes ONLY the install record - materialized drafts stay with the org", async () => {
    mockPrisma.templatePackInstall.deleteMany.mockResolvedValue({ count: 1 });
    await TemplatePackService.uninstall({
      packId: "pack-1",
      organisationId: "clinic-org",
    });
    expect(mockPrisma.templatePackInstall.deleteMany).toHaveBeenCalledWith({
      where: { packId: "pack-1", organisationId: "clinic-org" },
    });
    // No template deletion of any kind.
    expect(tx.template.create).not.toHaveBeenCalled();
  });

  it("404s when there is no install", async () => {
    mockPrisma.templatePackInstall.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      TemplatePackService.uninstall({
        packId: "pack-1",
        organisationId: "clinic-org",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("TemplatePackService.list", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the caller org's own packs", async () => {
    mockPrisma.templatePack.findMany.mockResolvedValue([]);
    await TemplatePackService.list("publisher-org");
    expect(mockPrisma.templatePack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publisherOrganisationId: "publisher-org" },
      }),
    );
  });
});

describe("TemplatePackServiceError", () => {
  it("carries status and code", () => {
    const error = new TemplatePackServiceError("nope", 409, "slug_taken");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("slug_taken");
    expect(error.name).toBe("TemplatePackServiceError");
  });
});
