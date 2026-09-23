import { rankStrictMatches, retrieveJudgmentCandidates } from '@/app/features/docs/searchRanking';
import type { SearchDoc } from '@/app/features/docs/searchIndex';

const doc = (
  title: string,
  text: string,
  href = `/docs/${title.toLowerCase().replaceAll(' ', '-')}`
): SearchDoc => ({
  title,
  href,
  section: 'Backend API',
  text,
});

describe('documentation search ranking', () => {
  it('preserves strict all-term matching and title-before-body scoring', () => {
    const docs = [
      doc('Body match', 'key rotation api'),
      doc('API key rotation', 'details'),
      doc('API only', 'no matching words'),
    ];

    expect(rankStrictMatches(docs, 'api key')).toEqual([
      { ...docs[1], score: 20 },
      { ...docs[0], score: 2 },
    ]);
  });

  it('keeps the strict candidate set when it has at least three results', () => {
    const docs = [
      doc('API key guide', 'mint keys'),
      doc('API key rotation', 'details'),
      doc('API key settings', 'details'),
      doc('API only', 'no word'),
    ];

    expect(retrieveJudgmentCandidates(docs, 'api key').map(({ title }) => title)).toEqual([
      'API key guide',
      'API key rotation',
      'API key settings',
    ]);
  });

  it('widens below three strict results and orders OR hits by the existing score', () => {
    const docs = [
      doc('API only', 'key rotation'),
      doc('Key guide', 'details'),
      doc('Rotation guide', 'details'),
      doc('API key guide', 'details'),
      doc('Unrelated', 'nothing'),
    ];

    expect(
      retrieveJudgmentCandidates(docs, 'api key').map(({ title, score }) => [title, score])
    ).toEqual([
      ['API key guide', 20],
      ['API only', 11],
      ['Key guide', 10],
    ]);
  });

  it('caps widened candidates at 25', () => {
    const docs = Array.from({ length: 30 }, (_, index) => doc(`Guide ${index}`, 'rotate'));

    expect(retrieveJudgmentCandidates(docs, 'rotate')).toHaveLength(25);
  });

  it('returns no candidates for a blank query', () => {
    expect(rankStrictMatches([doc('API guide', 'keys')], '   ')).toEqual([]);
    expect(retrieveJudgmentCandidates([doc('API guide', 'keys')], '   ')).toEqual([]);
  });
});
