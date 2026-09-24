import {
  FLAG_OPTIONS,
  TEST_TYPE_OPTIONS,
  buildPocLabPayload,
  emptyPocLabForm,
  formatConductedAt,
  hasErrors,
  isBlankRow,
  newRow,
  parseResultValue,
  toDateTimeLocal,
  validatePocLabForm,
  type PocLabFormValues,
  type PocLabRowValues,
} from '@/app/features/companionHistory/components/pocLabForm';

const NOW = new Date(2026, 8, 24, 9, 15, 30);

const row = (over: Partial<PocLabRowValues> = {}): PocLabRowValues => ({
  ...newRow(),
  ...over,
});

const form = (over: Partial<PocLabFormValues> = {}): PocLabFormValues => ({
  ...emptyPocLabForm(NOW),
  testType: 'CBC',
  rows: [row({ name: 'PLT', value: '38' })],
  ...over,
});

describe('pocLabForm options', () => {
  it('lists the test types in enum order and every flag with "No flag" first', () => {
    expect(TEST_TYPE_OPTIONS[0]).toEqual({ value: 'CBC', label: 'Complete blood count' });
    expect(TEST_TYPE_OPTIONS.at(-1)).toEqual({ value: 'OTHER', label: 'Other test' });
    expect(TEST_TYPE_OPTIONS).toHaveLength(12);
    expect(FLAG_OPTIONS.map((option) => option.label)).toEqual([
      'No flag',
      'Normal',
      'High',
      'Low',
      'Critical high',
      'Critical low',
    ]);
  });
});

describe('newRow / emptyPocLabForm', () => {
  it('gives every row a distinct id and starts blank', () => {
    const a = newRow();
    const b = newRow();
    expect(a.id).not.toBe(b.id);
    expect(isBlankRow(a)).toBe(true);
  });

  it('defaults Performed at to now, to the minute, in local time', () => {
    const values = emptyPocLabForm(new Date(2026, 0, 5, 7, 4, 59));
    expect(values.performedAt).toBe('2026-01-05T07:04');
    expect(values.testType).toBe('');
    expect(values.rows).toHaveLength(1);
    expect(values.followUp).toBe(false);
  });

  it('pads every part of the datetime-local value', () => {
    expect(toDateTimeLocal(new Date(2026, 10, 30, 23, 9))).toBe('2026-11-30T23:09');
  });
});

describe('isBlankRow', () => {
  it('treats whitespace as blank but any flag as filled', () => {
    expect(isBlankRow(row({ name: '  ', unit: ' ' }))).toBe(true);
    expect(isBlankRow(row({ flag: 'H' }))).toBe(false);
    expect(isBlankRow(row({ high: '4' }))).toBe(false);
  });
});

describe('parseResultValue', () => {
  it.each([
    ['7.2', 7.2],
    ['-1', -1],
    [' 38 ', 38],
    ['0.41', 0.41],
    ['12', 12],
    ['12.5', 12.5],
  ])('sends %p as the number %p', (text, expected) => {
    expect(parseResultValue(text)).toBe(expected);
  });

  it.each([
    ['Haemolysed', 'Haemolysed'],
    ['1+', '1+'],
    ['<5', '<5'],
    ['<0.1', '<0.1'],
    ['1e3', '1e3'],
    ['.5', '.5'],
    ['  Trace ', 'Trace'],
    ['Infinity', 'Infinity'],
  ])('keeps %p as the text %p', (text, expected) => {
    expect(parseResultValue(text)).toBe(expected);
  });

  // A number would print these differently, so the reading is kept as typed.
  it.each([
    ['1.50', 'a trailing zero'],
    ['007', 'leading zeros'],
    ['12345678901234567890', 'the digits past double precision'],
    ['-0', 'the sign'],
  ])('keeps %p as text rather than lose %s', (text) => {
    expect(parseResultValue(text)).toBe(text);
  });
});

