import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { validateClinicalTemplateBlueprint } from "src/services/clinical-template-blueprints";
import { createRenderedDocumentRecord } from "src/services/rendered-document.service";
import { validateTaskWorkflowTemplateBlueprint } from "src/services/task-workflow-blueprints";
import { TaskWorkflowService } from "src/services/task-workflow.service";
import {
  createTemplateInstanceSchema,
  createTemplateSchema,
  TemplateService,
} from "src/services/template.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    template: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    appointment: {
      findFirst: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
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
  TaskWorkflowService: {
    launchFromTemplateInstance: jest.fn(),
  },
}));

// Hoisted so every describe block below can share the same spy: the write
// methods (create/update/publish/archive/updateCatalogLinks) all round-trip
// through getById, and mocking it keeps those tests focused on the write.
const getByIdSpy = jest.spyOn(TemplateService, "getById");

describe("TemplateService ownership persistence", () => {
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

  it("keeps a conflicting catalog link when it belongs to a different kind", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-mix",
      organisationId: "org-1",
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      { id: "cat-9" },
    ]);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([
      {
        catalogItemId: "cat-9",
        // A different template kind is not a conflict for this kind.
        template: { kind: "PRESCRIPTION" },
      },
    ]);
    const deleteMany = jest.fn().mockResolvedValue({});
    const createMany = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementationOnce(
      async (callback: any) =>
        callback({ templateCatalogLink: { deleteMany, createMany } }),
    );

    await TemplateService.updateCatalogLinks(
      "tpl-mix",
      { catalogItemIds: ["cat-9"] },
      "org-1",
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [{ templateId: "tpl-mix", catalogItemId: "cat-9" }],
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

    it("uses latestVersion when the template has no published version", async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        ...orgTemplate,
        organisationId: "org-1",
        publishedVersion: null,
        latestVersion: 3,
      });
      (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
        id: "ver-3",
        version: 3,
      });
      (prisma.templateInstance.create as jest.Mock).mockResolvedValue({
        id: "inst-3",
      });

      await TemplateService.createInstance({
        templateId: "tpl-1",
        organisationId: "org-1",
        appointmentId: "apt-1",
        caseId: "case-1",
        encounterId: "enc-1",
        data: { a: 1 },
      });

      expect(prisma.templateVersion.findUnique).toHaveBeenCalledWith({
        where: { templateId_version: { templateId: "tpl-1", version: 3 } },
      });
      expect(prisma.templateInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templateVersion: 3,
            appointmentId: "apt-1",
            caseId: "case-1",
            encounterId: "enc-1",
          }),
        }),
      );
    });

    it("rejects instantiating a template that does not exist", async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        TemplateService.createInstance({
          templateId: "missing",
          organisationId: "org-1",
          data: {},
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.templateInstance.create).not.toHaveBeenCalled();
    });
  });
});

