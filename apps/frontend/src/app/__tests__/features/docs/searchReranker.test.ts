jest.mock('server-only', () => ({}));
jest.mock('@/app/features/docs/searchIndex', () => ({ buildSearchIndex: jest.fn() }));
const mockSystemOne = jest.fn();
jest.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: jest.fn().mockImplementation(() => ({ systemOne: mockSystemOne })),
  score: (instructions: string, criteria: readonly string[]) => ({
    type: 'score',
    instructions,
    criteria,
  }),
}));

import { buildSearchIndex, type SearchDoc } from '@/app/features/docs/searchIndex';
import { retrieveJudgmentCandidates } from '@/app/features/docs/searchRanking';
import { rerankDocs } from '@/app/features/docs/searchReranker';

const DOCS: SearchDoc[] = [
  {
    title: 'API key guide A',
    href: '/docs/a',
    section: 'Backend API',
    text: `rotate ${'a'.repeat(500)}`,
  },
  {
    title: 'API key guide B',
    href: '/docs/b',
    section: 'Backend API',
    text: `rotate ${'b'.repeat(500)}`,
  },
  {
    title: 'API reference',
    href: '/docs/c',
    section: 'Guides',
    text: `rotate key ${'c'.repeat(500)}`,
  },
  {
    title: 'Rotate API key guide',
    href: '/docs/d',
    section: 'Guides',
    text: 'key details',
  },
  {
    title: 'Rotation guide',
    href: '/docs/e',
    section: 'Guides',
    text: 'api key',
  },
];

const mockBuildSearchIndex = buildSearchIndex as jest.MockedFunction<typeof buildSearchIndex>;
const originalApiKey = process.env.TYPESAFE_API_KEY;
let testNow = Date.now();
let dateNow: jest.SpyInstance<number, []>;

const probabilities = (level: number): Record<string, number> =>
  Object.fromEntries([0, 1, 2, 3].map((value) => [String(value), value === level ? 0.85 : 0.05]));

const mockTypeSafe = (levelFor: (index: number) => number = (index) => (index === 0 ? 0 : 3)) => {
  const requests: Array<{ request: Record<string, unknown>; options: Record<string, unknown> }> =
    [];
  mockSystemOne.mockImplementation(
    async (request: Record<string, unknown>, options: Record<string, unknown>) => {
      requests.push({ request, options });
      const questions = request.questions as Record<string, unknown>;
      const answers = Object.fromEntries(
        Object.keys(questions).map((name, index) => {
          const level = levelFor(index);
          return [
            name,
            {
              type: 'score',
              score: level,
              confidence: 0.85,
              legend: {},
              probabilities: probabilities(level),
            },
          ];
        })
      );
      return { model: 'jev-test', answers, usage: { input_tokens: 42, output_tokens: 9 } };
    }
  );
  return requests;
};

