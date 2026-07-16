import { prisma } from "src/config/prisma";
import {
  createTemplateInstanceSchema,
  TemplateService,
} from "src/services/template.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    template: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    templateInstance: {
      create: jest.fn(),
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

  // The YC library is global, unowned state seeded out of band. No API principal
  // is scoped above a single organisation, so no request may write it.
  it("rejects creating a template in the YC library", async () => {
    const txTemplateCreate = jest.fn().mockResolvedValue({ id: "tpl-1" });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { create: txTemplateCreate },
          templateVersion: { create: jest.fn().mockResolvedValue({}) },
        }),
    );

    await expect(
      TemplateService.create({
        ownership: "YC_LIBRARY",
        kind: "SOAP_NOTE",
        name: "SOAP",
        scope: "ORGANISATION",
        schemaSnapshot: {
          sections: [{ id: "subjective", title: "Subjective", fields: [] }],
        },
        createdBy: "user-1",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(txTemplateCreate).not.toHaveBeenCalled();
  });

  it("rejects detaching an org template into the YC library", async () => {
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

    await expect(
      TemplateService.update("tpl-1", { ownership: "YC_LIBRARY" }, "org-1"),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.template.update).not.toHaveBeenCalled();
  });

  it.each([
    ["update", () => TemplateService.update("tpl-1", { name: "x" }, "org-1")],
    ["publish", () => TemplateService.publish("tpl-1", "user-1", "org-1")],
    ["archive", () => TemplateService.archive("tpl-1", "user-1", "org-1")],
    [
      "updateCatalogLinks",
      () =>
        TemplateService.updateCatalogLinks(
          "tpl-1",
          { catalogItemIds: ["cat-1"] },
          "org-1",
        ),
    ],
  ])(
    "rejects %s against a YC library template from an organisation route",
    async (_name, call) => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: "tpl-1",
        organisationId: null,
        ownerUserId: null,
        ownership: "YC_LIBRARY",
        kind: "SOAP_NOTE",
        name: "SOAP",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: {},
        latestVersion: 1,
        publishedVersion: 1,
        updatedBy: "user-1",
      });

      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.template.update).not.toHaveBeenCalled();
    },
  );

  it("rejects writes against another organisation's template", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-1",
      organisationId: "org-victim",
      ownerUserId: null,
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

    await expect(
      TemplateService.update("tpl-1", { name: "x" }, "org-attacker"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.template.update).not.toHaveBeenCalled();
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

    await TemplateService.update(
      "tpl-1",
      { ownership: "ORG_TEMPLATE" },
      "org-1",
    );

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

  it("rejects catalog link updates for an organisation-less template", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-2",
      organisationId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });

    // An org-less template is global state: scoping its catalog query to the
    // caller would be wrong, and leaving it unscoped would let any tenant link
    // it, so the write is refused outright.
    await expect(
      TemplateService.updateCatalogLinks(
        "tpl-2",
        { catalogItemIds: ["cat-3"] },
        "org-1",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.productItem.findMany).not.toHaveBeenCalled();
  });

  it("clears catalog links when no catalog item ids are provided", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-empty",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.templateCatalogLink.deleteMany as jest.Mock).mockResolvedValue({});

    await TemplateService.updateCatalogLinks(
      "tpl-empty",
      { catalogItemIds: [] },
      "org-1",
    );

    expect(prisma.templateCatalogLink.deleteMany).toHaveBeenCalledWith({
      where: { templateId: "tpl-empty" },
    });
    expect(prisma.productItem.findMany).not.toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-empty", "org-1");
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
    ).rejects.toMatchObject({ statusCode: 403 });

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

  describe("createInstance tenant scoping", () => {
    const orgTemplate = {
      id: "tpl-1",
      organisationId: "org-victim",
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      latestVersion: 1,
      publishedVersion: 1,
    };

    it("rejects instantiating another organisation's template", async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(orgTemplate);

      await expect(
        TemplateService.createInstance({
          templateId: "tpl-1",
          organisationId: "org-attacker",
          data: {},
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.templateInstance.create).not.toHaveBeenCalled();
    });

    it("writes the instance under the authorized organisation, not the payload", async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        ...orgTemplate,
        organisationId: "org-1",
      });
      (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
        id: "ver-1",
        version: 1,
      });
      (prisma.templateInstance.create as jest.Mock).mockResolvedValue({
        id: "inst-1",
      });

      await TemplateService.createInstance({
        templateId: "tpl-1",
        organisationId: "org-1",
        authorId: "user-1",
        data: {},
      });

      expect(prisma.templateInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organisationId: "org-1",
            authorId: "user-1",
          }),
        }),
      );
    });

    it("strips organisationId and authorId from the request body", () => {
      // RBAC authorizes the URL organisation, so these two must come from the
      // request context. Keeping them out of the schema means a body value is
      // dropped before it can reach the write.
      const parsed = createTemplateInstanceSchema.parse({
        organisationId: "org-attacker",
        authorId: "someone-else",
        data: {},
      });

      expect(parsed).not.toHaveProperty("organisationId");
      expect(parsed).not.toHaveProperty("authorId");
    });

    it("allows instantiating a YC library template into the caller's org", async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        ...orgTemplate,
        organisationId: null,
        ownership: "YC_LIBRARY",
      });
      (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
        id: "ver-1",
        version: 1,
      });
      (prisma.templateInstance.create as jest.Mock).mockResolvedValue({
        id: "inst-1",
      });

      await TemplateService.createInstance({
        templateId: "tpl-1",
        organisationId: "org-1",
        data: {},
      });

      // Reading/instantiating the library stays open; only writing it is closed.
      expect(prisma.templateInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });
  });
});
