import { parseSoapCodedProblems } from '@yosemite-crew/types';

describe('parseSoapCodedProblems', () => {
  it('accepts a well-formed per-section payload', () => {
    expect(
      parseSoapCodedProblems({
        subjective: [{ ycCode: 'YC-005423', label: 'Vomiting', domain: 'PresentingComplaint' }],
        assessment: [{ ycCode: 'YC-000123', label: 'Gastritis' }],
      })
    ).toEqual({
      subjective: [{ ycCode: 'YC-005423', label: 'Vomiting', domain: 'PresentingComplaint' }],
      assessment: [{ ycCode: 'YC-000123', label: 'Gastritis' }],
    });
  });

  it.each([null, undefined, 'text', 42, ['array']])('returns undefined for %p', (value) => {
    expect(parseSoapCodedProblems(value)).toBeUndefined();
  });

  it('returns undefined when every section ends up empty', () => {
    expect(parseSoapCodedProblems({ subjective: [], plan: 'not-an-array' })).toBeUndefined();
  });

  it('drops entries missing a code or label, trims the rest, and strips blank domains', () => {
    expect(
      parseSoapCodedProblems({
        plan: [
          { ycCode: '  YC-1  ', label: '  Dental scale  ', domain: '  ' },
          { ycCode: '', label: 'No code' },
          { label: 'No code at all' },
          'not-an-object',
          null,
        ],
      })
    ).toEqual({ plan: [{ ycCode: 'YC-1', label: 'Dental scale' }] });
  });

  it('collapses duplicate codes within a section onto the first occurrence', () => {
    expect(
      parseSoapCodedProblems({
        assessment: [
          { ycCode: 'YC-1', label: 'First' },
          { ycCode: 'YC-1', label: 'Second' },
        ],
      })
    ).toEqual({ assessment: [{ ycCode: 'YC-1', label: 'First' }] });
  });

  it('reads only the four known sections and ignores prototype-polluting keys', () => {
    const hostile = JSON.parse(
      '{"__proto__": [{"ycCode": "YC-9", "label": "evil"}], "constructor": [{"ycCode": "YC-8", "label": "evil"}], "extra": [{"ycCode": "YC-7", "label": "stray"}], "plan": [{"ycCode": "YC-1", "label": "Kept"}]}'
    );
    expect(parseSoapCodedProblems(hostile)).toEqual({ plan: [{ ycCode: 'YC-1', label: 'Kept' }] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('caps a section at 50 terms', () => {
    const flood = Array.from({ length: 80 }, (_, index) => ({
      ycCode: `YC-${index}`,
      label: `Term ${index}`,
    }));
    const parsed = parseSoapCodedProblems({ subjective: flood });
    expect(parsed?.subjective).toHaveLength(50);
    expect(parsed?.subjective?.[49]).toEqual({ ycCode: 'YC-49', label: 'Term 49' });
  });

  it('ignores an inherited (non-own) section property', () => {
    const proto = { plan: [{ ycCode: 'YC-1', label: 'Inherited' }] };
    const value = Object.create(proto) as Record<string, unknown>;
    value.subjective = [{ ycCode: 'YC-2', label: 'Own' }];
    expect(parseSoapCodedProblems(value)).toEqual({
      subjective: [{ ycCode: 'YC-2', label: 'Own' }],
    });
  });
});