describe('server-side documentation reranking', () => {
  beforeEach(() => {
    testNow += 61_000;
    dateNow = jest.spyOn(Date, 'now').mockReturnValue(testNow);
    process.env.TYPESAFE_API_KEY = 'test-api-key';
    mockBuildSearchIndex.mockReturnValue(DOCS);
    mockSystemOne.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
  });

  it('fails open when the configured index cannot load, then recovers', async () => {
    mockBuildSearchIndex.mockImplementationOnce(() => {
      throw new Error('index unavailable');
    });
    expect(await rerankDocs('rotate api key index-failure')).toBeNull();
    expect(mockSystemOne).not.toHaveBeenCalled();

    const requests = mockTypeSafe();
    expect(await rerankDocs('rotate api key index-recovery')).toEqual(['/docs/d']);
    expect(requests).toHaveLength(1);
  });

  it('sends only the query and the capped, sanitized candidate fields', async () => {
    const requests = mockTypeSafe((index) => (index < 3 ? 0 : 3));

    const order = await rerankDocs('  ROTATE   API key payload ');
    const expectedCandidates = retrieveJudgmentCandidates(DOCS, 'rotate api key payload');
    const { request } = requests[0] as unknown as {
      request: {
        state: { query: string; candidates: Array<Record<string, unknown>> };
        questions: Record<string, unknown>;
      };
    };

    expect(request.state.query).toBe('rotate api key payload');
    expect(Object.keys(request.state).sort()).toEqual(['candidates', 'query']);
    expect(request.state.candidates).toHaveLength(5);
    expect(Object.keys(request.state.candidates[0]).sort()).toEqual(['section', 'text', 'title']);
    expect(request.state.candidates.map(({ text }) => (text as string).length)).toEqual([
      11, 300, 300, 300, 7,
    ]);
    expect(Object.keys(request.questions)).toHaveLength(5);
    expect(request.state.candidates[1]).toEqual({
      title: expectedCandidates[1].title,
      section: expectedCandidates[1].section,
      text: expectedCandidates[1].text.slice(0, 300),
    });
    expect(JSON.stringify(request.state)).not.toContain('/docs/');
    expect(order).toEqual(expectedCandidates.slice(0, 3).map(({ href }) => href));
    expect(
      order?.every((href) => expectedCandidates.some((candidate) => candidate.href === href))
    ).toBe(true);
    expect(requests[0].options).toEqual({ timeout: 800, retry: { maxRetries: 0 } });
  });

  it('orders admitted pages by judgment, then original score and title, excluding lower levels', async () => {
    mockTypeSafe((index) => [1, 0, 0, 2, 3][index]);

    expect(await rerankDocs('zzzz rotate api key ordering')).toEqual([
      '/docs/a',
      '/docs/b',
      '/docs/d',
    ]);
  });

  it('normalizes queries for a five-minute cache', async () => {
    const requests = mockTypeSafe();

    const first = await rerankDocs('rotate api key cache');
    const second = await rerankDocs('  ROTATE   API key CACHE ');

    expect(first).toEqual(second);
    expect(requests).toHaveLength(1);
  });

  it('expires cached judgments and retries on the next query', async () => {
    const requests = mockTypeSafe();

    await rerankDocs('rotate api key expiry');
    testNow += 5 * 60_000 + 1;
    dateNow.mockReturnValue(testNow);
    await rerankDocs('rotate api key expiry');

    expect(requests).toHaveLength(2);
  });

  it('returns null when TypeSafe is unconfigured, the query is empty, or retrieval has no candidates', async () => {
    delete process.env.TYPESAFE_API_KEY;
    expect(await rerankDocs('rotate api key unconfigured')).toBeNull();
    process.env.TYPESAFE_API_KEY = 'test-api-key';
    expect(await rerankDocs('   ')).toBeNull();
    expect(await rerankDocs('zzznomatch query')).toBeNull();
    expect(mockSystemOne).not.toHaveBeenCalled();
  });

  it('returns null on provider errors and malformed score probabilities', async () => {
    mockSystemOne.mockRejectedValueOnce(new Error('unavailable'));
    expect(await rerankDocs('rotate api key provider-error')).toBeNull();

    mockSystemOne.mockResolvedValueOnce({
      model: 'jev-test',
      answers: Object.fromEntries(
        DOCS.map((_, index) => [`candidate_${index}`, { type: 'score', score: 0 }])
      ),
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    expect(await rerankDocs('rotate api key malformed-answer')).toBeNull();
  });

  it('fails open when the 800ms TypeSafe request rejects', async () => {
    mockSystemOne.mockRejectedValueOnce(new Error('request timed out'));

    expect(await rerankDocs('rotate api key timeout')).toBeNull();
    expect(mockSystemOne.mock.calls[0][1]).toEqual({ timeout: 800, retry: { maxRetries: 0 } });
  });

  it('evicts old cache entries and enforces the process candidate budget', async () => {
    const requests = mockTypeSafe();
    for (let index = 0; index < 257; index += 1) {
      if (index > 0 && index % 100 === 0) {
        testNow += 61_000;
        dateNow.mockReturnValue(testNow);
      }
      await rerankDocs(`rotate api key eviction-${index}`);
    }
    expect(requests).toHaveLength(257);

    testNow += 61_000;
    dateNow.mockReturnValue(testNow);
    const budgetRequests = mockTypeSafe();
    for (let index = 0; index < 100; index += 1) {
      await rerankDocs(`rotate api key budget-${index}`);
    }
    await rerankDocs('rotate api key budget-overflow');
    expect(budgetRequests).toHaveLength(100);

    testNow += 61_000;
    dateNow.mockReturnValue(testNow);
    await rerankDocs('rotate api key budget-reset');
    expect(budgetRequests).toHaveLength(101);
  });
});
