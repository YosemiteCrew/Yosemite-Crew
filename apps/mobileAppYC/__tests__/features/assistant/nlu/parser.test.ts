import {
  extractTaskTitle,
  matchPetName,
  parseAmount,
  parseUtterance,
} from '@/features/assistant/nlu/parser';
import {
  BARE_NAME_CONFIDENCE,
  RULES_CONFIDENCE_THRESHOLD,
} from '@/features/assistant/constants';

/** Thursday 15 January 2026, 10:30 local time. */
const NOW = new Date(2026, 0, 15, 10, 30, 0, 0);
const at = (
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
): string => new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString();

describe('matchPetName', () => {
  it('finds a single-word name anywhere in the utterance', () => {
    expect(matchPetName('when is the vaccine for Bruno?', ['Bruno'])).toBe(
      'Bruno',
    );
  });

  it('returns the name as spelled in the list, not as typed', () => {
    expect(matchPetName('WHERE IS bruno', ['Bruno'])).toBe('Bruno');
  });

  it('matches across accents so an unaccented typing still finds the pet', () => {
    expect(matchPetName('how is Oceane doing', ['Océane'])).toBe('Océane');
    expect(matchPetName('¿cómo está Océane?', ['Océane'])).toBe('Océane');
  });

  it('prefers the longest name so "Bella Rose" beats "Bella"', () => {
    expect(
      matchPetName('book a visit for Bella Rose', ['Bella', 'Bella Rose']),
    ).toBe('Bella Rose');
  });

  it('falls back to the short name when the two-word name is absent', () => {
    expect(
      matchPetName('book a visit for Bella', ['Bella', 'Bella Rose']),
    ).toBe('Bella');
  });

  it('requires both words of a two-word name to be present', () => {
    expect(matchPetName('how is Bella', ['Bella Rose'])).toBeUndefined();
  });

  it('matches a two-word name only on token boundaries', () => {
    expect(
      matchPetName('Isabella Rosewood came in today', ['Bella Rose']),
    ).toBeUndefined();
    expect(
      matchPetName('this is Bella Rosewood', ['Bella Rose']),
    ).toBeUndefined();
    expect(matchPetName('this is Bella Rose', ['Bella Rose'])).toBe(
      'Bella Rose',
    );
  });

  it('does not treat "max" as a pet when it is not in the list', () => {
    expect(matchPetName('give the max dose today', ['Bruno'])).toBeUndefined();
  });

  it('does treat "Max" as a pet when it IS in the list', () => {
    expect(matchPetName('give the max dose today', ['Max'])).toBe('Max');
  });

  it('returns undefined when the utterance has no word characters', () => {
    expect(matchPetName('   ???   ', ['Bruno'])).toBeUndefined();
  });

  it('returns undefined for an empty pet list', () => {
    expect(matchPetName('how is Bruno', [])).toBeUndefined();
  });

  it('skips a blank name in the list rather than matching everything', () => {
    expect(matchPetName('hello world', ['', 'Bruno'])).toBeUndefined();
  });
});

describe('parseAmount', () => {
  it('reads a bare integer', () => {
    expect(parseAmount('spent 45 at the vet')).toBe(45);
  });

  it('reads a currency-prefixed amount', () => {
    expect(parseAmount('$45')).toBe(45);
    expect(parseAmount('£20 for the vet')).toBe(20);
  });

  it('reads a decimal point', () => {
    expect(parseAmount('45.50')).toBe(45.5);
  });

  it('reads a decimal comma as a decimal point', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('€12,50')).toBe(12.5);
  });

  it('rejects zero', () => {
    expect(parseAmount('spent 0 today')).toBeUndefined();
  });

  it('rejects text with no digits at all', () => {
    expect(parseAmount('spent nothing on Bruno')).toBeUndefined();
    expect(parseAmount('')).toBeUndefined();
  });

  it('rejects a negative amount', () => {
    expect(parseAmount('spent -5')).toBeUndefined();
    expect(parseAmount('-12.50')).toBeUndefined();
    expect(parseAmount('- 5')).toBeUndefined();
  });

  it('takes the first number in the string', () => {
    expect(parseAmount('room 101 cost 45')).toBe(101);
  });

  it('keeps only two decimals of a longer fraction', () => {
    expect(parseAmount('$45.999')).toBe(45.99);
  });

  it('reads a thousands separator as a whole number', () => {
    expect(parseAmount('spent 1,234')).toBe(1234);
    expect(parseAmount('$1,234.50')).toBe(1234.5);
  });
});

