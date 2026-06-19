import {
  templateMapper,
  type TemplateLike,
  type TemplateInstanceLike,
} from "../../src/services/fhir-template.mapper";

describe("fhir-template.mapper", () => {
  const template = {
    id: "template-1",
    organisationId: "org-1",
    ownerUserId: null,
    ownership: "ORG_TEMPLATE",
    kind: "SOAP_NOTE",
    name: "SOAP Note",
    description: "Clinical SOAP note",
    status: "PUBLISHED",
    scope: "ORGANISATION",
    rules: null,
    latestVersion: 1,
    publishedVersion: 1,
    createdBy: "user-1",
    updatedBy: "user-2",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    versions: [
      {
        id: "version-1",
        version: 1,
        schemaSnapshot: {
          sections: [
            {
              id: "subjective",
              title: "Subjective",
              fields: [
                {
                  key: "chiefComplaint",
                  label: "Chief complaint",
                  type: "text",
                },
              ],
            },
          ],
        },
        renderConfigSnapshot: { layout: "single-column" },
        validationSnapshot: { required: ["subjective"] },
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      },
    ],
  } as TemplateLike;

  it("renders questionnaire templates as FHIR Questionnaire resources", () => {
    const questionnaire = templateMapper.templateToQuestionnaire(template);

    expect(questionnaire.resourceType).toBe("Questionnaire");
    expect(questionnaire.id).toBe("template-1");
    expect(questionnaire.title).toBe("SOAP Note");
    expect(questionnaire.code?.[0]?.code).toBe("SOAP_NOTE");
    expect(questionnaire.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://yosemitecrew.com/fhir/StructureDefinition/template-kind",
          valueString: "SOAP_NOTE",
        }),
      ]),
    );
    expect(questionnaire.item?.[0]?.linkId).toBe("subjective");
    expect(questionnaire.item?.[0]?.item?.[0]?.linkId).toBe("chiefComplaint");
  });

  it("renders workflow templates as FHIR PlanDefinition resources", () => {
    const planTemplate = {
      ...template,
      kind: "INPATIENT_SCHEDULE",
      name: "Inpatient Pathway",
    } as TemplateLike;

    const planDefinition =
      templateMapper.templateToPlanDefinition(planTemplate);

    expect(planDefinition.resourceType).toBe("PlanDefinition");
    expect(planDefinition.id).toBe("template-1");
    expect(planDefinition.type?.coding?.[0]?.code).toBe("INPATIENT_SCHEDULE");
    expect(planDefinition.action?.[0]?.id).toBe("subjective");
  });

  it("can convert QuestionnaireResponse instances back to FHIR QuestionnaireResponse", () => {
    const instance = {
      id: "instance-1",
      templateId: "template-1",
      templateVersion: 1,
      organisationId: "org-1",
      status: "COMPLETED",
      data: { chiefComplaint: "Cough" },
      authorId: "user-1",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    } as TemplateInstanceLike;

    const questionnaireResponse =
      templateMapper.templateInstanceToQuestionnaireResponse(
        instance,
        template,
      );

    expect(questionnaireResponse.resourceType).toBe("QuestionnaireResponse");
    expect(questionnaireResponse.questionnaire).toBe(
      "Questionnaire/template-1",
    );
    expect(questionnaireResponse.status).toBe("completed");
    expect(
      questionnaireResponse.item?.[0]?.item?.[0]?.answer?.[0]?.valueString,
    ).toBe("Cough");
  });

  it("parses Questionnaire payloads back into template input", () => {
    const questionnaire = templateMapper.templateToQuestionnaire(template);
    const input = templateMapper.questionnaireToTemplateInput(questionnaire, {
      createdBy: "user-1",
      updatedBy: "user-2",
    });

    expect(input.kind).toBe("SOAP_NOTE");
    expect(input.schemaSnapshot.sections[0].id).toBe("subjective");
    expect(input.renderConfigSnapshot).toEqual({ layout: "single-column" });
  });
});
