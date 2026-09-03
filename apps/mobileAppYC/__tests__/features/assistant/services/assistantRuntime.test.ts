/**
 * Tests for the assistant turn loop.
 *
 * The loop's whole value is its ordering: rules first, model only as a rescue,
 * resolvers always, rephrasing only over a sentence that is already true. Each
 * test here drives the real parser and the real resolvers with a fixed clock
 * and fakes only the on-device model, so an assertion about the reply is an
 * assertion about the sentence a user would actually hear.
 */
import type {TFunction} from 'i18next';
import {
  buildActionDescriptions,
  runTurn,
} from '@/features/assistant/services/assistantRuntime';
import {classify, rephrase} from '@/features/assistant/services/onDeviceModel';
import {parseUtterance} from '@/features/assistant/nlu/parser';
import {runAction} from '@/features/assistant/actions/resolvers';
import {
  BARE_NAME_CONFIDENCE,
  MAX_UTTERANCE_LENGTH,
  RULES_CONFIDENCE_THRESHOLD,
} from '@/features/assistant/constants';
import type {
  AssistantContext,
  AssistantIntent,
} from '@/features/assistant/types';
import type {Companion} from '@/features/companion/types';
import type {Task} from '@/features/tasks/types';
import type {Appointment} from '@/features/appointments/types';
import type {Expense} from '@/features/expenses/types';

jest.mock('@/features/assistant/services/onDeviceModel', () => ({
  classify: jest.fn(),
  rephrase: jest.fn(),
}));

// The parser and the resolvers run for real; they are only wrapped so the test
// can assert what the loop handed them, and so a test can pin a confidence the
// live rules never emit - such as one sitting exactly on the threshold.
jest.mock('@/features/assistant/nlu/parser', () => {
  const actual = jest.requireActual('@/features/assistant/nlu/parser');
  return {...actual, parseUtterance: jest.fn()};
});

jest.mock('@/features/assistant/actions/resolvers', () => {
  const actual = jest.requireActual('@/features/assistant/actions/resolvers');
  return {...actual, runAction: jest.fn()};
});

const realParseUtterance = jest.requireActual<
  typeof import('@/features/assistant/nlu/parser')
>('@/features/assistant/nlu/parser').parseUtterance;
const realRunAction = jest.requireActual<
  typeof import('@/features/assistant/actions/resolvers')
>('@/features/assistant/actions/resolvers').runAction;

const classifyMock = classify as jest.MockedFunction<typeof classify>;
const rephraseMock = rephrase as jest.MockedFunction<typeof rephrase>;
const parseUtteranceMock = parseUtterance as jest.MockedFunction<
  typeof parseUtterance
>;
const runActionMock = runAction as jest.MockedFunction<typeof runAction>;

/**
 * A translator that renders the key plus its params, so an assertion on the
 * reply pins both which sentence was chosen and the facts it was given.
 */
const fakeT = ((key: string, params?: Record<string, unknown>) =>
  params === undefined
    ? key
    : `${key}|${JSON.stringify(params)}`) as unknown as TFunction;

const factory =
  <T>(defaults: T) =>
  (overrides: Partial<T> = {}): T => ({...defaults, ...overrides});