describe("TemplateService.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getByIdSpy.mockResolvedValue({ id: "created" } as never);
  });

  it("creates an org template and its first version in one transaction", async () => {
    const txTemplateCreate = jest.fn().mockResolvedValue({ id: "tpl-new" });
    const txVersionCreate = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { create: txTemplateCreate },
          templateVersion: { create: txVersionCreate },
        }),
    );

    const result = await TemplateService.create({
      ownership: "ORG_TEMPLATE",
      organisationId: "org-1",
      kind: "SOAP_NOTE",
      name: "SOAP",
      scope: "ORGANISATION",
      rules: { foo: "bar" },
      renderConfigSnapshot: { r: 1 },
      validationSnapshot: { v: 1 },
      schemaSnapshot: {
        sections: [{ id: "subjective", title: "Subjective", fields: [] }],
      },
      createdBy: "user-1",
    });

    expect(txTemplateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org-1",
        ownerUserId: undefined,
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "SOAP",
        status: "DRAFT",
        scope: "ORGANISATION",
        rules: { foo: "bar" },
        latestVersion: 1,
        publishedVersion: null,
        createdBy: "user-1",
        // updatedBy defaults to createdBy when omitted.
        updatedBy: "user-1",
      }),
    });
    expect(txVersionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl-new",
        version: 1,
        createdBy: "user-1",
      }),
    });
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-new");
    expect(result).toEqual({ id: "created" });
  });

  it("maps CONSENT to the FORM storage kind and binds the owner for user templates", async () => {
    const txTemplateCreate = jest.fn().mockResolvedValue({ id: "tpl-user" });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { create: txTemplateCreate },
          templateVersion: { create: jest.fn().mockResolvedValue({}) },
        }),
    );

    await TemplateService.create({
      ownership: "USER_TEMPLATE",
      organisationId: "org-1",
      ownerUserId: "user-9",
      kind: "CONSENT",
      name: "Consent",
      scope: "ORGANISATION",
      schemaSnapshot: { sections: [] },
      createdBy: "user-1",
      updatedBy: "user-2",
    });

    expect(txTemplateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "FORM",
        ownerUserId: "user-9",
        updatedBy: "user-2",
        rules: undefined,
      }),
    });
  });

  it("validates task-workflow kinds through the task blueprint validator", async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { create: jest.fn().mockResolvedValue({ id: "t" }) },
          templateVersion: { create: jest.fn().mockResolvedValue({}) },
        }),
    );

    await TemplateService.create({
      ownership: "ORG_TEMPLATE",
      organisationId: "org-1",
      kind: "TASK_ASSIGNMENT",
      name: "Task",
      scope: "ORGANISATION",
      schemaSnapshot: { sections: [] },
      createdBy: "user-1",
    });

    expect(validateTaskWorkflowTemplateBlueprint).toHaveBeenCalledWith(
      "TASK_TEMPLATE",
      { sections: [] },
    );
  });

  it("rejects a schema that fails blueprint validation", async () => {
    (validateClinicalTemplateBlueprint as jest.Mock).mockReturnValueOnce({
      requiredSectionIds: [],
      missingSectionIds: ["subjective"],
      missingFieldPaths: ["subjective.chiefComplaint"],
      invalidFieldPaths: ["objective.temp"],
    });

    await expect(
      TemplateService.create({
        ownership: "ORG_TEMPLATE",
        organisationId: "org-1",
        kind: "SOAP_NOTE",
        name: "SOAP",
        scope: "ORGANISATION",
        schemaSnapshot: { sections: [] },
        createdBy: "user-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Template schema is invalid for SOAP_NOTE: missing sections: subjective; missing fields: subjective.chiefComplaint; invalid fields: objective.temp",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reports only the failing validation buckets", async () => {
    (validateClinicalTemplateBlueprint as jest.Mock).mockReturnValueOnce({
      requiredSectionIds: [],
      missingSectionIds: ["subjective"],
      missingFieldPaths: [],
      invalidFieldPaths: [],
    });

    await expect(
      TemplateService.create({
        ownership: "ORG_TEMPLATE",
        organisationId: "org-1",
        kind: "SOAP_NOTE",
        name: "SOAP",
        scope: "ORGANISATION",
        schemaSnapshot: { sections: [] },
        createdBy: "user-1",
      }),
    ).rejects.toMatchObject({
      message:
        "Template schema is invalid for SOAP_NOTE: missing sections: subjective",
    });
  });
});

describe("createTemplateSchema validation", () => {
  it("requires an organisation for org templates", () => {
    const result = createTemplateSchema.safeParse({
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP",
      schemaSnapshot: { sections: [] },
      createdBy: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["organisationId"],
            message: "Organisation is required for organisation templates",
          }),
        ]),
      );
    }
  });

  it("requires an organisation and owner for user templates", () => {
    const result = createTemplateSchema.safeParse({
      ownership: "USER_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP",
      schemaSnapshot: { sections: [] },
      createdBy: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Organisation is required for user templates");
      expect(messages).toContain("Owner user is required for user templates");
    }
  });
});