describe('extractTaskTitle', () => {
  it('drops the lead-in, the pet name and the time phrase', () => {
    expect(
      extractTaskTitle(
        'remind me to give Bruno his heart pill tonight',
        'Bruno',
      ),
    ).toBe('give his heart pill');
  });

  it('keeps the whole phrase after "to" when there is no pet name', () => {
    expect(extractTaskTitle('remind me to walk the dog', undefined)).toBe(
      'walk the dog',
    );
  });

  it('strips the pet name case-insensitively', () => {
    expect(extractTaskTitle('remind me to brush BRUNO', 'Bruno')).toBe('brush');
  });

  it('uses the whole utterance when there is no "to", "para" or "que"', () => {
    expect(extractTaskTitle('reminder: feed the cat', undefined)).toBe(
      'reminder: feed the cat',
    );
  });

  it('splits on the Spanish "para"', () => {
    expect(
      extractTaskTitle('recordatorio para cepillar a Bruno hoy', 'Bruno'),
    ).toBe('cepillar a');
  });

  it('splits on the Spanish "que"', () => {
    expect(extractTaskTitle('recuérdame que dar la medicina', undefined)).toBe(
      'dar la medicina',
    );
  });

  it.each([
    ['remind me to book the groomer in 3 days', 'book the groomer'],
    ['remind me to trim the claws on Friday', 'trim the claws'],
    ['remind me to give the pill at 8pm', 'give the pill'],
    ['remind me to walk him this morning', 'walk him'],
    ['remind me to feed her tomorrow', 'feed her'],
    ['remind me to weigh him today', 'weigh him'],
  ])('strips the time phrase from %s', (text, expected) => {
    expect(extractTaskTitle(text, undefined)).toBe(expected);
  });

  it('strips an accented Spanish time phrase', () => {
    expect(
      extractTaskTitle('recuérdame dar la pastilla mañana', undefined),
    ).toBe('recuérdame dar la pastilla');
    expect(
      extractTaskTitle('recuérdame dar la pastilla esta mañana', undefined),
    ).toBe('recuérdame dar la pastilla');
  });

  it('strips a pet name carrying regex metacharacters', () => {
    expect(extractTaskTitle('remind me to groom C++ tonight', 'C++')).toBe(
      'groom',
    );
    expect(extractTaskTitle('remind me to brush Mr. B tonight', 'Mr. B')).toBe(
      'brush',
    );
  });

  it('strips a short pet name only on whole words, not inside a longer one', () => {
    expect(extractTaskTitle('remind me to call Alice about Al', 'Al')).toBe(
      'call Alice about',
    );
  });

  it('returns undefined when only the pet name and a time phrase remain', () => {
    expect(
      extractTaskTitle('remind me to Bruno tonight', 'Bruno'),
    ).toBeUndefined();
  });

  it('returns undefined when a single character is left', () => {
    expect(extractTaskTitle('remind me to x', undefined)).toBeUndefined();
  });
});

