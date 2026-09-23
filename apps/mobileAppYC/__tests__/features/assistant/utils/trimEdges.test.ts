import {
  isNotLetter,
  trimEdgesWhile,
  trimEndWhile,
  trimStartWhile,
} from '@/features/assistant/utils/trimEdges';

const isDash = (char: string) => char === '-';

describe('trimStartWhile', () => {
  it('drops the leading run and keeps the rest intact', () => {
    expect(trimStartWhile('---abc-', isDash)).toBe('abc-');
  });

  it('returns the same string when the first character does not match', () => {
    expect(trimStartWhile('abc--', isDash)).toBe('abc--');
  });

  it('returns an empty string when everything matches', () => {
    expect(trimStartWhile('----', isDash)).toBe('');
  });

  it('handles an empty string', () => {
    expect(trimStartWhile('', isDash)).toBe('');
  });
});

describe('trimEndWhile', () => {
  it('drops the trailing run and keeps the rest intact', () => {
    expect(trimEndWhile('-abc---', isDash)).toBe('-abc');
  });

  it('returns the same string when the last character does not match', () => {
    expect(trimEndWhile('--abc', isDash)).toBe('--abc');
  });

  it('returns an empty string when everything matches', () => {
    expect(trimEndWhile('----', isDash)).toBe('');
  });

  it('handles an empty string', () => {
    expect(trimEndWhile('', isDash)).toBe('');
  });
});

describe('trimEdgesWhile', () => {
  it('drops both runs but nothing in between', () => {
    expect(trimEdgesWhile('--a-b--', isDash)).toBe('a-b');
  });

  it('returns an empty string when everything matches', () => {
    expect(trimEdgesWhile('---', isDash)).toBe('');
  });
});

describe('isNotLetter', () => {
  it.each(['a', 'z', 'A', 'Z', 'm'])('treats %s as a letter', char => {
    expect(isNotLetter(char)).toBe(false);
  });

  it.each(['0', '9', '.', '!', ' ', '-', 'é', '['])(
    'treats %s as not a letter',
    char => {
      expect(isNotLetter(char)).toBe(true);
    },
  );

  it('rejects the characters either side of the ASCII letter ranges', () => {
    // '@' precedes 'A' and '[' follows 'Z'; '`' precedes 'a' and '{' follows
    // 'z'. These are what a naive range comparison gets wrong.
    expect(['@', '[', '`', '{'].map(isNotLetter)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