describe("TemplateService.update version handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getByIdSpy.mockResolvedValue({ id: "updated" } as never);
  });

  const baseTemplate = {
    id: "tpl-1",
    organisationId: "org-1",
    ownerUserId: "user-2",
    ownership: "ORG_TEMPLATE",
    kind: "SOAP_NOTE",
    name: "SOAP",
    description: "desc",
    status: "PUBLISHED",
    scope: "ORGANISATION",
    rules: {},
    latestVersion: 1,
    publishedVersion: 1,
    updatedBy: "user-1",
  };

  it("forks a new version when the published version is current", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(baseTemplate);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v1",
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: { r: 1 },
      validationSnapshot: { v: 1 },
    });

    const txTemplateUpdate = jest.fn().mockResolvedValue({});
    const txVersionCreate = jest.fn().mockResolvedValue({});
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          template: { update: txTemplateUpdate },
          templateVersion: { create: txVersionCreate },
        }),
    );

    await TemplateService.update(
      "tpl-1",
      {
        name: "New name",
        schemaSnapshot: {
          sections: [{ id: "s", title: "S", fields: [] }],
        },
      },
      "org-1",
    );

    expect(txTemplateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          latestVersion: 2,
          name: "New name",
        }),
      }),
    );
    expect(txVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "tpl-1",
          version: 2,
        }),
      }),
    );
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-1");
  });

  it("updates the current version in place when the draft version is ahead", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      ...baseTemplate,
      latestVersion: 2,
      publishedVersion: 1,
    });
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v2",
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: { r: 1 },
      validationSnapshot: { v: 1 },
    });

    await TemplateService.update(
      "tpl-1",
      {
        renderConfigSnapshot: { r: 2 },
        description: "Updated desc",
        rules: { a: 1 },
      },
      "org-1",
    );

    expect(prisma.templateVersion.update).toHaveBeenCalledWith({
      where: { id: "v2" },
      data: {
        schemaSnapshot: { sections: [] },
        renderConfigSnapshot: { r: 2 },
        validationSnapshot: { v: 1 },
      },
    });
    expect(prisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "Updated desc",
          rules: { a: 1 },
        }),
      }),
    );
  });

  it("clears description and rules without touching versions", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      ...baseTemplate,
      latestVersion: 1,
      publishedVersion: null,
    });

    await TemplateService.update(
      "tpl-1",
      {
        name: "Renamed",
        description: null,
        rules: null,
        status: "ARCHIVED",
      },
      "org-1",
    );

    expect(prisma.templateVersion.findUnique).not.toHaveBeenCalled();
    expect(prisma.templateVersion.update).not.toHaveBeenCalled();
    expect(prisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Renamed",
          description: undefined,
          rules: Prisma.DbNull,
          status: "ARCHIVED",
        }),
      }),
    );
  });

  it("rejects updating a template that does not exist", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      TemplateService.update("missing", { name: "x" }, "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects updating against a missing template version", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(baseTemplate);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      TemplateService.update(
        "tpl-1",
        { schemaSnapshot: { sections: [] } },
        "org-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Template version not found",
    });
  });
});

describe("TemplateService.publish / archive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getByIdSpy.mockResolvedValue({ id: "result" } as never);
  });

  const template = {
    id: "tpl-1",
    organisationId: "org-1",
    ownership: "ORG_TEMPLATE",
    kind: "SOAP_NOTE",
    status: "DRAFT",
    latestVersion: 2,
    publishedVersion: 1,
  };

  it("publishes the latest version and stamps publishedAt", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(template);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v2",
    });
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    await TemplateService.publish("tpl-1", "publisher-1", "org-1");

    expect(prisma.template.update).toHaveBeenCalledWith({
      where: { id: "tpl-1" },
      data: {
        status: "PUBLISHED",
        publishedVersion: 2,
        updatedBy: "publisher-1",
      },
    });
    expect(prisma.templateVersion.update).toHaveBeenCalledWith({
      where: { id: "v2" },
      data: { publishedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("is a no-op when the latest version is already published", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      ...template,
      status: "PUBLISHED",
      latestVersion: 1,
      publishedVersion: 1,
    });
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v1",
    });

    await TemplateService.publish("tpl-1", "publisher-1", "org-1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.template.update).not.toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-1");
  });

  it("archives a template", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(template);

    await TemplateService.archive("tpl-1", "archiver-1", "org-1");

    expect(prisma.template.update).toHaveBeenCalledWith({
      where: { id: "tpl-1" },
      data: { status: "ARCHIVED", updatedBy: "archiver-1" },
    });
    expect(getByIdSpy).toHaveBeenCalledWith("tpl-1");
  });
});

