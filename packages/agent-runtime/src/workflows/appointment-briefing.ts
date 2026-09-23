import { malformed } from '../workflow.js';
import type { WorkflowDefinition } from '../workflow.js';
import type {
  BriefingResult,
  BriefingSection,
  RunContext,
  SectionState,
  SourceReference,
  ToolSchema,
} from '../types.js';

export const APPOINTMENT_BRIEFING_ID = 'appointment-briefing';

export const appointmentBriefingTools: readonly ToolSchema[] = [
  {
    name: 'appointment.read',
    description: 'Read one scheduled appointment the actor may already see.',
    input: { appointmentId: 'string' },
    requiredPermission: 'appointment:read',
  },
  {
    name: 'patient.history.read',
    description: 'Read the companion clinical history for that appointment.',
    input: { appointmentId: 'string' },
    requiredPermission: 'patient:read',
  },
];

const SECTION_STATES: readonly SectionState[] = [
  'known',
  'not-applicable',
  'unavailable',
  'unknown',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readSource = (value: unknown, where: string): SourceReference => {
  if (!isRecord(value)) {
    throw malformed(`${where} source is not an object`);
  }
  const { kind, id, version } = value;
  if (typeof kind !== 'string' || typeof id !== 'string' || typeof version !== 'string') {
    throw malformed(`${where} source is missing kind, id or version`);
  }
  return { kind, id, version };
};

const readSection = (value: unknown, index: number): BriefingSection => {
  const where = `section ${index}`;
  if (!isRecord(value)) {
    throw malformed(`${where} is not an object`);
  }
  const { heading, state, body, sources } = value;
  if (typeof heading !== 'string' || heading.trim() === '') {
    throw malformed(`${where} has no heading`);
  }
  if (typeof state !== 'string' || !SECTION_STATES.includes(state as SectionState)) {
    throw malformed(`${where} has an unrecognised state`);
  }
  if (body !== null && typeof body !== 'string') {
    throw malformed(`${where} body must be text or null`);
  }
  if (!Array.isArray(sources)) {
    throw malformed(`${where} has no source list`);
  }
  const read = sources.map((source) => readSource(source, where));
  // Content a clinician may act on has to be traceable. An empty source list is
  // only allowed where the section states it has nothing to report.
  if (state === 'known' && read.length === 0) {
    throw malformed(`${where} states a finding with no source`);
  }
  return { heading, state: state as SectionState, body: body ?? null, sources: read };
};

export const createAppointmentBriefingWorkflow = (
  refreshSources: (
    input: Readonly<Record<string, unknown>>,
    ctx: RunContext
  ) => Promise<readonly SourceReference[]>
): WorkflowDefinition<BriefingResult> => ({
  id: APPOINTMENT_BRIEFING_ID,
  instructions:
    'Summarise one upcoming appointment for the attending practice. Use only the ' +
    'supplied tools. Mark anything you cannot read as unavailable, anything absent ' +
    'from the record as unknown, and anything the species or visit type rules out ' +
    'as not-applicable. Never state a finding without its source.',
  tools: appointmentBriefingTools,

  validateResult(output: unknown): BriefingResult {
    if (!isRecord(output)) {
      throw malformed('result is not an object');
    }
    const { appointmentId, sections } = output;
    if (typeof appointmentId !== 'string' || appointmentId.trim() === '') {
      throw malformed('result has no appointmentId');
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      throw malformed('result has no sections');
    }
    return { appointmentId, sections: sections.map(readSection) };
  },

  refreshSources,
});