const makeCompanion = factory<Companion>({
  id: 'c1',
  name: 'Bruno',
  category: 'dog',
  speciesCode: null,
  breed: null,
  breedCode: null,
  dateOfBirth: null,
  gender: 'male',
  currentWeight: null,
  color: null,
  allergies: null,
  neuteredStatus: 'neutered',
  ageWhenNeutered: null,
  bloodGroup: null,
  microchipNumber: null,
  passportNumber: null,
  insuredStatus: 'not-insured',
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: null,
  origin: 'unknown',
  profileImage: null,
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const makeTask = factory<Task>({
  id: 't1',
  companionId: 'c1',
  category: 'custom',
  title: 'Care task',
  date: '2026-09-11',
  frequency: 'once',
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  attachDocuments: false,
  attachments: [],
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  details: {},
});

const makeAppointment = factory<Appointment>({
  id: 'a1',
  companionId: 'c1',
  businessId: 'b1',
  date: '2026-09-12',
  time: '09:00',
  // A full timestamp keeps the rendered day identical in every timezone.
  start: '2026-09-12T09:00:00.000Z',
  type: 'consultation',
  status: 'CONFIRMED',
  organisationName: 'Willow Vets',
  serviceName: 'Checkup',
});

const makeExpense = factory<Expense>({
  id: 'e1',
  companionId: 'c1',
  title: 'Vet visit',
  category: 'health',
  subcategory: 'consultation',
  visitType: 'clinic',
  amount: 40,
  currencyCode: 'EUR',
  status: 'PAID',
  source: 'inApp',
  date: '2026-09-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attachments: [],
});

/** Fixed clock. Midday UTC keeps every asserted ISO day stable under any TZ. */
const NOW = new Date('2026-09-10T12:00:00.000Z');

const BRUNO = makeCompanion({id: 'c1', name: 'Bruno'});
const LUNA = makeCompanion({id: 'c2', name: 'Luna'});

const makeContext = factory<AssistantContext>({
  companions: [BRUNO, LUNA],
  tasks: [],
  appointments: [makeAppointment()],
  expenses: [],
  vaccinations: {},
  now: NOW,
  currencyCode: 'EUR',
});

/** The catalogue exactly as the model is shown it. */
const EXPECTED_DESCRIPTIONS = [
  'nextAppointment: assistant.actions.nextAppointment.description',
  'vaccinationStatus: assistant.actions.vaccinationStatus.description',
  'upcomingTasks: assistant.actions.upcomingTasks.description',
  'petOverview: assistant.actions.petOverview.description',
  'expenseSummary: assistant.actions.expenseSummary.description',
  'addCareTask: assistant.actions.addCareTask.description',
  'logExpense: assistant.actions.logExpense.description',
  'bookAppointment: assistant.actions.bookAppointment.description',
].join('\n');

const modelGuess = (
  overrides: Partial<AssistantIntent> = {},
): AssistantIntent => ({
  actionId: 'petOverview',
  slots: {},
  confidence: 0.5,
  source: 'model',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  parseUtteranceMock.mockImplementation(realParseUtterance);
  runActionMock.mockImplementation(realRunAction);
  classifyMock.mockResolvedValue(null);
  rephraseMock.mockImplementation(async sentence => `warmer: ${sentence}`);
});

describe('buildActionDescriptions', () => {
  it('renders every catalogue action as "id: description", in catalogue order', () => {
    expect(buildActionDescriptions(fakeT)).toBe(EXPECTED_DESCRIPTIONS);
  });

  it('translates the description key rather than printing it raw', () => {
    const lookup = {
      'assistant.actions.nextAppointment.description':
        'When the next vet visit is',
      'assistant.actions.petOverview.description': 'A summary of one pet',
    } as Record<string, string>;
    const translating = ((key: string) => lookup[key] ?? key) as TFunction;

    const lines = buildActionDescriptions(translating).split('\n');

    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe('nextAppointment: When the next vet visit is');
    expect(lines[3]).toBe('petOverview: A summary of one pet');
  });
});

describe('runTurn: an utterance with no words', () => {
  it('answers with the empty reply and never reaches a resolver', async () => {
    const turn = await runTurn('', makeContext(), fakeT);

    expect(turn).toEqual({
      intent: null,
      result: null,
      text: 'assistant.replies.empty',
    });
    expect(runActionMock).not.toHaveBeenCalled();
    expect(parseUtteranceMock).not.toHaveBeenCalled();
    expect(classifyMock).not.toHaveBeenCalled();
    expect(rephraseMock).not.toHaveBeenCalled();
  });

  it('treats whitespace and newlines as empty rather than parsing them', async () => {
    const turn = await runTurn('  \n\t  ', makeContext(), fakeT);

    expect(turn.text).toBe('assistant.replies.empty');
    expect(turn.intent).toBeNull();
    expect(runActionMock).not.toHaveBeenCalled();
  });
});

describe('runTurn: the rules routed it confidently', () => {
  it('answers from the resolver without consulting the model', async () => {
    const turn = await runTurn(
      'when is my next appointment',
      makeContext(),
      fakeT,
    );

    expect(classifyMock).not.toHaveBeenCalled();
    expect(parseUtteranceMock).toHaveBeenCalledTimes(1);
    expect(parseUtteranceMock).toHaveBeenCalledWith(
      'when is my next appointment',
      {petNames: ['Bruno', 'Luna'], now: NOW},
    );
    expect(turn.intent).toEqual({
      actionId: 'nextAppointment',
      slots: {},
      confidence: 0.87,
      source: 'rules',
    });
    expect(turn.result?.speechKey).toBe(
      'assistant.replies.nextAppointment.found',
    );
    expect(turn.result?.speechParams).toEqual({
      petName: 'Bruno',
      date: '2026-09-12',
      time: '09:00',
      business: 'Willow Vets',
    });
    expect(turn.text).toBe(
      'warmer: assistant.replies.nextAppointment.found|' +
        '{"petName":"Bruno","date":"2026-09-12","time":"09:00","business":"Willow Vets"}',
    );
  });

  it('keeps the rules answer when confidence sits exactly on the threshold', async () => {
    // The guard is `confidence < RULES_CONFIDENCE_THRESHOLD`, so a score
    // landing exactly on the threshold is confident enough and the model is
    // never asked. No live rule emits 0.6, so the parser is pinned here.
    parseUtteranceMock.mockReturnValue({
      actionId: 'petOverview',
      slots: {petName: 'Bruno'},
      confidence: RULES_CONFIDENCE_THRESHOLD,
      source: 'rules',
    });

    const turn = await runTurn('bruno please', makeContext(), fakeT);

    expect(turn.intent?.confidence).toBe(0.6);
    expect(classifyMock).not.toHaveBeenCalled();
    expect(parseUtteranceMock).toHaveBeenCalledTimes(1);
    expect(turn.intent?.actionId).toBe('petOverview');
    expect(turn.intent?.source).toBe('rules');
    expect(turn.text).toBe(
      'warmer: assistant.replies.petOverview.summary|' +
        '{"petName":"Bruno","breed":"","tasks":0,"appointments":1}',
    );
  });

  it('passes the parsed slots to the resolver', async () => {
    const context = makeContext({tasks: [makeTask({companionId: 'c2'})]});

    const turn = await runTurn('what tasks does Luna have', context, fakeT);

    expect(turn.intent?.slots).toEqual({petName: 'Luna'});
    expect(runActionMock).toHaveBeenCalledWith('upcomingTasks', context, {
      petName: 'Luna',
    });
    expect(turn.result?.speechParams).toEqual({
      count: 1,
      first: 'Care task',
      petName: 'Luna',
    });
  });
});

describe('runTurn: the rules scored low', () => {
  it('takes the action from the model but keeps the slots the rules found', async () => {
    parseUtteranceMock.mockReturnValue({
      actionId: 'upcomingTasks',
      slots: {petName: 'Luna'},
      confidence: 0.4,
      source: 'rules',
    });
    classifyMock.mockResolvedValue(modelGuess({actionId: 'petOverview'}));

    const turn = await runTurn('luna thing', makeContext(), fakeT);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(classifyMock).toHaveBeenCalledWith(
      'luna thing',
      EXPECTED_DESCRIPTIONS,
    );
    // The rules are re-run purely to keep their slots.
    expect(parseUtteranceMock).toHaveBeenCalledTimes(2);
    expect(turn.intent).toEqual({
      actionId: 'petOverview',
      slots: {petName: 'Luna'},
      confidence: 0.5,
      source: 'model',
    });
    // Had the slot been dropped, two companions would force a needsSlot reply.
    expect(turn.result?.status).toBe('ok');
    expect(turn.text).toBe(
      'warmer: assistant.replies.petOverview.summary|' +
        '{"petName":"Luna","breed":"","tasks":0,"appointments":0}',
    );
  });

  it('rescues a bare pet name through the model and keeps the pet the rules found', async () => {
    // The live parser scores a bare name below the threshold, so this is the
    // rescue route running end to end with no parser stubbing at all.
    const context = makeContext({
      tasks: [
        makeTask({id: 't1', companionId: 'c1', title: 'Brush Bruno'}),
        makeTask({id: 't2', companionId: 'c2', title: 'Walk Luna'}),
      ],
    });
    classifyMock.mockResolvedValue(modelGuess({actionId: 'upcomingTasks'}));

    const turn = await runTurn('Bruno', context, fakeT);

    const rulesRead = realParseUtterance('Bruno', {
      petNames: ['Bruno', 'Luna'],
      now: NOW,
    });
    expect(rulesRead).toEqual({
      actionId: 'petOverview',
      slots: {petName: 'Bruno'},
      confidence: BARE_NAME_CONFIDENCE,
      source: 'rules',
    });
    expect(BARE_NAME_CONFIDENCE).toBeLessThan(RULES_CONFIDENCE_THRESHOLD);
    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(classifyMock).toHaveBeenCalledWith('Bruno', EXPECTED_DESCRIPTIONS);
    // Re-run purely to keep the slots the rules had already extracted.
    expect(parseUtteranceMock).toHaveBeenCalledTimes(2);
    expect(turn.intent).toEqual({
      actionId: 'upcomingTasks',
      slots: {petName: 'Bruno'},
      confidence: 0.5,
      source: 'model',
    });
    expect(runActionMock).toHaveBeenCalledWith('upcomingTasks', context, {
      petName: 'Bruno',
    });
    // Had the model's empty slots won, both pets would be in scope: count 2
    // and an empty petName. The rules still own slot filling.
    expect(turn.result?.speechParams).toEqual({
      count: 1,
      first: 'Brush Bruno',
      petName: 'Bruno',
    });
    expect(turn.text).toBe(
      'warmer: assistant.replies.upcomingTasks.found|' +
        '{"count":1,"first":"Brush Bruno","petName":"Bruno"}',
    );
  });

  it('keeps the weak rules intent when the model declines to guess', async () => {
    classifyMock.mockResolvedValue(null);

    const turn = await runTurn('Bruno', makeContext(), fakeT);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    // No guess means no re-parse; the original rules intent is simply kept.
    expect(parseUtteranceMock).toHaveBeenCalledTimes(1);
    expect(turn.intent).toEqual({
      actionId: 'petOverview',
      slots: {petName: 'Bruno'},
      confidence: BARE_NAME_CONFIDENCE,
      source: 'rules',
    });
    // It answers from the rules rather than falling through to "unknown".
    expect(turn.result?.status).toBe('ok');
    expect(turn.text).toBe(
      'warmer: assistant.replies.petOverview.summary|' +
        '{"petName":"Bruno","breed":"","tasks":0,"appointments":1}',
    );
  });

  it('does not consult the model when useModel is false', async () => {
    parseUtteranceMock.mockReturnValue({
      actionId: 'upcomingTasks',
      slots: {petName: 'Luna'},
      confidence: 0.4,
      source: 'rules',
    });

    const turn = await runTurn('luna thing', makeContext(), fakeT, {
      useModel: false,
    });

    expect(classifyMock).not.toHaveBeenCalled();
    expect(parseUtteranceMock).toHaveBeenCalledTimes(1);
    expect(turn.intent?.actionId).toBe('upcomingTasks');
    expect(turn.intent?.source).toBe('rules');
  });
});

describe('runTurn: the rules found nothing', () => {
  it('routes through the model and runs the resolver with empty slots', async () => {
    classifyMock.mockResolvedValue(modelGuess({actionId: 'petOverview'}));

    const turn = await runTurn('hello there', makeContext(), fakeT);

    expect(classifyMock).toHaveBeenCalledWith(
      'hello there',
      EXPECTED_DESCRIPTIONS,
    );
    expect(turn.intent).toEqual({
      actionId: 'petOverview',
      slots: {},
      confidence: 0.5,
      source: 'model',
    });
    // Two pets and no name, so the resolver has to ask which one.
    expect(turn.result?.status).toBe('needsSlot');
    expect(turn.result?.missingSlot).toBe('petName');
    expect(turn.text).toBe('assistant.replies.needsPet|{}');
  });

  it('answers "unknown" when the model returns no action', async () => {
    classifyMock.mockResolvedValue(null);

    const turn = await runTurn('hello there', makeContext(), fakeT);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(turn).toEqual({
      intent: null,
      result: null,
      text: 'assistant.replies.unknown',
    });
    expect(runActionMock).not.toHaveBeenCalled();
    expect(rephraseMock).not.toHaveBeenCalled();
  });

  it('answers "unknown" without asking the model when useModel is false', async () => {
    classifyMock.mockResolvedValue(modelGuess());

    const turn = await runTurn('hello there', makeContext(), fakeT, {
      useModel: false,
    });

    expect(classifyMock).not.toHaveBeenCalled();
    expect(turn.text).toBe('assistant.replies.unknown');
    expect(turn.intent).toBeNull();
    expect(runActionMock).not.toHaveBeenCalled();
  });
});

describe('runTurn: rephrasing', () => {
  it('rephrases an "ok" answer and returns the model wording', async () => {
    const turn = await runTurn(
      'total expenses',
      makeContext({expenses: [makeExpense({amount: 40})]}),
      fakeT,
    );

    expect(turn.result?.status).toBe('ok');
    expect(rephraseMock).toHaveBeenCalledTimes(1);
    expect(rephraseMock).toHaveBeenCalledWith(
      'assistant.replies.expenseSummary.total|' +
        '{"total":40,"currency":"EUR","petName":"","count":1}',
    );
    expect(turn.text).toBe(
      'warmer: assistant.replies.expenseSummary.total|' +
        '{"total":40,"currency":"EUR","petName":"","count":1}',
    );
  });

  it('leaves a handoff sentence exactly as the resolver wrote it', async () => {
    const turn = await runTurn(
      'book an appointment for Bruno',
      makeContext(),
      fakeT,
    );

    expect(turn.result?.status).toBe('handoff');
    expect(rephraseMock).not.toHaveBeenCalled();
    expect(turn.text).toBe(
      'assistant.replies.bookAppointment.handoff|{"petName":"Bruno","title":""}',
    );
    expect(turn.result?.deepLink).toContain(
      'yc://app/appointments/book?companionId=c1',
    );
  });

  it('leaves a needsSlot question unrephrased so it stays a question', async () => {
    const turn = await runTurn('overview', makeContext(), fakeT);

    expect(turn.result?.status).toBe('needsSlot');
    expect(rephraseMock).not.toHaveBeenCalled();
    expect(turn.text).toBe('assistant.replies.needsPet|{}');
  });

  it('leaves an "empty" answer unrephrased', async () => {
    const turn = await runTurn(
      'when is my next appointment',
      makeContext({appointments: []}),
      fakeT,
    );

    expect(turn.result?.status).toBe('empty');
    expect(rephraseMock).not.toHaveBeenCalled();
    expect(turn.text).toBe(
      'assistant.replies.nextAppointment.none|{"petName":""}',
    );
  });

  it('keeps the resolver wording when allowRephrase is false', async () => {
    const turn = await runTurn(
      'when is my next appointment',
      makeContext(),
      fakeT,
      {
        allowRephrase: false,
      },
    );

    expect(turn.result?.status).toBe('ok');
    expect(rephraseMock).not.toHaveBeenCalled();
    expect(turn.text).toBe(
      'assistant.replies.nextAppointment.found|' +
        '{"petName":"Bruno","date":"2026-09-12","time":"09:00","business":"Willow Vets"}',
    );
  });

  it('keeps the resolver wording when useModel is false', async () => {
    const turn = await runTurn(
      'when is my next appointment',
      makeContext(),
      fakeT,
      {
        useModel: false,
      },
    );

    expect(rephraseMock).not.toHaveBeenCalled();
    expect(classifyMock).not.toHaveBeenCalled();
    expect(turn.text).toBe(
      'assistant.replies.nextAppointment.found|' +
        '{"petName":"Bruno","date":"2026-09-12","time":"09:00","business":"Willow Vets"}',
    );
  });

  it('rephrases when allowRephrase is explicitly true', async () => {
    const turn = await runTurn(
      'when is my next appointment',
      makeContext(),
      fakeT,
      {
        allowRephrase: true,
        useModel: true,
      },
    );

    expect(rephraseMock).toHaveBeenCalledTimes(1);
    expect(turn.text.startsWith('warmer: ')).toBe(true);
  });
});

describe('runTurn: a very long utterance', () => {
  it('truncates to MAX_UTTERANCE_LENGTH instead of rejecting the question', async () => {
    const head = 'when is my next appointment ';
    const filler = 'a'.repeat(MAX_UTTERANCE_LENGTH);
    // "vaccination" would win the routing race, so its survival past the cut
    // would be visible in the answer.
    const utterance = `  ${head}${filler} vaccination  `;

    const turn = await runTurn(utterance, makeContext(), fakeT);

    const expectedSeen = `${head}${filler} vaccination`.slice(
      0,
      MAX_UTTERANCE_LENGTH,
    );
    expect(expectedSeen).toHaveLength(MAX_UTTERANCE_LENGTH);
    expect(parseUtteranceMock).toHaveBeenCalledWith(expectedSeen, {
      petNames: ['Bruno', 'Luna'],
      now: NOW,
    });
    expect(turn.intent?.actionId).toBe('nextAppointment');
    expect(turn.result?.speechKey).toBe(
      'assistant.replies.nextAppointment.found',
    );
  });
});