describe("TemplateService.updateInstance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects updating an instance that does not exist", async () => {
    (prisma.templateInstance.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      TemplateService.updateInstance("inst-1", { data: {} }, "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects updating an instance owned by another organisation", async () => {
    (prisma.templateInstance.findUnique as jest.Mock).mockResolvedValue({
      id: "inst-1",
      organisationId: "org-victim",
    });

    await expect(
      TemplateService.updateInstance("inst-1", { data: {} }, "org-attacker"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("merges patch data and applies every mutable field", async () => {
    const signedAt = new Date("2026-01-01T00:00:00.000Z");
    (prisma.templateInstance.findUnique as jest.Mock).mockResolvedValue({
      id: "inst-1",
      organisationId: "org-1",
      data: { keep: 1 },
      status: "DRAFT",
      signedBy: null,
      signedAt: null,
      generatedPdfUrl: null,
      generatedPdf: null,
    });
    (prisma.templateInstance.update as jest.Mock).mockResolvedValue({});

    await TemplateService.updateInstance(
      "inst-1",
      {
        data: { added: 2 },
        status: "COMPLETED",
        signedBy: "vet-1",
        signedAt,
        generatedPdfUrl: "https://pdf",
        generatedPdf: { p: 1 },
      },
      "org-1",
    );

    expect(prisma.templateInstance.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: {
        data: { keep: 1, added: 2 },
        status: "COMPLETED",
        signedBy: "vet-1",
        signedAt,
        generatedPdfUrl: "https://pdf",
        generatedPdf: { p: 1 },
      },
    });
  });

  it("preserves existing values when the patch omits fields", async () => {
    (prisma.templateInstance.findUnique as jest.Mock).mockResolvedValue({
      id: "inst-1",
      organisationId: "org-1",
      data: { keep: 1 },
      status: "DRAFT",
      signedBy: "existing",
      signedAt: new Date("2026-02-02T00:00:00.000Z"),
      generatedPdfUrl: "https://existing",
      generatedPdf: { existing: true },
    });
    (prisma.templateInstance.update as jest.Mock).mockResolvedValue({});

    await TemplateService.updateInstance("inst-1", {}, "org-1");

    expect(prisma.templateInstance.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: expect.objectContaining({
        data: { keep: 1 },
        status: "DRAFT",
        signedBy: "existing",
        generatedPdfUrl: "https://existing",
      }),
    });
  });

  it("nulls out signature and pdf fields when the patch clears them", async () => {
    (prisma.templateInstance.findUnique as jest.Mock).mockResolvedValue({
      id: "inst-1",
      organisationId: "org-1",
      // A non-object base exercises the mergeJsonObject fallback branch.
      data: null,
      status: "DRAFT",
      signedBy: "existing",
      signedAt: new Date("2026-02-02T00:00:00.000Z"),
      generatedPdfUrl: "https://existing",
      generatedPdf: { existing: true },
    });
    (prisma.templateInstance.update as jest.Mock).mockResolvedValue({});

    await TemplateService.updateInstance(
      "inst-1",
      {
        data: { fresh: 1 },
        signedBy: null,
        signedAt: null,
        generatedPdfUrl: null,
        generatedPdf: null,
      },
      "org-1",
    );

    expect(prisma.templateInstance.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: expect.objectContaining({
        data: { fresh: 1 },
        signedBy: undefined,
        signedAt: undefined,
        generatedPdfUrl: undefined,
        generatedPdf: Prisma.DbNull,
      }),
    });
  });
});

describe("TemplateService.submitInstance", () => {
  const launchMock =
    TaskWorkflowService.launchFromTemplateInstance as jest.Mock;
  const renderMock = createRenderedDocumentRecord as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const runTransaction = (
    instance: unknown,
    updateResult: unknown = { id: "inst-1", status: "COMPLETED" },
  ) => {
    const findUnique = jest.fn().mockResolvedValue(instance);
    const update = jest.fn().mockResolvedValue(updateResult);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: any) =>
        callback({
          templateInstance: { findUnique, update },
        }),
    );
    return { findUnique, update };
  };

  it("rejects submitting an instance that does not exist", async () => {
    runTransaction(null);

    await expect(
      TemplateService.submitInstance("inst-1", "org-1", "vet-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects submitting an instance from another organisation", async () => {
    runTransaction({
      id: "inst-1",
      organisationId: "org-victim",
      status: "DRAFT",
      template: { id: "tpl-1", kind: "SOAP_NOTE", ownership: "ORG_TEMPLATE" },
    });

    await expect(
      TemplateService.submitInstance("inst-1", "org-attacker", "vet-1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns the instance untouched when already completed", async () => {
    const instance = {
      id: "inst-1",
      organisationId: "org-1",
      status: "COMPLETED",
      template: { id: "tpl-1", kind: "SOAP_NOTE", ownership: "ORG_TEMPLATE" },
    };
    const { update } = runTransaction(instance);

    const result = await TemplateService.submitInstance(
      "inst-1",
      "org-1",
      "vet-1",
    );

    expect(result).toBe(instance);
    expect(launchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when no submitter identity can be derived", async () => {
    runTransaction({
      id: "inst-1",
      organisationId: "org-1",
      status: "DRAFT",
      authorId: null,
      signedBy: null,
      template: {
        id: "tpl-1",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
    });

    await expect(
      TemplateService.submitInstance("inst-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid submittedBy",
    });

    expect(launchMock).not.toHaveBeenCalled();
  });

  it("launches the workflow and records a rendered document for FORM kinds", async () => {
    const { update } = runTransaction({
      id: "inst-1",
      organisationId: "org-1",
      status: "DRAFT",
      authorId: "author-1",
      signedBy: null,
      templateId: "tpl-1",
      templateVersion: 2,
      generatedPdf: null,
      template: { id: "tpl-1", kind: "FORM", ownership: "ORG_TEMPLATE" },
    });
    renderMock.mockResolvedValue({
      id: "rd-1",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "inst-1",
      kind: "FORM",
      version: 1,
      status: "DRAFT",
      signable: true,
      mimeType: "application/pdf",
      signedAt: null,
      signedBy: null,
      pdfUrl: "https://pdf",
    });

    await TemplateService.submitInstance("inst-1", "org-1");

    expect(launchMock).toHaveBeenCalledWith(
      "inst-1",
      "org-1",
      { actorId: "author-1", canEditAny: true },
      expect.objectContaining({ notify: true }),
    );
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Form submission",
        source: expect.objectContaining({
          sourceKind: "TEMPLATE_INSTANCE",
          templateKind: "FORM",
        }),
      }),
      expect.anything(),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: {
        status: "COMPLETED",
        generatedPdf: expect.objectContaining({
          renderedDocumentId: "rd-1",
          signedAt: null,
          signedBy: null,
        }),
        generatedPdfUrl: "https://pdf",
      },
    });
  });

  it("humanises non-FORM document titles and carries signature metadata", async () => {
    const signedAt = new Date("2026-03-03T00:00:00.000Z");
    const { update } = runTransaction({
      id: "inst-1",
      organisationId: "org-1",
      status: "DRAFT",
      authorId: null,
      signedBy: "vet-2",
      templateId: "tpl-1",
      templateVersion: 1,
      generatedPdf: null,
      template: { id: "tpl-1", kind: "SOAP_NOTE", ownership: "ORG_TEMPLATE" },
    });
    renderMock.mockResolvedValue({
      id: "rd-2",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "inst-1",
      kind: "SOAP_NOTE",
      version: 1,
      status: "SIGNED",
      signable: true,
      mimeType: "application/pdf",
      signedAt,
      signedBy: "vet-2",
      pdfUrl: null,
    });

    await TemplateService.submitInstance("inst-1", "org-1");

    // authorId is null, so the signer identity is used as the submitter.
    expect(launchMock).toHaveBeenCalledWith(
      "inst-1",
      "org-1",
      { actorId: "vet-2", canEditAny: true },
      expect.anything(),
    );
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "SOAP NOTE" }),
      expect.anything(),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: {
        status: "COMPLETED",
        generatedPdf: expect.objectContaining({
          signedAt,
          signedBy: "vet-2",
        }),
        generatedPdfUrl: undefined,
      },
    });
  });

  it("skips rendered documents for non-document template kinds", async () => {
    const { update } = runTransaction({
      id: "inst-1",
      organisationId: "org-1",
      status: "DRAFT",
      authorId: "author-1",
      signedBy: null,
      templateId: "tpl-1",
      templateVersion: 1,
      generatedPdf: { existing: true },
      template: {
        id: "tpl-1",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
    });

    await TemplateService.submitInstance("inst-1", "org-1", "vet-1");

    expect(renderMock).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: {
        status: "COMPLETED",
        generatedPdf: { existing: true },
        generatedPdfUrl: undefined,
      },
    });
  });
});