describe('parseUtterance routing', () => {
  const petNames = ['Bruno'];

  it.each([
    ['Book a vet visit for Bruno', 'bookAppointment'],
    ['Schedule an appointment for Bruno', 'bookAppointment'],
    ['Make an appointment', 'bookAppointment'],
    ['remind me to give Bruno his pill', 'addCareTask'],
    ['set a reminder for the flea drops', 'addCareTask'],
    ['add a task for the groomer', 'addCareTask'],
    ['create a task for the groomer', 'addCareTask'],
    ['add medication for Bruno', 'addCareTask'],
    ['log expense 45 for Bruno', 'logExpense'],
    ['add expense 45', 'logExpense'],
    ['record expense 45', 'logExpense'],
    ['I spent 45 at the vet', 'logExpense'],
    ['Is Bruno vaccinated?', 'vaccinationStatus'],
    ['when is the next vaccine', 'vaccinationStatus'],
    ['which vaccines does Bruno need', 'vaccinationStatus'],
    ['is the vaccination up to date', 'vaccinationStatus'],
    ['are the shots up to date', 'vaccinationStatus'],
    ['does he need a jab', 'vaccinationStatus'],
    ['Show my total expenses', 'expenseSummary'],
    ['what are my expenses', 'expenseSummary'],
    ['how is my spending', 'expenseSummary'],
    ['When is the next appointment for Bruno?', 'nextAppointment'],
    ['do we have an appointment', 'nextAppointment'],
    ['when is the vet visit', 'nextAppointment'],
    ['when should Bruno see the vet', 'nextAppointment'],
    ['what tasks are due today', 'upcomingTasks'],
    ['what is on the care plan', 'upcomingTasks'],
    ['what is on my todo list', 'upcomingTasks'],
    ['tell me about Bruno', 'petOverview'],
    ['show the overview', 'petOverview'],
    ['open the profile', 'petOverview'],
    ['How is Bruno doing?', 'petOverview'],
  ])('routes the English phrase %s to %s', (text, actionId) => {
    expect(parseUtterance(text, {petNames, now: NOW})?.actionId).toBe(actionId);
  });

  it.each([
    ['¿Puedes reservar una cita con el veterinario?', 'bookAppointment'],
    ['agendar una cita', 'bookAppointment'],
    ['Pedir cita para Bruno', 'bookAppointment'],
    ['Recuérdame dar la medicina hoy', 'addCareTask'],
    ['crear un recordatorio', 'addCareTask'],
    ['añadir una tarea', 'addCareTask'],
    ['Registrar un gasto de 30 euros', 'logExpense'],
    ['¿Bruno tiene las vacunas al día?', 'vaccinationStatus'],
    ['¿cuándo es la vacuna?', 'vaccinationStatus'],
    ['¿cuánto he gastado?', 'expenseSummary'],
    ['resumen de gastos', 'expenseSummary'],
    ['¿Cuándo es la próxima cita?', 'nextAppointment'],
    ['¿Qué tareas tengo pendientes?', 'upcomingTasks'],
    ['tengo algo pendiente', 'upcomingTasks'],
    ['Resumen de Bruno', 'petOverview'],
    ['ver el perfil', 'petOverview'],
  ])('routes the Spanish phrase %s to %s', (text, actionId) => {
    expect(parseUtterance(text, {petNames, now: NOW})?.actionId).toBe(actionId);
  });

  it('tags every rules answer with the rules source', () => {
    expect(parseUtterance('book an appointment')?.source).toBe('rules');
  });
});

describe('parseUtterance rule order', () => {
  it('routes "book an appointment" to bookAppointment, not nextAppointment', () => {
    expect(parseUtterance('book an appointment', {now: NOW})).toEqual({
      actionId: 'bookAppointment',
      slots: {},
      confidence: 0.737,
      source: 'rules',
    });
  });

  it('routes "pedir cita" to bookAppointment, not nextAppointment', () => {
    expect(parseUtterance('Pedir cita para Bruno', {now: NOW})?.actionId).toBe(
      'bookAppointment',
    );
  });

  it('routes "schedule an appointment" to bookAppointment', () => {
    expect(
      parseUtterance('Schedule an appointment for Bruno', {now: NOW})?.actionId,
    ).toBe('bookAppointment');
  });

  it('routes "add a task" to addCareTask, not upcomingTasks', () => {
    expect(
      parseUtterance('add a task for the groomer', {now: NOW})?.actionId,
    ).toBe('addCareTask');
  });

  it('routes "add expense" to logExpense, not expenseSummary', () => {
    expect(parseUtterance('add expense 45', {now: NOW})?.actionId).toBe(
      'logExpense',
    );
  });

  it('routes "how much have I spent" to expenseSummary, the read action', () => {
    expect(
      parseUtterance('How much have I spent on Bruno?', {now: NOW}),
    ).toEqual({
      actionId: 'expenseSummary',
      slots: {},
      confidence: 0.996,
      source: 'rules',
    });
  });

  it.each([
    ['log an expense', undefined],
    ['add an expense', undefined],
    ['record an expense', undefined],
    ['I spent 45 on food', 45],
  ])('still routes %s to logExpense', (text, amount) => {
    const parsed = parseUtterance(text, {now: NOW});
    expect(parsed?.actionId).toBe('logExpense');
    expect(parsed?.slots.amount).toBe(amount);
  });

  it('routes "remind me about the vaccine" to addCareTask, not vaccinationStatus', () => {
    expect(
      parseUtterance('remind me about the vaccine', {now: NOW})?.actionId,
    ).toBe('addCareTask');
  });
});

