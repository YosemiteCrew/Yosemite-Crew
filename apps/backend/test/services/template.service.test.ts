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
});