describe("TemplateService list methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists org templates, applies filters, and derives metadata", async () => {
    (prisma.template.findMany as jest.Mock).mockResolvedValue([
      {
        id: "a",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        rules: {
          appliesTo: {
            serviceIds: ["S1", "s1"],
            packageIds: ["p1"],
            species: ["Dog"],
            encounterModes: ["OUTPATIENT"],
            organisationTypes: ["clinic"],
            specialityIds: ["sp1"],
            defaultForKind: true,
          },
        },
        catalogLinks: [{ catalogItemId: "c1" }, { catalogItemId: "c2" }],
      },
      {
        id: "b",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        rules: {},
        catalogLinks: [],
      },
      {
        id: "c",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        // Root-level rules (no nested appliesTo) and undefined catalogLinks.
        rules: { serviceIds: ["x"] },
        catalogLinks: undefined,
      },
      {
        id: "d",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        rules: null,
        catalogLinks: [],
      },
      {
        id: "e",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        rules: ["array-rules"],
        catalogLinks: [],
      },
      {
        id: "f",
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        rules: {
          appliesTo: { serviceIds: ["  ", ""], defaultForKind: "yes" },
        },
        catalogLinks: [],
      },
    ]);

    const result = await TemplateService.listForOrganisation("org-1", {
      kind: "CONSENT",
      status: "PUBLISHED",
      scope: "ORGANISATION",
      search: "soap",
    });

    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          ownership: "ORG_TEMPLATE",
          kind: "FORM",
          status: "PUBLISHED",
          scope: "ORGANISATION",
          OR: [
            { name: { contains: "soap", mode: "insensitive" } },
            { description: { contains: "soap", mode: "insensitive" } },
          ],
        }),
      }),
    );

    expect(result[0]).toMatchObject({
      catalogItemIds: ["c1", "c2"],
      source: "ORGANISATION",
      appliesTo: {
        serviceIds: ["s1"],
        packageIds: ["p1"],
        species: ["dog"],
        encounterModes: ["outpatient"],
        organisationTypes: ["clinic"],
        specialityIds: ["sp1"],
        defaultForKind: true,
      },
    });
    expect(result[1].appliesTo).toBeNull();
    expect(result[1].catalogItemIds).toEqual([]);
    expect(result[2].appliesTo).toMatchObject({ serviceIds: ["x"] });
    expect(result[2].catalogItemIds).toEqual([]);
    expect(result[3].appliesTo).toBeNull();
    expect(result[4].appliesTo).toBeNull();
    expect(result[5].appliesTo).toBeNull();
  });

  it("lists YC library templates without a search filter", async () => {
    (prisma.template.findMany as jest.Mock).mockResolvedValue([
      {
        id: "L",
        ownership: "YC_LIBRARY",
        kind: "CARE_PATHWAY",
        rules: {},
        catalogLinks: [],
      },
    ]);

    const result = await TemplateService.listLibrary();

    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownership: "YC_LIBRARY",
          kind: undefined,
        }),
      }),
    );
    expect(result[0]).toMatchObject({
      source: "YC_LIBRARY",
      kind: "INPATIENT_SCHEDULE",
    });
  });

  it("maps the INPATIENT_SCHEDULE filter to the CARE_PATHWAY storage kind", async () => {
    (prisma.template.findMany as jest.Mock).mockResolvedValue([]);

    await TemplateService.listForOrganisation("org-1", {
      kind: "INPATIENT_SCHEDULE",
    });

    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kind: "CARE_PATHWAY" }),
      }),
    );
  });

  it("lists user templates scoped to org and owner", async () => {
    (prisma.template.findMany as jest.Mock).mockResolvedValue([
      {
        id: "U",
        ownership: "USER_TEMPLATE",
        kind: "TASK_TEMPLATE",
        rules: {},
        catalogLinks: [],
      },
    ]);

    const result = await TemplateService.listForUser("org-1", "user-1", {
      kind: "TASK_ASSIGNMENT",
    });

    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          ownerUserId: "user-1",
          ownership: "USER_TEMPLATE",
          kind: "TASK_TEMPLATE",
        }),
      }),
    );
    expect(result[0]).toMatchObject({
      source: "USER",
      kind: "TASK_ASSIGNMENT",
    });
  });
});

