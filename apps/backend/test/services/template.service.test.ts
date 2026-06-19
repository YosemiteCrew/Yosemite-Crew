import { prisma } from "src/config/prisma";
import {
  TemplateService,
  TemplateServiceError,
} from "../../src/services/template.service";
import { buildClinicalTemplateSchemaSnapshot } from "../../src/services/clinical-template-blueprints";
import { buildTaskWorkflowTemplateSchemaSnapshot } from "../../src/services/task-workflow-blueprints";
import { TaskWorkflowService } from "../../src/services/task-workflow.service";

jest.mock("../../src/services/task-workflow.service", () => ({
  TaskWorkflowService: {
    launchFromTemplateInstance: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    appointment: {
      findFirst: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
    },
    template: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    templateVersion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productItem: {
      findMany: jest.fn(),
    },
    templateCatalogLink: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    templateInstance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    renderedDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("TemplateService", () => {
  const organisationId = "org-1";
  const templateId = "tmpl-1";
  const instanceId = "inst-1";
  const soapSnapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");

  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    appointment: {
      findFirst: jest.Mock;
    };
    admission: {
      findUnique: jest.Mock;
    };
    template: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    templateVersion: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    productItem: {
      findMany: jest.Mock;
    };
    templateCatalogLink: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
    templateInstance: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    renderedDocument: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockedTaskWorkflowService = TaskWorkflowService as unknown as {
    launchFromTemplateInstance: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return undefined;
    });
    mockedPrisma.productItem.findMany.mockResolvedValue([]);
    mockedPrisma.templateCatalogLink.findMany.mockResolvedValue([]);
    mockedPrisma.templateCatalogLink.deleteMany.mockResolvedValue({ count: 0 });
    mockedPrisma.templateCatalogLink.createMany.mockResolvedValue({ count: 0 });
  });

  it("creates a template with an initial version", async () => {
    mockedPrisma.template.create.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      latestVersion: 1,
      publishedVersion: null,
      status: "DRAFT",
    });
    mockedPrisma.template.findUnique.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP note",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: null,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [{ version: 1 }],
    });

    const result = await TemplateService.create({
      organisationId,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP note",
      scope: "ORGANISATION",
      schemaSnapshot: {
        sections: soapSnapshot.sections,
      },
      createdBy: "creator-1",
    });

    expect(mockedPrisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId,
          kind: "SOAP_NOTE",
          latestVersion: 1,
          status: "DRAFT",
        }),
      }),
    );
    expect(mockedPrisma.templateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          version: 1,
        }),
      }),
    );
    expect(result.id).toBe(templateId);
  });

  it("creates a YC library template without organisation ownership", async () => {
    mockedPrisma.template.create.mockResolvedValueOnce({
      id: templateId,
      organisationId: null,
      ownerUserId: null,
      ownership: "YC_LIBRARY",
      latestVersion: 1,
      publishedVersion: null,
      status: "DRAFT",
    });
    mockedPrisma.template.findUnique.mockResolvedValueOnce({
      id: templateId,
      organisationId: null,
      ownerUserId: null,
      ownership: "YC_LIBRARY",
      kind: "SOAP_NOTE",
      name: "YC SOAP note",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: null,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [{ version: 1 }],
    });

    const result = await TemplateService.create({
      ownership: "YC_LIBRARY",
      kind: "SOAP_NOTE",
      name: "YC SOAP note",
      scope: "ORGANISATION",
      schemaSnapshot: soapSnapshot,
      createdBy: "creator-1",
    });

    expect(mockedPrisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: undefined,
          ownership: "YC_LIBRARY",
        }),
      }),
    );
    expect(result.id).toBe(templateId);
  });

  it("rejects a user-owned template without owner metadata", async () => {
    await expect(
      TemplateService.create({
        organisationId,
        ownership: "USER_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "User SOAP note",
        scope: "ORGANISATION",
        schemaSnapshot: soapSnapshot,
        createdBy: "creator-1",
      }),
    ).rejects.toThrow("Owner user is required for user templates");
  });

  it("rejects a clinical template schema missing required sections", async () => {
    await expect(
      TemplateService.create({
        organisationId,
        ownership: "ORG_TEMPLATE",
        kind: "PRESCRIPTION",
        name: "Prescription template",
        scope: "ORGANISATION",
        schemaSnapshot: {
          sections: [],
        },
        createdBy: "creator-1",
      }),
    ).rejects.toThrow(
      "Template schema is invalid for PRESCRIPTION: missing sections: medications, instructions, notes",
    );
  });

  it("rejects a clinical template schema with an invalid field type", async () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");
    const instructionsSection = snapshot.sections.find(
      (section) => section.id === "instructions",
    );

    if (!instructionsSection) {
      throw new Error("Missing instructions section");
    }

    instructionsSection.fields[0] = {
      ...instructionsSection.fields[0],
      type: "text",
    };

    await expect(
      TemplateService.create({
        organisationId,
        ownership: "ORG_TEMPLATE",
        kind: "PRESCRIPTION",
        name: "Prescription template",
        scope: "ORGANISATION",
        schemaSnapshot: snapshot,
        createdBy: "creator-1",
      }),
    ).rejects.toThrow(
      "Template schema is invalid for PRESCRIPTION: invalid fields: PRESCRIPTION.instructions.usageInstructions.type",
    );
  });

  it("rejects a care pathway schema missing required sections", async () => {
    const snapshot = buildTaskWorkflowTemplateSchemaSnapshot("CARE_PATHWAY");
    snapshot.sections = snapshot.sections.filter(
      (section) => section.id !== "schedule",
    );

    await expect(
      TemplateService.create({
        organisationId,
        ownership: "ORG_TEMPLATE",
        kind: "CARE_PATHWAY",
        name: "Inpatient pathway",
        scope: "INPATIENT",
        schemaSnapshot: snapshot,
        createdBy: "creator-1",
      }),
    ).rejects.toThrow(
      "Template schema is invalid for CARE_PATHWAY: missing sections: schedule",
    );
  });

  it("lists YC library templates", async () => {
    mockedPrisma.template.findMany.mockResolvedValueOnce([
      {
        id: "library-1",
        ownership: "YC_LIBRARY",
        organisationId: null,
        ownerUserId: null,
        kind: "SOAP_NOTE",
        name: "YC SOAP",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: "yc-admin",
        updatedBy: "yc-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      },
    ]);

    const result = await TemplateService.listLibrary({ kind: "SOAP_NOTE" });

    expect(mockedPrisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownership: "YC_LIBRARY",
          kind: "SOAP_NOTE",
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("lists organisation templates", async () => {
    mockedPrisma.template.findMany.mockResolvedValueOnce([
      {
        id: "org-1",
        ownership: "ORG_TEMPLATE",
        organisationId,
        ownerUserId: null,
        kind: "SOAP_NOTE",
        name: "Org SOAP",
        description: null,
        status: "DRAFT",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 1,
        publishedVersion: null,
        createdBy: "creator-1",
        updatedBy: "creator-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      },
    ]);

    const result = await TemplateService.listForOrganisation(organisationId, {
      status: "DRAFT",
    });

    expect(mockedPrisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId,
          ownership: "ORG_TEMPLATE",
          status: "DRAFT",
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("lists user templates", async () => {
    mockedPrisma.template.findMany.mockResolvedValueOnce([
      {
        id: "user-1",
        ownership: "USER_TEMPLATE",
        organisationId,
        ownerUserId: "user-1",
        kind: "SOAP_NOTE",
        name: "My SOAP",
        description: null,
        status: "DRAFT",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 1,
        publishedVersion: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      },
    ]);

    const result = await TemplateService.listForUser(organisationId, "user-1", {
      scope: "ORGANISATION",
    });

    expect(mockedPrisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId,
          ownerUserId: "user-1",
          ownership: "USER_TEMPLATE",
          scope: "ORGANISATION",
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("resolves a linked user template before organisation defaults", async () => {
    const versionId = "ver-1";
    mockedPrisma.template.findMany.mockResolvedValueOnce([
      {
        id: "user-template-1",
        ownership: "USER_TEMPLATE",
        organisationId,
        ownerUserId: "user-1",
        kind: "SOAP_NOTE",
        name: "User SOAP",
        description: null,
        status: "PUBLISHED",
        scope: "SERVICE",
        rules: {
          appliesTo: {
            serviceIds: ["svc-1"],
          },
        },
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [
          {
            id: versionId,
            version: 1,
            schemaSnapshot: {
              sections: [],
            },
            renderConfigSnapshot: { layout: "single-column" },
            validationSnapshot: { allowEmptyPlan: false },
            publishedAt: new Date(),
            createdBy: "user-1",
          },
        ],
        catalogLinks: [],
      },
    ]);
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: versionId,
      templateId: "user-template-1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: { layout: "single-column" },
      validationSnapshot: { allowEmptyPlan: false },
      publishedAt: new Date(),
      createdBy: "user-1",
    });

    const result = await TemplateService.resolve({
      organisationId,
      kind: "SOAP_NOTE",
      serviceId: "svc-1",
      ownerUserId: "user-1",
    });

    expect(mockedPrisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId,
          ownerUserId: "user-1",
          ownership: "USER_TEMPLATE",
          kind: "SOAP_NOTE",
        }),
      }),
    );
    expect(mockedPrisma.templateVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateId_version: {
            templateId: "user-template-1",
            version: 1,
          },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        templateId: "user-template-1",
        templateVersion: 1,
        templateVersionId: versionId,
        source: "USER",
        ownerUserId: "user-1",
        kind: "SOAP_NOTE",
        reason: "Matched user template linked to service/species/mode.",
      }),
    );
  });

  it("falls back to the organisation default template and reports not found when no match exists", async () => {
    mockedPrisma.template.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "org-default-1",
          ownership: "ORG_TEMPLATE",
          organisationId,
          ownerUserId: null,
          kind: "SOAP_NOTE",
          name: "Org default SOAP",
          description: null,
          status: "PUBLISHED",
          scope: "ORGANISATION",
          rules: {
            appliesTo: {
              defaultForKind: true,
            },
          },
          latestVersion: 1,
          publishedVersion: 1,
          createdBy: "creator-1",
          updatedBy: "creator-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          versions: [
            {
              id: "org-default-version-1",
              version: 1,
              schemaSnapshot: {
                sections: [],
              },
              renderConfigSnapshot: {},
              validationSnapshot: {},
              publishedAt: new Date(),
              createdBy: "creator-1",
            },
          ],
          catalogLinks: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "org-default-1",
          ownership: "ORG_TEMPLATE",
          organisationId,
          ownerUserId: null,
          kind: "SOAP_NOTE",
          name: "Org default SOAP",
          description: null,
          status: "PUBLISHED",
          scope: "ORGANISATION",
          rules: {
            appliesTo: {
              defaultForKind: true,
            },
          },
          latestVersion: 1,
          publishedVersion: 1,
          createdBy: "creator-1",
          updatedBy: "creator-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          versions: [
            {
              id: "org-default-version-1",
              version: 1,
              schemaSnapshot: {
                sections: [],
              },
              renderConfigSnapshot: {},
              validationSnapshot: {},
              publishedAt: new Date(),
              createdBy: "creator-1",
            },
          ],
          catalogLinks: [],
        },
      ])
      .mockResolvedValueOnce([]);
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "org-default-version-1",
      templateId: "org-default-1",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "creator-1",
    });

    await expect(
      TemplateService.resolve({
        organisationId,
        kind: "SOAP_NOTE",
        ownerUserId: "user-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        templateId: "org-default-1",
        source: "ORGANISATION",
        reason: "Matched organisation default template for kind (default).",
      }),
    );
  });

  it("throws when no resolver candidate is available", async () => {
    mockedPrisma.template.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      TemplateService.resolve({
        organisationId,
        kind: "SOAP_NOTE",
        ownerUserId: "user-1",
      }),
    ).rejects.toThrow("Template not found");
  });

  it("creates a new version when updating a published template", async () => {
    mockedPrisma.template.findUnique
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        ownerUserId: null,
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "creator-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        ownerUserId: null,
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "SOAP note updated",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "editor-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [{ version: 2 }],
      });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-1",
      templateId,
      version: 1,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "creator-1",
    });

    await TemplateService.update(
      templateId,
      {
        name: "SOAP note updated",
        schemaSnapshot: soapSnapshot,
        updatedBy: "editor-1",
      },
      organisationId,
    );

    expect(mockedPrisma.templateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          version: 2,
          createdBy: "editor-1",
        }),
      }),
    );
    expect(mockedPrisma.template.update).toHaveBeenCalled();
  });

  it("publishes the latest version", async () => {
    mockedPrisma.template.findUnique
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        ownerUserId: null,
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "DRAFT",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 1,
        createdBy: "creator-1",
        updatedBy: "creator-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: templateId,
        organisationId,
        ownerUserId: null,
        ownership: "ORG_TEMPLATE",
        kind: "SOAP_NOTE",
        name: "SOAP note",
        description: null,
        status: "PUBLISHED",
        scope: "ORGANISATION",
        rules: null,
        latestVersion: 2,
        publishedVersion: 2,
        createdBy: "creator-1",
        updatedBy: "publisher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [{ version: 2 }],
      });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-2",
      templateId,
      version: 2,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: null,
      createdBy: "creator-1",
    });

    await TemplateService.publish(templateId, "publisher-1", organisationId);

    expect(mockedPrisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedVersion: 2,
          updatedBy: "publisher-1",
        }),
      }),
    );
    expect(mockedPrisma.templateVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ver-2" },
      }),
    );
  });

  it("updates catalog links from the template side", async () => {
    const baseTemplate = {
      id: templateId,
      organisationId,
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP note",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: null,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [{ version: 1 }],
      catalogLinks: [],
    };

    mockedPrisma.template.findUnique
      .mockResolvedValueOnce(baseTemplate)
      .mockResolvedValueOnce({
        ...baseTemplate,
        catalogLinks: [{ catalogItemId: "svc-1" }, { catalogItemId: "pkg-1" }],
      });
    mockedPrisma.productItem.findMany.mockResolvedValueOnce([
      { id: "svc-1" },
      { id: "pkg-1" },
    ]);
    mockedPrisma.templateCatalogLink.findMany.mockResolvedValueOnce([]);

    const result = await TemplateService.updateCatalogLinks(
      templateId,
      { catalogItemIds: ["svc-1", "pkg-1"] },
      organisationId,
    );

    expect(mockedPrisma.productItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["svc-1", "pkg-1"] },
          organisationId,
        }),
      }),
    );
    expect(mockedPrisma.templateCatalogLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId },
      }),
    );
    expect(mockedPrisma.templateCatalogLink.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { templateId, catalogItemId: "svc-1" },
          { templateId, catalogItemId: "pkg-1" },
        ],
      }),
    );
    expect(result.catalogItemIds).toEqual(["svc-1", "pkg-1"]);
  });

  it("creates an instance from the published version", async () => {
    mockedPrisma.template.findUnique.mockResolvedValueOnce({
      id: templateId,
      organisationId,
      kind: "SOAP_NOTE",
      name: "SOAP note",
      description: null,
      status: "PUBLISHED",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 2,
      publishedVersion: 2,
      createdBy: "creator-1",
      updatedBy: "creator-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "ver-2",
      templateId,
      version: 2,
      schemaSnapshot: {},
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "creator-1",
    });
    mockedPrisma.templateInstance.create.mockResolvedValueOnce({
      id: instanceId,
      templateId,
      templateVersion: 2,
      organisationId,
      status: "DRAFT",
      data: {},
    });

    const result = await TemplateService.createInstance({
      templateId,
      organisationId,
      appointmentId: "appt-1",
      authorId: "user-1",
      data: {
        temperature: 38.4,
      },
    });

    expect(mockedPrisma.templateInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId,
          templateVersion: 2,
          organisationId,
          appointmentId: "appt-1",
          authorId: "user-1",
        }),
      }),
    );
    expect(result.id).toBe(instanceId);
  });

  it("rejects instance updates when the organisation does not match", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: instanceId,
      organisationId: "other-org",
      templateId,
      templateVersion: 1,
      status: "DRAFT",
      data: {},
    });

    await expect(
      TemplateService.updateInstance(
        instanceId,
        { data: { temperature: 39 } },
        organisationId,
      ),
    ).rejects.toBeInstanceOf(TemplateServiceError);
  });

  it("throws when submitting a missing instance", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce(null);

    await expect(
      TemplateService.submitInstance(instanceId, organisationId),
    ).rejects.toThrow("Template instance not found");
  });

  it("materializes task workflow seeds when submitting a task template instance", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: instanceId,
      templateId,
      templateVersion: 1,
      organisationId,
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      status: "DRAFT",
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Morning medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 45,
            },
          },
        ],
      },
      authorId: "user-1",
      signedBy: null,
      signedAt: null,
      generatedPdfUrl: null,
      generatedPdf: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
      template: {
        id: templateId,
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      companion: {
        id: "comp-1",
        parent: { id: "parent-1" },
      },
      lead: { id: "user-2" },
      supportStaff: [{ id: "user-3" }],
      startTime: new Date("2026-01-01T08:00:00.000Z"),
      encounterId: null,
    });
    mockedPrisma.templateInstance.update.mockResolvedValueOnce({
      id: instanceId,
      status: "COMPLETED",
    });
    mockedTaskWorkflowService.launchFromTemplateInstance.mockResolvedValueOnce({
      schedule: { id: "schedule-1" },
      taskIds: ["task-1"],
      seedCount: 1,
    });

    const result = await TemplateService.submitInstance(
      instanceId,
      organisationId,
      "user-9",
    );

    expect(
      mockedTaskWorkflowService.launchFromTemplateInstance,
    ).toHaveBeenCalledWith(
      instanceId,
      organisationId,
      "user-9",
      expect.objectContaining({
        client: prisma,
        notify: true,
      }),
    );
    expect(mockedPrisma.templateInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: instanceId },
        data: expect.objectContaining({
          status: "COMPLETED",
        }),
      }),
    );
    expect(mockedPrisma.renderedDocument.create).not.toHaveBeenCalled();
    expect(result.status).toBe("COMPLETED");
  });

  it("creates a rendered document draft when submitting a document-backed template instance", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: instanceId,
      templateId,
      templateVersion: 2,
      organisationId,
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      status: "DRAFT",
      data: { chiefComplaint: "Coughing" },
      authorId: "user-1",
      signedBy: null,
      signedAt: null,
      generatedPdfUrl: null,
      generatedPdf: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
      template: {
        id: templateId,
        kind: "SOAP_NOTE",
        ownership: "ORG_TEMPLATE",
      },
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: instanceId,
      templateInstanceId: instanceId,
      clinicalArtifactId: null,
      templateId,
      templateVersion: 2,
      templateVersionId: null,
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP NOTE",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.templateInstance.update.mockResolvedValueOnce({
      id: instanceId,
      status: "COMPLETED",
      generatedPdf: {
        renderedDocumentId: "doc-1",
        sourceKind: "TEMPLATE_INSTANCE",
        sourceId: instanceId,
        kind: "SOAP_NOTE",
        version: 1,
        status: "DRAFT",
        signable: true,
        mimeType: "application/pdf",
        signedAt: null,
        signedBy: null,
      },
      generatedPdfUrl: null,
    });
    mockedTaskWorkflowService.launchFromTemplateInstance.mockResolvedValueOnce({
      schedule: { id: "schedule-1" },
      taskIds: [],
      seedCount: 0,
    });

    const result = await TemplateService.submitInstance(
      instanceId,
      organisationId,
      "user-9",
    );

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateInstanceId: instanceId,
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: instanceId,
          kind: "SOAP_NOTE",
          title: "SOAP NOTE",
          signable: true,
        }),
      }),
    );
    expect(result.generatedPdf).toEqual(
      expect.objectContaining({
        renderedDocumentId: "doc-1",
        kind: "SOAP_NOTE",
        sourceId: instanceId,
      }),
    );
  });
});
