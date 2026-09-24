/**
 * Tests for the on-device model wrapper.
 *
 * The wrapper is a guard rail: it must never let the platform model widen the
 * assistant's answers. Every case here drives the real module with a faked
 * native bridge and asserts the exact value that reaches the caller.
 */
import {
  checkAvailability,
  classify,
  rephrase,
  keepsTheFacts,
} from '@/features/assistant/services/onDeviceModel';
import {ASSISTANT_ACTION_IDS} from '@/features/assistant/actions/catalogue';
import {
  ON_DEVICE_MODEL_TIMEOUT_MS,
  RULES_CONFIDENCE_THRESHOLD,
} from '@/features/assistant/constants';

const mockGetOnDeviceModelModule = jest.fn();
const mockPlatformProviderLabel = jest.fn(() => 'Apple Intelligence');

jest.mock('@/features/assistant/services/nativeBridge', () => ({
  getOnDeviceModelModule: () => mockGetOnDeviceModelModule(),
  platformProviderLabel: () => mockPlatformProviderLabel(),
}));

type FakeModule = {
  isAvailable: jest.Mock;
  generate: jest.Mock;
};

const makeModule = (overrides: Partial<FakeModule> = {}): FakeModule => ({
  isAvailable: jest.fn().mockResolvedValue({available: true}),
  generate: jest.fn().mockResolvedValue(''),
  ...overrides,
});

/** Installs a fake native module for the next call, and returns it. */
const useModule = (overrides: Partial<FakeModule> = {}): FakeModule => {
  const module = makeModule(overrides);
  mockGetOnDeviceModelModule.mockReturnValue(module);
  return module;
};

const useNoModule = (): void => {
  mockGetOnDeviceModelModule.mockReturnValue(null);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformProviderLabel.mockReturnValue('Apple Intelligence');
  useNoModule();
});

describe('checkAvailability', () => {
  it('reports unsupportedDevice with no provider label when the native module is absent', async () => {
    useNoModule();

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unsupportedDevice',
    });
    expect(mockPlatformProviderLabel).not.toHaveBeenCalled();
  });

  it('reports available with the platform label when the module says yes', async () => {
    useModule({isAvailable: jest.fn().mockResolvedValue({available: true})});

    await expect(checkAvailability()).resolves.toEqual({
      available: true,
      providerLabel: 'Apple Intelligence',
    });
  });

  it('prefers the label the module supplies over the platform default', async () => {
    useModule({
      isAvailable: jest
        .fn()
        .mockResolvedValue({available: true, providerLabel: 'Gemini Nano'}),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: true,
      providerLabel: 'Gemini Nano',
    });
    expect(mockPlatformProviderLabel).not.toHaveBeenCalled();
  });

  it.each([
    'unsupportedOS',
    'unsupportedDevice',
    'notEnabled',
    'modelNotReady',
    'unknown',
  ])('passes the known reason %s straight through', async reason => {
    useModule({
      isAvailable: jest.fn().mockResolvedValue({available: false, reason}),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason,
      providerLabel: 'Apple Intelligence',
    });
  });

  it('maps a reason outside the known set to unknown', async () => {
    useModule({
      isAvailable: jest
        .fn()
        .mockResolvedValue({available: false, reason: 'thermalThrottling'}),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Apple Intelligence',
    });
  });

  it('maps a missing reason to unknown and still reports the provider label', async () => {
    useModule({isAvailable: jest.fn().mockResolvedValue({available: false})});

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Apple Intelligence',
    });
  });

  it('treats a null result as unavailable for an unknown reason', async () => {
    useModule({isAvailable: jest.fn().mockResolvedValue(null)});

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Apple Intelligence',
    });
  });

  it('keeps the module-supplied label on the unavailable branch', async () => {
    useModule({
      isAvailable: jest.fn().mockResolvedValue({
        available: false,
        reason: 'notEnabled',
        providerLabel: 'Writing Tools',
      }),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'notEnabled',
      providerLabel: 'Writing Tools',
    });
  });

  it('reports unknown with the platform label when isAvailable rejects', async () => {
    useModule({
      isAvailable: jest.fn().mockRejectedValue(new Error('bridge exploded')),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Apple Intelligence',
    });
  });

  it('reports unknown with the platform label when isAvailable throws synchronously', async () => {
    useModule({
      isAvailable: jest.fn(() => {
        throw new Error('no such selector');
      }),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Apple Intelligence',
    });
  });

  it('takes the throwing path label from the platform rather than a fixed string', async () => {
    mockPlatformProviderLabel.mockReturnValue('Gemini Nano');
    useModule({
      isAvailable: jest.fn().mockRejectedValue(new Error('bridge exploded')),
    });

    await expect(checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'unknown',
      providerLabel: 'Gemini Nano',
    });
    expect(mockPlatformProviderLabel).toHaveBeenCalledTimes(1);
  });
});