describe('parseUtterance slots', () => {
  it('fills petName and when for a booking', () => {
    expect(
      parseUtterance('Book a vet appointment for Bella Rose tomorrow at 3pm', {
        petNames: ['Bella', 'Bella Rose'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'bookAppointment',
      slots: {petName: 'Bella Rose', when: at(2026, 0, 16, 15)},
      confidence: 0.69,
      source: 'rules',
    });
  });

  it('fills petName, when and title for a reminder', () => {
    expect(
      parseUtterance('remind me to give Bruno his heart pill tonight', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'addCareTask',
      slots: {
        petName: 'Bruno',
        when: at(2026, 0, 15, 21),
        title: 'give his heart pill',
      },
      confidence: 0.692,
      source: 'rules',
    });
  });

  it('fills when and title for a Spanish reminder with no pet named', () => {
    expect(
      parseUtterance('Recuérdame dar la medicina hoy', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'addCareTask',
      slots: {when: at(2026, 0, 15, 9), title: 'Recuérdame dar la medicina'},
      confidence: 0.71,
      source: 'rules',
    });
  });

  it('leaves title unset when nothing survives the stripping', () => {
    expect(
      parseUtterance('remind me to Bruno tonight', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'addCareTask',
      slots: {petName: 'Bruno', when: at(2026, 0, 15, 21)},
      confidence: 0.71,
      source: 'rules',
    });
  });

  it('does not fill petName from a word that is not a known pet', () => {
    expect(
      parseUtterance('remind me to give Max his dose today', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'addCareTask',
      slots: {when: at(2026, 0, 15, 9), title: 'give Max his dose'},
      confidence: 0.695,
      source: 'rules',
    });
  });

  it('parses a pet name carrying regex metacharacters without throwing', () => {
    const parse = () =>
      parseUtterance('remind me to give C++ his pill tonight', {
        petNames: ['C++'],
        now: NOW,
      });

    expect(parse).not.toThrow();
    expect(parse()).toEqual({
      actionId: 'addCareTask',
      slots: {
        petName: 'C++',
        when: at(2026, 0, 15, 21),
        title: 'give his pill',
      },
      confidence: 0.695,
      source: 'rules',
    });
  });

  it('parses a pet name containing a full stop without throwing', () => {
    const parse = () =>
      parseUtterance('remind me to brush Mr. B tomorrow', {
        petNames: ['Mr. B'],
        now: NOW,
      });

    expect(parse).not.toThrow();
    expect(parse()).toEqual({
      actionId: 'addCareTask',
      slots: {
        petName: 'Mr. B',
        when: at(2026, 0, 16, 9),
        title: 'brush',
      },
      confidence: 0.699,
      source: 'rules',
    });
  });

  it('fills petName and amount for an expense', () => {
    expect(
      parseUtterance('log expense $45 for Bruno', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'logExpense',
      slots: {petName: 'Bruno', amount: 45},
      confidence: 0.87,
      source: 'rules',
    });
  });

  it('leaves amount unset when the expense carries no number', () => {
    expect(
      parseUtterance('log expense for Bruno', {petNames: ['Bruno'], now: NOW}),
    ).toEqual({
      actionId: 'logExpense',
      slots: {petName: 'Bruno'},
      confidence: 0.89,
      source: 'rules',
    });
  });

  it('fills amount for a Spanish expense', () => {
    expect(
      parseUtterance('Registrar un gasto de 30 euros', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'logExpense',
      slots: {amount: 30},
      confidence: 0.703,
      source: 'rules',
    });
  });

  it('does not fill title or amount for a read action', () => {
    expect(
      parseUtterance('what tasks are due today', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'upcomingTasks',
      slots: {when: at(2026, 0, 15, 9)},
      confidence: 0.71,
      source: 'rules',
    });
  });

  it('leaves when unset when the utterance carries no date', () => {
    expect(
      parseUtterance('Is Bruno vaccinated?', {petNames: ['Bruno'], now: NOW}),
    ).toEqual({
      actionId: 'vaccinationStatus',
      slots: {petName: 'Bruno'},
      confidence: 0.737,
      source: 'rules',
    });
  });

  it('matches the pet in a Spanish question', () => {
    expect(
      parseUtterance('¿Bruno tiene las vacunas al día?', {
        petNames: ['Bruno'],
        now: NOW,
      }),
    ).toEqual({
      actionId: 'vaccinationStatus',
      slots: {petName: 'Bruno'},
      confidence: 0.703,
      source: 'rules',
    });
  });

  it('defaults now to the current clock when no options are passed', () => {
    const parsed = parseUtterance('remind me to feed him tomorrow');
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    expected.setHours(9, 0, 0, 0);

    expect(parsed).toEqual({
      actionId: 'addCareTask',
      slots: {when: expected.toISOString(), title: 'feed him'},
      confidence: 0.703,
      source: 'rules',
    });
  });
});

describe('parseUtterance confidence', () => {
  it('scores a one-keyword hit in a long sentence lower than in a short one', () => {
    const long = parseUtterance(
      'Book a vet appointment for Bella Rose tomorrow at 3pm',
      {petNames: ['Bella Rose'], now: NOW},
    );
    const short = parseUtterance('book an appointment', {now: NOW});

    expect(long?.confidence).toBe(0.69);
    expect(short?.confidence).toBe(0.737);
  });

  it('scores a three-keyword hit that explains the whole sentence at the ceiling of 1', () => {
    expect(parseUtterance('tell me about', {now: NOW})?.confidence).toBe(1);
  });

  it('keeps every confidence inside (0, 1]', () => {
    const phrases = [
      'book an appointment',
      'remind me to give the pill tonight',
      'log expense 45',
      'Is Bruno vaccinated?',
      'Show my total expenses',
      'When is the next appointment?',
      'what tasks are due today',
      'tell me about Bruno',
    ];

    const confidences = phrases.map(
      phrase =>
        parseUtterance(phrase, {petNames: ['Bruno'], now: NOW})?.confidence,
    );

    expect(confidences).toEqual([
      0.737, 0.699, 0.923, 0.737, 0.89, 0.87, 0.71, 1,
    ]);
    confidences.forEach(confidence => {
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });
});

describe('parseUtterance fallbacks', () => {
  it('reads a bare known pet name as a request for that pet overview', () => {
    expect(parseUtterance('Bruno?', {petNames: ['Bruno'], now: NOW})).toEqual({
      actionId: 'petOverview',
      slots: {petName: 'Bruno'},
      confidence: BARE_NAME_CONFIDENCE,
      source: 'rules',
    });
  });

  it('allows stopwords around the bare pet name', () => {
    expect(parseUtterance('my Bruno', {petNames: ['Bruno'], now: NOW})).toEqual(
      {
        actionId: 'petOverview',
        slots: {petName: 'Bruno'},
        confidence: BARE_NAME_CONFIDENCE,
        source: 'rules',
      },
    );
  });

  it('reads a bare two-word pet name as an overview too', () => {
    expect(
      parseUtterance('Bella Rose', {petNames: ['Bella Rose'], now: NOW}),
    ).toEqual({
      actionId: 'petOverview',
      slots: {petName: 'Bella Rose'},
      confidence: BARE_NAME_CONFIDENCE,
      source: 'rules',
    });
  });

  it('scores the bare-name guess below the rules threshold so the model can overrule it', () => {
    const parsed = parseUtterance('Bruno?', {petNames: ['Bruno'], now: NOW});

    expect(parsed?.confidence).toBe(BARE_NAME_CONFIDENCE);
    expect(parsed?.confidence).toBeLessThan(RULES_CONFIDENCE_THRESHOLD);
  });

  it('returns null when the pet name is buried in words the parser cannot explain', () => {
    expect(
      parseUtterance('Bruno barks loudly', {petNames: ['Bruno'], now: NOW}),
    ).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['!!!', 'punctuation only'],
  ])('returns null for %s input (%s)', text => {
    expect(parseUtterance(text, {petNames: ['Bruno'], now: NOW})).toBeNull();
  });

  it('returns null for gibberish', () => {
    expect(
      parseUtterance('asdfgh qwerty zxcvb', {petNames: ['Bruno'], now: NOW}),
    ).toBeNull();
  });

  it('returns null when a known keyword is absent and no pet is known', () => {
    expect(parseUtterance('hello there', {now: NOW})).toBeNull();
  });
});
