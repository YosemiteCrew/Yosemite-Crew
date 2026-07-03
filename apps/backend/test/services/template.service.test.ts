import { prisma } from "src/config/prisma";
import { TemplateService } from "src/services/template.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    template: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    templateVersion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    templateCatalogLink: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    productItem: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("src/services/clinical-template-blueprints", () => ({
  normalizeClinicalTemplateSchemaSnapshot: jest.fn(
    (_kind, snapshot) => snapshot,
  ),
  validateClinicalTemplateBlueprint: jest.fn(() => ({
    requiredSectionIds: [],
    missingSectionIds: [],
    missingFieldPaths: [],
    invalidFieldPaths: [],
  })),
}));

jest.mock("src/services/task-workflow-blueprints", () => ({
  validateTaskWorkflowTemplateBlueprint: jest.fn(() => ({
    requiredSectionIds: [],
    missingSectionIds: [],
    missingFieldPaths: [],
    invalidFieldPaths: [],
  })),
}));

jest.mock("src/services/rendered-document.service", () => ({
  createRenderedDocumentRecord: jest.fn(),
}));

jest.mock("src/services/task-workflow.service", () => ({
  TaskWorkflowService: {},
}));

describe("TemplateService ownership persistence", () => {
  const getByIdSpy = jest.spyOn(TemplateService, "getById");

  beforeEach(() => {
    jest.clearAllMocks();
    getByIdSpy.mockResolvedValue({ id: "tpl-1" } as never);
  });

  it("creates YC library templates without organisation or owner bindings", async () => {
    const txTemplateCreate = jest.fn().mockResolvedValue({ id: "tpl-1" });
    const txTemplateVersionCreate = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { create: txTemplateCreate },
          templateVersion: { create: txTemplateVersionCreate },
        }),
    );

    await TemplateService.create({
      ownership: "YC_LIBRARY",
      kind: "SOAP_NOTE",
      name: "SOAP",
      scope: "ORGANISATION",
      schemaSnapshot: {
        sections: [{ id: "subjective", title: "Subjective", fields: [] }],
      },
      createdBy: "user-1",
    });

    expect(txTemplateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownership: "YC_LIBRARY",
          organisationId: undefined,
          ownerUserId: undefined,
        }),
      }),
    );
  });

  it("updates templates to YC library ownership while clearing org and owner bindings", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-1",
      organisationId: "org-1",
      ownerUserId: "user-2",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      updatedBy: "user-1",
    });

    await TemplateService.update("tpl-1", { ownership: "YC_LIBRARY" });

    expect(prisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          ownership: "YC_LIBRARY",
          organisationId: null,
          ownerUserId: null,
        }),
      }),
    );
  });

  it("keeps org and owner bindings for non-library ownership updates", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-1",
      organisationId: "org-1",
      ownerUserId: "user-2",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      updatedBy: "user-1",
    });

    await TemplateService.update("tpl-1", { ownership: "ORG_TEMPLATE" });

    expect(prisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          ownership: "ORG_TEMPLATE",
          organisationId: "org-1",
          ownerUserId: "user-2",
        }),
      }),
    );
  });

  it("updates catalog links using the template organisation and deduplicates ids", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-1",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      { id: "cat-1" },
      { id: "cat-2" },
    ]);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([]);
    const deleteMany = jest.fn().mockResolvedValue({});
    const createMany = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementationOnce(
      async (
        callback: (tx: {
          templateCatalogLink: {
            deleteMany: jest.Mock;
            createMany: jest.Mock;
          };
        }) => Promise<unknown>,
      ) =>
        callback({
          templateCatalogLink: {
            deleteMany,
            createMany,
          },
        }),
    );

    await TemplateService.updateCatalogLinks(
      "tpl-1",
      { catalogItemIds: ["cat-1", "cat-1", "cat-2"] },
      "org-1",
    );

    expect(prisma.productItem.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["cat-1", "cat-2"] },
        organisationId: "org-1",
      },
      select: {
        id: true,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { templateId: "tpl-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { templateId: "tpl-1", catalogItemId: "cat-1" },
        { templateId: "tpl-1", catalogItemId: "cat-2" },
      ],
    });
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-1", "org-1");
  });

  it("resolves only published templates for workspace preload flows", async () => {
    const listForOrganisationSpy = jest
      .spyOn(TemplateService, "listForOrganisation")
      .mockResolvedValue([]);
    const listLibrarySpy = jest
      .spyOn(TemplateService, "listLibrary")
      .mockResolvedValue([]);

    await expect(
      TemplateService.resolve({
        organisationId: "org-1",
        kind: "PRESCRIPTION",
        serviceId: "svc-1",
        mode: "OUTPATIENT",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(listForOrganisationSpy).toHaveBeenCalledWith("org-1", {
      kind: "PRESCRIPTION",
      status: "PUBLISHED",
      scope: undefined,
    });
    expect(listLibrarySpy).toHaveBeenCalledWith({
      kind: "PRESCRIPTION",
      status: "PUBLISHED",
      scope: undefined,
    });

    listForOrganisationSpy.mockRestore();
    listLibrarySpy.mockRestore();
  });

  it("updates catalog links without an organisation filter when the template is global", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-2",
      organisationId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      { id: "cat-3" },
    ]);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([]);
    const deleteMany = jest.fn().mockResolvedValue({});
    const createMany = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementationOnce(
      async (
        callback: (tx: {
          templateCatalogLink: {
            deleteMany: jest.Mock;
            createMany: jest.Mock;
          };
        }) => Promise<unknown>,
      ) =>
        callback({
          templateCatalogLink: {
            deleteMany,
            createMany,
          },
        }),
    );

    await TemplateService.updateCatalogLinks("tpl-2", {
      catalogItemIds: ["cat-3"],
    });

    expect(prisma.productItem.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["cat-3"] },
      },
      select: {
        id: true,
      },
    });
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-2", undefined);
  });

  it("clears catalog links when no catalog item ids are provided", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-empty",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.templateCatalogLink.deleteMany as jest.Mock).mockResolvedValue({});

    await TemplateService.updateCatalogLinks("tpl-empty", {
      catalogItemIds: [],
    });

    expect(prisma.templateCatalogLink.deleteMany).toHaveBeenCalledWith({
      where: { templateId: "tpl-empty" },
    });
    expect(prisma.productItem.findMany).not.toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-empty", undefined);
  });

  it("rejects catalog link updates for YC library templates", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-library",
      organisationId: "org-1",
      ownership: "YC_LIBRARY",
      kind: "SOAP_NOTE",
    });

    await expect(
      TemplateService.updateCatalogLinks(
        "tpl-library",
        { catalogItemIds: ["cat-1"] },
        "org-1",
      ),
    ).rejects.toMatchObject({
      message: "YC library templates cannot own catalog links.",
      statusCode: 400,
    });

    expect(prisma.productItem.findMany).not.toHaveBeenCalled();
  });

  it("rejects catalog items that do not exist for the template organisation", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-missing",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      { id: "cat-1" },
    ]);

    await expect(
      TemplateService.updateCatalogLinks(
        "tpl-missing",
        { catalogItemIds: ["cat-1", "cat-2"] },
        "org-1",
      ),
    ).rejects.toMatchObject({
      message:
        "One or more catalog items were not found for this organisation.",
      statusCode: 404,
    });
  });

  it("rejects conflicting catalog links for the same template kind", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-3",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      { id: "cat-4" },
    ]);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([
      {
        catalogItemId: "cat-4",
        template: {
          kind: "SOAP_NOTE",
        },
      },
    ]);

    await expect(
      TemplateService.updateCatalogLinks(
        "tpl-3",
        { catalogItemIds: ["cat-4"] },
        "org-1",
      ),
    ).rejects.toMatchObject({
      message: "Each catalog item can only be linked to one template per kind.",
      statusCode: 400,
    });
  });
});