describe("TemplateService.resolve", () => {
  let listForUserSpy: jest.SpyInstance;
  let listForOrganisationSpy: jest.SpyInstance;
  let listLibrarySpy: jest.SpyInstance;

  const resolverTemplate = (over: Record<string, unknown>) => ({
    id: "t",
    ownership: "ORG_TEMPLATE",
    ownerUserId: null,
    name: "T",
    rules: {},
    catalogItemIds: [],
    appliesTo: null,
    latestVersion: 1,
    publishedVersion: 1,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    listForUserSpy = jest
      .spyOn(TemplateService, "listForUser")
      .mockResolvedValue([]);
    listForOrganisationSpy = jest
      .spyOn(TemplateService, "listForOrganisation")
      .mockResolvedValue([]);
    listLibrarySpy = jest
      .spyOn(TemplateService, "listLibrary")
      .mockResolvedValue([]);
  });

  afterEach(() => {
    listForUserSpy.mockRestore();
    listForOrganisationSpy.mockRestore();
    listLibrarySpy.mockRestore();
  });

  it("returns a user-linked template with its published version snapshot", async () => {
    listForUserSpy.mockResolvedValue([
      resolverTemplate({
        id: "u1",
        ownership: "USER_TEMPLATE",
        ownerUserId: "user-1",
        rules: { appliesTo: { serviceIds: ["svc-1"] } },
        appliesTo: { serviceIds: ["svc-1"], defaultForKind: false },
        publishedVersion: 2,
        latestVersion: 2,
      }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-u1",
      version: 2,
      schemaSnapshot: { sections: [{ id: "s" }] },
      renderConfigSnapshot: { r: 1 },
      validationSnapshot: { v: 1 },
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
      ownerUserId: "user-1",
      serviceId: "svc-1",
    });

    expect(result).toMatchObject({
      templateId: "u1",
      templateVersion: 2,
      templateVersionId: "v-u1",
      source: "USER",
      ownerUserId: "user-1",
      kind: "PRESCRIPTION",
      reason: "Matched user template linked to service/species/mode.",
      schemaSnapshot: { sections: [{ id: "s" }] },
      renderConfigSnapshot: { r: 1 },
      validationSnapshot: { v: 1 },
    });
  });

  it("prefers the higher-scoring org-linked template and defaults snapshots", async () => {
    listForOrganisationSpy.mockResolvedValue([
      resolverTemplate({
        id: "o1",
        appliesTo: { packageIds: ["pkg-1"], defaultForKind: true },
      }),
      resolverTemplate({
        id: "o2",
        appliesTo: null,
        catalogItemIds: ["pkg-1"],
      }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-o1",
      version: 1,
      schemaSnapshot: null,
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
      packageId: "pkg-1",
    });

    expect(result).toMatchObject({
      templateId: "o1",
      source: "ORGANISATION",
      ownerUserId: null,
      reason: "Matched organisation template default for kind.",
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });
  });

  it("falls back to a user default template when nothing is linked", async () => {
    listForUserSpy.mockResolvedValue([
      resolverTemplate({
        id: "ud1",
        ownership: "USER_TEMPLATE",
        ownerUserId: "user-1",
        appliesTo: { defaultForKind: true },
      }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-ud1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
      ownerUserId: "user-1",
    });

    expect(result).toMatchObject({
      templateId: "ud1",
      source: "USER",
      reason: "Matched user default template for kind (default).",
    });
  });

  it("falls back to an org default template and tie-breaks equal candidates", async () => {
    listForOrganisationSpy.mockResolvedValue([
      resolverTemplate({ id: "c1", appliesTo: { defaultForKind: true } }),
      resolverTemplate({ id: "c2", appliesTo: { defaultForKind: true } }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-c1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
    });

    expect(result).toMatchObject({
      templateId: "c1",
      reason: "Matched organisation default template for kind (default).",
    });
  });

  it("falls back to a YC library default template", async () => {
    listLibrarySpy.mockResolvedValue([
      resolverTemplate({
        id: "lib1",
        ownership: "YC_LIBRARY",
        appliesTo: { defaultForKind: true },
      }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-lib1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
    });

    expect(result).toMatchObject({
      templateId: "lib1",
      source: "YC_LIBRARY",
      reason: "Matched YC library default template for kind (default).",
    });
  });

  it("matches on species and mode and falls back to legacy catalog metadata", async () => {
    listForOrganisationSpy.mockResolvedValue([
      resolverTemplate({
        id: "sp1",
        appliesTo: { species: ["dog"], encounterModes: ["OUTPATIENT"] },
        catalogItemIds: ["leg-1"],
      }),
    ] as never);
    (prisma.templateVersion.findUnique as jest.Mock).mockResolvedValue({
      id: "v-sp1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
    });

    const result = await TemplateService.resolve({
      organisationId: "org-1",
      kind: "PRESCRIPTION",
      // serviceId is matched via the legacy catalog-item ids, not appliesTo.
      serviceId: "leg-1",
      species: "Dog",
      mode: "OUTPATIENT",
    });

    expect(result).toMatchObject({
      templateId: "sp1",
      reason: "Matched organisation template linked to service/species/mode.",
      appliesTo: { serviceIds: ["leg-1"] },
    });
  });

  it.each(["CONSENT", "TASK_ASSIGNMENT", "INPATIENT_SCHEDULE"] as const)(
    "throws a 404 when no %s template resolves",
    async (kind) => {
      await expect(
        TemplateService.resolve({ organisationId: "org-1", kind }),
      ).rejects.toMatchObject({ statusCode: 404 });
    },
  );

  describe("mode inference from context", () => {
    it("infers INPATIENT from an inpatient appointment", async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: null,
      });

      await expect(
        TemplateService.resolve({
          organisationId: "org-1",
          kind: "PRESCRIPTION",
          appointmentId: "apt-1",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ id: "apt-1" }] },
        }),
      );
      expect(prisma.admission.findUnique).not.toHaveBeenCalled();
    });

    it("infers INPATIENT from an admission on the encounter", async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.admission.findUnique as jest.Mock).mockResolvedValue({
        admittedAt: new Date("2026-04-04T00:00:00.000Z"),
      });

      await expect(
        TemplateService.resolve({
          organisationId: "org-1",
          kind: "PRESCRIPTION",
          encounterId: "enc-1",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.admission.findUnique).toHaveBeenCalledWith({
        where: { encounterId: "enc-1" },
        select: { admittedAt: true },
      });
    });

    it("infers OUTPATIENT when the encounter has no admission", async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({
        appointmentKind: "OUTPATIENT",
        encounterId: "enc-2",
      });
      (prisma.admission.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        TemplateService.resolve({
          organisationId: "org-1",
          kind: "PRESCRIPTION",
          appointmentId: "apt-2",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.admission.findUnique).toHaveBeenCalledWith({
        where: { encounterId: "enc-2" },
        select: { admittedAt: true },
      });
    });

    it("leaves the mode undefined when no encounter can be derived", async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({
        appointmentKind: null,
        encounterId: null,
      });

      await expect(
        TemplateService.resolve({
          organisationId: "org-1",
          kind: "PRESCRIPTION",
          appointmentId: "apt-3",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.admission.findUnique).not.toHaveBeenCalled();
    });
  });
});

// Placed last: getById is restored to its real implementation here, after every
// describe that relies on the spy has run.
describe("TemplateService.getById (real implementation)", () => {
  beforeAll(() => {
    getByIdSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a blank template id", async () => {
    await expect(TemplateService.getById("   ")).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid templateId",
    });
    expect(prisma.template.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a template that does not exist", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(TemplateService.getById("tpl-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rejects reads against another organisation", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-1",
      organisationId: "org-victim",
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      rules: {},
      catalogLinks: [],
    });

    await expect(
      TemplateService.getById("tpl-1", "org-attacker"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Template does not belong to organisation",
    });
  });

  it("returns a YC library template regardless of the caller organisation", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl-lib",
      organisationId: null,
      ownerUserId: null,
      ownership: "YC_LIBRARY",
      kind: "CARE_PATHWAY",
      rules: { appliesTo: { species: ["cat"] } },
      catalogLinks: [{ catalogItemId: "c1" }],
    });

    const result = await TemplateService.getById("tpl-lib", "org-1");

    expect(result).toMatchObject({
      id: "tpl-lib",
      source: "YC_LIBRARY",
      kind: "INPATIENT_SCHEDULE",
      catalogItemIds: ["c1"],
      appliesTo: { species: ["cat"] },
    });
  });
});
