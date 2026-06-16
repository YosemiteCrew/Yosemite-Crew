import type {
  CodeableConcept,
  Extension,
  Parameters,
  Reference,
  Task,
  TaskOutput,
} from '@yosemite-crew/fhir';

export type TaskScheduleStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type TaskScheduleLike = {
  id: string;
  templateInstanceId: string;
  templateId: string;
  templateVersion: number;
  templateKind: string;
  organisationId: string;
  createdBy: string;
  activatedBy: string | null;
  activatedAt: Date | null;
  status: TaskScheduleStatus | string;
  scheduleInput: unknown;
  materializedSeeds: unknown;
  generatedTaskIds: unknown;
  completedAt: Date | null;
  lastMaterializedAt: Date | null;
  metadata: unknown;
};

const TASK_SCHEDULE_TEMPLATE_INSTANCE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-template-instance';
const TASK_SCHEDULE_TEMPLATE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-template';
const TASK_SCHEDULE_TEMPLATE_VERSION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-template-version';
const TASK_SCHEDULE_TEMPLATE_KIND_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-template-kind';
const TASK_SCHEDULE_ORGANISATION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-organisation';
const TASK_SCHEDULE_CREATED_BY_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-created-by';
const TASK_SCHEDULE_ACTIVATED_BY_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-activated-by';
const TASK_SCHEDULE_ACTIVATED_AT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-activated-at';
const TASK_SCHEDULE_COMPLETED_AT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-completed-at';
const TASK_SCHEDULE_SCHEDULE_INPUT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-input';
const TASK_SCHEDULE_MATERIALIZED_SEEDS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-materialized-seeds';
const TASK_SCHEDULE_GENERATED_TASK_IDS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-generated-task-ids';
const TASK_SCHEDULE_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-schedule-metadata';

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const toTaskStatus = (status: string): Task['status'] => {
  switch (status) {
    case 'ACTIVE':
      return 'accepted';
    case 'COMPLETED':
      return 'completed';
    case 'PAUSED':
      return 'on-hold';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'draft';
  }
};

const toCodeableConcept = (code: string, display: string): CodeableConcept => ({
  coding: [
    {
      system: 'https://yosemitecrew.com/fhir/CodeSystem/task-schedule',
      code,
      display,
    },
  ],
  text: display,
});

const buildExtension = (url: string, value: unknown): Extension | null => {
  if (value === undefined) return null;
  if (value === null) return { url, valueString: 'null' };
  if (typeof value === 'string') return { url, valueString: value };
  return { url, valueString: JSON.stringify(value) };
};

const buildExtensions = (schedule: TaskScheduleLike): Extension[] =>
  [
    buildExtension(TASK_SCHEDULE_TEMPLATE_INSTANCE_EXTENSION_URL, schedule.templateInstanceId),
    buildExtension(TASK_SCHEDULE_TEMPLATE_EXTENSION_URL, schedule.templateId),
    buildExtension(TASK_SCHEDULE_TEMPLATE_VERSION_EXTENSION_URL, schedule.templateVersion),
    buildExtension(TASK_SCHEDULE_TEMPLATE_KIND_EXTENSION_URL, schedule.templateKind),
    buildExtension(TASK_SCHEDULE_ORGANISATION_EXTENSION_URL, schedule.organisationId),
    buildExtension(TASK_SCHEDULE_CREATED_BY_EXTENSION_URL, schedule.createdBy),
    buildExtension(TASK_SCHEDULE_ACTIVATED_BY_EXTENSION_URL, schedule.activatedBy),
    buildExtension(TASK_SCHEDULE_ACTIVATED_AT_EXTENSION_URL, toIso(schedule.activatedAt)),
    buildExtension(TASK_SCHEDULE_COMPLETED_AT_EXTENSION_URL, toIso(schedule.completedAt)),
    buildExtension(TASK_SCHEDULE_SCHEDULE_INPUT_EXTENSION_URL, schedule.scheduleInput),
    buildExtension(TASK_SCHEDULE_MATERIALIZED_SEEDS_EXTENSION_URL, schedule.materializedSeeds),
    buildExtension(TASK_SCHEDULE_GENERATED_TASK_IDS_EXTENSION_URL, schedule.generatedTaskIds),
    buildExtension(TASK_SCHEDULE_METADATA_EXTENSION_URL, schedule.metadata),
  ].filter((extension): extension is Extension => extension !== null);

const buildOutputs = (generatedTaskIds: string[]): TaskOutput[] =>
  generatedTaskIds.map(
    (taskId) =>
      ({
        type: toCodeableConcept('generated-task', 'Generated task'),
        valueReference: { reference: `Task/${taskId}` } as Reference,
      }) as unknown as TaskOutput
  );

const toTask = (schedule: TaskScheduleLike, generatedTaskIds: string[] = []): Task => ({
  resourceType: 'Task',
  id: schedule.id,
  status: toTaskStatus(schedule.status),
  intent: 'order',
  description: `${schedule.templateKind.replace(/_/g, ' ').toLowerCase()} schedule`,
  authoredOn: toIso(schedule.lastMaterializedAt ?? schedule.activatedAt),
  lastModified: toIso(schedule.completedAt ?? schedule.lastMaterializedAt),
  focus: {
    reference: `PlanDefinition/${schedule.templateId}`,
  },
  basedOn: [
    {
      reference: `Task/${schedule.templateInstanceId}`,
    },
  ],
  output: buildOutputs(
    generatedTaskIds.length
      ? generatedTaskIds
      : Array.isArray(schedule.generatedTaskIds)
        ? schedule.generatedTaskIds.filter((taskId): taskId is string => typeof taskId === 'string')
        : []
  ),
  extension: buildExtensions(schedule),
});

const getBooleanParameter = (parameters: Parameters | undefined, name: string) =>
  parameters?.parameter?.find((parameter) => parameter.name === name)?.valueBoolean;

const getDateParameter = (parameters: Parameters | undefined, name: string) => {
  const value = parameters?.parameter?.find((parameter) => parameter.name === name)?.valueDateTime;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const taskScheduleFhirMapper = {
  toTask,
  getBooleanParameter,
  getDateParameter,
};