describe('classify', () => {
  it('returns null without asking anything when the native module is absent', async () => {
    useNoModule();

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('returns the catalogue action the model names', async () => {
    const module = useModule({
      generate: jest.fn().mockResolvedValue('nextAppointment'),
    });

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toEqual({
      actionId: 'nextAppointment',
      slots: {},
      confidence: 0.5,
      source: 'model',
    });
    expect(module.generate).toHaveBeenCalledTimes(1);
  });

  it('sends the utterance, the descriptions and a 24 token budget to the model', async () => {
    const module = useModule({
      generate: jest.fn().mockResolvedValue('logExpense'),
    });

    await classify('I paid the groomer', 'logExpense — record a cost');

    const [prompt, maxTokens] = module.generate.mock.calls[0];
    expect(prompt).toContain('Question: I paid the groomer');
    expect(prompt).toContain('logExpense — record a cost');
    expect(prompt).toContain(
      'Reply with exactly one action id from this list and nothing else.',
    );
    expect(maxTokens).toBe(24);
  });

  it('strips surrounding whitespace and punctuation from the reply', async () => {
    useModule({
      generate: jest.fn().mockResolvedValue('\n  "vaccinationStatus".  \n'),
    });

    const intent = await classify('are the shots done', 'catalogue');

    expect(intent?.actionId).toBe('vaccinationStatus');
  });

  it('returns null when the id arrives inside a numbered list item', async () => {
    useModule({
      generate: jest.fn().mockResolvedValue('\n  2. "vaccinationStatus".  \n'),
    });

    await expect(
      classify('are the shots done', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('matches an action id regardless of case', async () => {
    useModule({generate: jest.fn().mockResolvedValue('BOOKAPPOINTMENT')});

    const intent = await classify('book me in', 'catalogue');

    expect(intent?.actionId).toBe('bookAppointment');
  });

  it('reports source model and a confidence below the rules threshold', async () => {
    useModule({generate: jest.fn().mockResolvedValue('petOverview')});

    const intent = await classify('tell me about Rex', 'catalogue');

    expect(intent?.source).toBe('model');
    expect(intent?.confidence).toBe(0.5);
    expect(intent?.confidence).toBeLessThan(RULES_CONFIDENCE_THRESHOLD);
  });

  it('never invents slots for the model guess', async () => {
    useModule({generate: jest.fn().mockResolvedValue('upcomingTasks')});

    const intent = await classify('what is due for Rex', 'catalogue');

    expect(intent?.slots).toEqual({});
  });

  it('returns null for an id that is not in the catalogue', async () => {
    useModule({generate: jest.fn().mockResolvedValue('petHoroscope')});

    expect(ASSISTANT_ACTION_IDS).not.toContain('petHoroscope');
    await expect(classify('read his stars', 'catalogue')).resolves.toBeNull();
  });

  it('returns null when the model answers the question in prose instead', async () => {
    useModule({
      generate: jest
        .fn()
        .mockResolvedValue('I think the vet visit is on Tuesday at three.'),
    });

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('returns null for a spaced rendering of an id, which is prose and not an id', async () => {
    useModule({generate: jest.fn().mockResolvedValue('next appointment')});

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('returns null for a line-broken rendering of an id', async () => {
    useModule({generate: jest.fn().mockResolvedValue('next\nAppointment')});

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('accepts a single-token id wrapped in whitespace and a full stop', async () => {
    useModule({generate: jest.fn().mockResolvedValue(' nextAppointment. ')});

    const intent = await classify('when is the vet visit', 'catalogue');

    expect(intent?.actionId).toBe('nextAppointment');
  });

  it('returns null for an empty reply', async () => {
    useModule({generate: jest.fn().mockResolvedValue('   ')});

    await expect(classify('anything', 'catalogue')).resolves.toBeNull();
  });

  it('returns null when the model resolves to null', async () => {
    useModule({generate: jest.fn().mockResolvedValue(null)});

    await expect(classify('anything', 'catalogue')).resolves.toBeNull();
  });

  it('returns null when generate rejects', async () => {
    useModule({
      generate: jest.fn().mockRejectedValue(new Error('model timed out')),
    });

    await expect(
      classify('when is the vet visit', 'catalogue'),
    ).resolves.toBeNull();
  });

  it('gives up and returns null instead of hanging forever when the native call never resolves', async () => {
    jest.useFakeTimers();
    try {
      useModule({generate: jest.fn(() => new Promise(() => {}))});

      const pending = classify('when is the vet visit', 'catalogue');
      await jest.advanceTimersByTimeAsync(ON_DEVICE_MODEL_TIMEOUT_MS);

      await expect(pending).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('rephrase', () => {
  const sentence = 'Rex is due for a rabies booster on 4 March.';

  it('returns the sentence untouched when the native module is absent', async () => {
    useNoModule();

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('returns the model rewrite when it is a plausible short sentence', async () => {
    useModule({
      generate: jest
        .fn()
        .mockResolvedValue("Rex's rabies booster is due on 4 March."),
    });

    await expect(rephrase(sentence)).resolves.toBe(
      "Rex's rabies booster is due on 4 March.",
    );
  });

  it('trims the whitespace the model wraps around its rewrite', async () => {
    useModule({
      generate: jest.fn().mockResolvedValue('\n  Booster due: 4 March.  '),
    });

    await expect(rephrase(sentence)).resolves.toBe('Booster due: 4 March.');
  });

  it('sends the sentence and a 96 token budget to the model', async () => {
    const module = useModule({generate: jest.fn().mockResolvedValue('ok')});

    await rephrase(sentence);

    const [prompt, maxTokens] = module.generate.mock.calls[0];
    expect(prompt).toContain(`Sentence: ${sentence}`);
    expect(prompt).toContain('Add no new facts. Reply with the sentence only.');
    expect(maxTokens).toBe(96);
  });

  it('returns the original when the model replies with only whitespace', async () => {
    useModule({generate: jest.fn().mockResolvedValue('   \n  ')});

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('returns the original when the model resolves to null', async () => {
    useModule({generate: jest.fn().mockResolvedValue(null)});

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('returns the original when the rewrite runs past twice the length plus 40', async () => {
    const tooLong = 'x'.repeat(sentence.length * 2 + 41);
    useModule({generate: jest.fn().mockResolvedValue(tooLong)});

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('accepts a rewrite that lands exactly on the length ceiling', async () => {
    const keepsFacts = 'Rex is due on 4 March. ';
    const atCeiling =
      keepsFacts + 'y'.repeat(sentence.length * 2 + 40 - keepsFacts.length);
    useModule({generate: jest.fn().mockResolvedValue(atCeiling)});

    await expect(rephrase(sentence)).resolves.toBe(atCeiling);
  });

  it('returns the original when generate rejects', async () => {
    useModule({
      generate: jest.fn().mockRejectedValue(new Error('model timed out')),
    });

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('returns the original when generate throws synchronously', async () => {
    useModule({
      generate: jest.fn(() => {
        throw new Error('bridge gone');
      }),
    });

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('gives up and returns the original sentence instead of hanging forever when the native call never resolves', async () => {
    jest.useFakeTimers();
    try {
      useModule({generate: jest.fn(() => new Promise(() => {}))});

      const pending = rephrase(sentence);
      await jest.advanceTimersByTimeAsync(ON_DEVICE_MODEL_TIMEOUT_MS);

      await expect(pending).resolves.toBe(sentence);
    } finally {
      jest.useRealTimers();
    }
  });
});

// The prompt asks the model to keep every date, number and name, and asking is
// not a check. Each case below is a rewrite that fits the length limit and still
// tells the pet owner something the resolver never said.
describe('rephrase keeps the facts', () => {
  const useRewrite = (text: string) =>
    useModule({generate: jest.fn().mockResolvedValue(text)});

  it('keeps the sentence when the rewrite moves the date', async () => {
    const sentence = 'Rex is due a Rabies vaccination on 4 March.';
    useRewrite('Rex is due a Rabies vaccination on 14 March.');

    await expect(
      rephrase(sentence, ['Rex', 'Rabies', '4 March']),
    ).resolves.toBe(sentence);
  });

  it('keeps the sentence when the rewrite drops the number', async () => {
    const sentence = 'There are 3 tasks due, starting with Brush teeth.';
    useRewrite('A few tasks are due, starting with Brush teeth.');

    await expect(rephrase(sentence)).resolves.toBe(sentence);
  });

  it('keeps the sentence when the rewrite adds a negation', async () => {
    const sentence = 'Rex is up to date on vaccinations.';
    useRewrite('Rex is not up to date on vaccinations.');
    await expect(rephrase(sentence, ['Rex'])).resolves.toBe(sentence);

    useRewrite('Rex isn\u2019t up to date on vaccinations.');
    await expect(rephrase(sentence, ['Rex'])).resolves.toBe(sentence);
  });

  it('keeps the sentence when the rewrite adds a status or day word', async () => {
    const sentence = 'Rex has an appointment on 4 March at 10:30.';
    useRewrite('Rex has an appointment tomorrow, 4 March at 10:30.');
    await expect(rephrase(sentence, ['Rex', '4 March', '10:30'])).resolves.toBe(
      sentence,
    );

    const upToDate = 'Rex is up to date on vaccinations.';
    useRewrite('Rex has vaccinations overdue.');
    await expect(rephrase(upToDate, ['Rex'])).resolves.toBe(upToDate);
  });

  it('keeps the sentence when the rewrite swaps a value the resolver rendered', async () => {
    const sentence = 'Rex is due a Rabies vaccination on 4 March.';
    useRewrite('Max is due a Rabies vaccination on 4 March.');

    await expect(
      rephrase(sentence, ['Rex', 'Rabies', '4 March']),
    ).resolves.toBe(sentence);
  });

  it('checks Spanish negation and day words too', async () => {
    const sentence = 'Rex tiene una cita el 4 de marzo a las 10:30.';
    useRewrite('Rex no tiene una cita el 4 de marzo a las 10:30.');
    await expect(rephrase(sentence, ['Rex'])).resolves.toBe(sentence);

    useRewrite('Rex tiene una cita mañana, 4 de marzo, a las 10:30.');
    await expect(rephrase(sentence, ['Rex'])).resolves.toBe(sentence);
  });

  it('accepts a warmer rewrite that keeps every fact', async () => {
    const sentence = 'Rex is due a Rabies vaccination on 4 March.';
    const warmer = "Good news: Rex's Rabies vaccination is due on 4 March.";
    useRewrite(warmer);

    await expect(
      rephrase(sentence, ['Rex', 'Rabies', '4 March']),
    ).resolves.toBe(warmer);
  });
});

describe('keepsTheFacts', () => {
  it('only requires the values the sentence actually shows', () => {
    // An expense sentence may format the currency away; a value that is not in
    // the sentence cannot be demanded of the rewrite.
    expect(
      keepsTheFacts(
        'You spent 40 across 1 expense.',
        'Your 1 expense came to 40.',
        [40, 'EUR', 1],
      ),
    ).toBe(true);
  });

  it('ignores empty values', () => {
    expect(
      keepsTheFacts('There are no tasks.', 'You have no tasks.', ['', '  ']),
    ).toBe(true);
  });

  it('matches a value as a whole word, not inside another word', () => {
    expect(
      keepsTheFacts('Rex is due on 4 March.', 'Rexford is due on 4 March.', [
        'Rex',
      ]),
    ).toBe(false);
    expect(
      keepsTheFacts('Rex is due on 4 March.', "Rex's due date is 4 March.", [
        'Rex',
      ]),
    ).toBe(true);
  });

  it('treats a removed negation as a change, not only an added one', () => {
    expect(keepsTheFacts('Rex is not due.', 'Rex is due.')).toBe(false);
  });
});
