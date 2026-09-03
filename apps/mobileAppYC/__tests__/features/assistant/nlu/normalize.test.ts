import {
  containsPhrase,
  normalizeText,
  tokenize,
} from '@/features/assistant/nlu/normalize';

describe('normalizeText', () => {
  it('lower-cases and strips punctuation', () => {
    expect(normalizeText("Bruno's VACCINE!")).toBe('bruno s vaccine');
  });

  it('folds accents so Spanish reaches the same keyword table', () => {
    expect(normalizeText('¿Cuándo es la próxima vacuna?')).toBe(
      'cuando es la proxima vacuna',
    );
  });

  it('collapses runs of separators and trims', () => {
    expect(normalizeText('  a --- b  ')).toBe('a b');
  });

  it('returns an empty string for punctuation only', () => {
    expect(normalizeText('!!!')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits into words', () => {
    expect(tokenize('when is the vet')).toEqual(['when', 'is', 'the', 'vet']);
  });

  it('returns an empty array rather than one empty token', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('containsPhrase', () => {
  it('matches words in order with gaps between them', () => {
    expect(
      containsPhrase(
        ['when', 'is', 'the', 'next', 'vaccine'],
        ['when', 'vaccine'],
      ),
    ).toBe(true);
  });

  it('rejects words that appear out of order', () => {
    expect(containsPhrase(['vaccine', 'when'], ['when', 'vaccine'])).toBe(
      false,
    );
  });

  it('rejects an empty phrase', () => {
    expect(containsPhrase(['a'], [])).toBe(false);
  });
});