describe('validatePocLabForm', () => {
  it('passes a complete form', () => {
    const errors = validatePocLabForm(form(), NOW);
    expect(errors).toEqual({ rows: {} });
    expect(hasErrors(errors)).toBe(false);
  });

  it('requires a test type and a performed-at time', () => {
    const errors = validatePocLabForm(form({ testType: '', performedAt: '' }), NOW);
    expect(errors.testType).toBe('Choose a test type.');
    expect(errors.performedAt).toBe('Enter when the test was performed.');
    expect(hasErrors(errors)).toBe(true);
  });

  it('rejects a time later than now but accepts the current minute', () => {
    expect(validatePocLabForm(form({ performedAt: '2026-09-24T09:16' }), NOW).performedAt).toBe(
      "Performed at can't be in the future."
    );
    expect(
      validatePocLabForm(form({ performedAt: '2026-09-24T09:15' }), NOW).performedAt
    ).toBeUndefined();
  });

  it('drops blank rows and puts both required errors on row 1 when none are left', () => {
    const first = row();
    const second = row({ name: '   ' });
    const errors = validatePocLabForm(form({ rows: [first, second] }), NOW);
    expect(errors.rows).toEqual({
      [first.id]: { name: 'Enter a parameter name.', value: 'Enter a value.' },
    });
  });

  it('ignores a spare blank row next to a filled one', () => {
    const filled = row({ name: 'WBC', value: '18.2' });
    const errors = validatePocLabForm(form({ rows: [filled, row()] }), NOW);
    expect(errors.rows).toEqual({});
  });

  it('asks for the missing half of a partly filled row', () => {
    const noValue = row({ name: 'HCT', unit: 'L/L' });
    const noName = row({ value: '38' });
    const errors = validatePocLabForm(form({ rows: [noValue, noName] }), NOW);
    expect(errors.rows[noValue.id]).toEqual({ value: 'Enter a value.' });
    expect(errors.rows[noName.id]).toEqual({ name: 'Enter a parameter name.' });
  });

  it('checks the reference range is numeric and ordered', () => {
    const notNumbers = row({ name: 'A', value: '1', low: 'low', high: 'x' });
    const reversed = row({ name: 'B', value: '1', low: '500', high: '200' });
    const equal = row({ name: 'C', value: '1', low: '200', high: '200' });
    const onlyHigh = row({ name: 'D', value: '1', high: '5' });
    const badLowGoodHigh = row({ name: 'E', value: '1', low: 'n/a', high: '5' });
    const errors = validatePocLabForm(
      form({ rows: [notNumbers, reversed, equal, onlyHigh, badLowGoodHigh] }),
      NOW
    );
    expect(errors.rows[notNumbers.id]).toEqual({ low: 'Enter a number.', high: 'Enter a number.' });
    expect(errors.rows[reversed.id]).toEqual({ high: 'Must be at least the reference low.' });
    expect(errors.rows[equal.id]).toBeUndefined();
    expect(errors.rows[onlyHigh.id]).toBeUndefined();
    expect(errors.rows[badLowGoodHigh.id]).toEqual({ low: 'Enter a number.' });
  });
});

describe('buildPocLabPayload', () => {
  it('sends only the required keys for a minimal form', () => {
    expect(buildPocLabPayload('patient-1', form())).toEqual({
      patientId: 'patient-1',
      testType: 'CBC',
      conductedAt: new Date('2026-09-24T09:15').toISOString(),
      results: [{ name: 'PLT', value: 38 }],
    });
  });

  it('maps every optional field, trims text and derives the two flag lists', () => {
    const payload = buildPocLabPayload(
      'patient-1',
      form({
        sampleType: '  Whole blood (EDTA) ',
        analyzerName: 'In-clinic hematology analyzer',
        interpretation: ' Marked thrombocytopenia. ',
        notes: 'Recheck',
        followUp: true,
        rows: [
          row({ name: ' WBC ', value: '18.2', unit: '×10⁹/L', low: '6', high: '17', flag: 'H' }),
          row({ name: 'HCT', value: '0.41', unit: 'L/L', flag: 'N' }),
          row({ name: 'PLT', value: '38', low: '200', high: '500', flag: 'LL' }),
          row({ name: 'K', value: '6.9', flag: 'HH' }),
          row({ name: 'Glucose', value: '2.1', flag: 'L' }),
          row({ name: 'Sample quality', value: ' Haemolysed ' }),
          row(),
        ],
      })
    );
    expect(payload).toEqual({
      patientId: 'patient-1',
      testType: 'CBC',
      conductedAt: new Date('2026-09-24T09:15').toISOString(),
      sampleType: 'Whole blood (EDTA)',
      analyzerName: 'In-clinic hematology analyzer',
      results: [
        {
          name: 'WBC',
          value: 18.2,
          unit: '×10⁹/L',
          referenceRangeLow: 6,
          referenceRangeHigh: 17,
          flag: 'H',
        },
        { name: 'HCT', value: 0.41, unit: 'L/L', flag: 'N' },
        { name: 'PLT', value: 38, referenceRangeLow: 200, referenceRangeHigh: 500, flag: 'LL' },
        { name: 'K', value: 6.9, flag: 'HH' },
        { name: 'Glucose', value: 2.1, flag: 'L' },
        { name: 'Sample quality', value: 'Haemolysed' },
      ],
      abnormalFlags: ['WBC', 'Glucose'],
      criticalFlags: ['PLT', 'K'],
      overallInterpretation: 'Marked thrombocytopenia.',
      notes: 'Recheck',
      followUpRecommended: true,
    });
  });

  it('leaves out whitespace-only optional text', () => {
    const payload = buildPocLabPayload(
      'patient-1',
      form({ sampleType: '  ', analyzerName: ' ', interpretation: '\n', notes: '  ' })
    );
    expect(Object.keys(payload).sort()).toEqual(
      ['conductedAt', 'patientId', 'results', 'testType'].sort()
    );
  });
});

describe('formatConductedAt', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [new Date(2026, 8, 24, 0, 30), /(12|00):30/],
    [new Date(2026, 8, 24, 23, 30), /(11|23):30/],
  ])('shows %s on its local day with its local time', (instant, time) => {
    const text = formatConductedAt(instant.toISOString());
    expect(text).toMatch(/24/);
    expect(text).toMatch(/Sep/);
    expect(text).toMatch(time);
  });

  it('formats in the browser zone, never pinned to UTC', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleString');
    formatConductedAt('2026-09-24T09:15:00.000Z');
    expect(spy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ hour: 'numeric', minute: '2-digit' })
    );
    expect(spy).not.toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ timeZone: expect.anything() })
    );
  });

  it('returns null for an unparseable value', () => {
    expect(formatConductedAt('not-a-date')).toBeNull();
  });
});
