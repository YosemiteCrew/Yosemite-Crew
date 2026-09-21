import {parseClockTime, parseWhen} from '@/features/assistant/nlu/dates';

/**
 * Tuesday 3 March 2026, 10:00 local time. Every assertion is made against
 * this fixed `now` so the suite never depends on the wall clock.
 */
const NOW = new Date(2026, 2, 3, 10, 0, 0);

/**
 * The module builds local times and hands back `toISOString()`, so results are
 * compared by round-tripping and reading the local getters rather than by
 * pinning a UTC literal that would only hold in one timezone.
 */
const localParts = (iso: string | null) => {
  if (iso === null) {
    throw new Error('expected an ISO timestamp, got null');
  }
  const parsed = new Date(iso);
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
    date: parsed.getDate(),
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
    seconds: parsed.getSeconds(),
    ms: parsed.getMilliseconds(),
  };
};

const at = (
  year: number,
  month: number,
  date: number,
  hours: number,
  minutes: number,
) => ({year, month, date, hours, minutes, seconds: 0, ms: 0});

describe('parseClockTime', () => {
  it('reads a 12-hour time with a pm meridiem', () => {
    expect(parseClockTime('8pm')).toEqual({hour: 20, minute: 0});
  });

  it('reads a 12-hour time with an am meridiem and a space', () => {
    expect(parseClockTime('8 am')).toEqual({hour: 8, minute: 0});
  });

  it('maps 12am to midnight and 12pm to noon', () => {
    expect(parseClockTime('12am')).toEqual({hour: 0, minute: 0});
    expect(parseClockTime('12pm')).toEqual({hour: 12, minute: 0});
  });

  it('finds the time inside a longer sentence', () => {
    expect(parseClockTime('give the tablet at 9 pm please')).toEqual({
      hour: 21,
      minute: 0,
    });
  });

  it('reads a bare hour when it follows "at"', () => {
    expect(parseClockTime('at 7')).toEqual({hour: 7, minute: 0});
  });

  it('does not treat a bare number as a time without "at"', () => {
    expect(parseClockTime('give 2 tablets')).toBeNull();
  });

  it('rejects an hour above 12 in front of a meridiem', () => {
    expect(parseClockTime('13pm')).toBeNull();
  });

  it('rejects a zero hour in front of a meridiem', () => {
    expect(parseClockTime('0am')).toBeNull();
  });

  it('rejects a bare hour after "at" that is not a valid hour', () => {
    expect(parseClockTime('at 25')).toBeNull();
  });

  it('returns null for text with no time in it', () => {
    expect(parseClockTime('walk the dog')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseClockTime('')).toBeNull();
  });

  it('rejects a meridiem time whose minutes are 60 or more', () => {
    // 8:75 is rejected outright rather than falling back to a bare 08:00.
    expect(parseClockTime('8:75 pm')).toBeNull();
  });

  /*
   * The separator carries the minutes, so `parseClockTime` normalises with
   * `normalizeKeepingClock`, which folds accents and case but keeps ":" and
   * ".". Both the minute-bearing meridiem form and the 24-hour form are read.
   */
  describe('minute-bearing and 24-hour times', () => {
    it('reads the minutes from a colon-separated "8:30 pm"', () => {
      expect(parseClockTime('8:30 pm')).toEqual({hour: 20, minute: 30});
    });

    it('reads the minutes from a dotted "8.30 pm"', () => {
      expect(parseClockTime('8.30 pm')).toEqual({hour: 20, minute: 30});
    });

    it('reads a bare 24-hour "20:30"', () => {
      expect(parseClockTime('20:30')).toEqual({hour: 20, minute: 30});
    });

    it('keeps the minutes in "at 7:45"', () => {
      expect(parseClockTime('at 7:45')).toEqual({hour: 7, minute: 45});
    });

    it('reads both the minutes and the meridiem in "at 8:30 pm"', () => {
      expect(parseClockTime('at 8:30 pm')).toEqual({hour: 20, minute: 30});
    });

    it('maps a minute-bearing 12am to just after midnight', () => {
      expect(parseClockTime('12:30 am')).toEqual({hour: 0, minute: 30});
    });

    it('maps a minute-bearing 12pm to just after noon', () => {
      expect(parseClockTime('12:45 pm')).toEqual({hour: 12, minute: 45});
    });

    it('reads a 24-hour hour of zero', () => {
      expect(parseClockTime('0:30')).toEqual({hour: 0, minute: 30});
    });

    it('prefers the 24-hour reading over the bare hour after "at"', () => {
      expect(parseClockTime('at 20:30')).toEqual({hour: 20, minute: 30});
    });

    it('falls back to the 24-hour reading when the hour is too big for a meridiem', () => {
      // "13" cannot be a 12-hour clock hour, so the pm is ignored and the
      // 24-hour rule supplies 13:30 rather than the whole phrase failing.
      expect(parseClockTime('13:30 pm')).toEqual({hour: 13, minute: 30});
    });

    it('rejects a 24-hour time with an hour above 23', () => {
      expect(parseClockTime('25:30')).toBeNull();
    });

    it('rejects a 24-hour time with minutes above 59', () => {
      expect(parseClockTime('20:70')).toBeNull();
    });
  });
});

describe('parseWhen relative day words', () => {
  it('resolves "tonight" to 21:00 today', () => {
    expect(localParts(parseWhen('tonight', NOW))).toEqual(
      at(2026, 2, 3, 21, 0),
    );
  });

  it('resolves "today" to the default 09:00, even when that is already past', () => {
    expect(localParts(parseWhen('today', NOW))).toEqual(at(2026, 2, 3, 9, 0));
  });

  it('resolves "tomorrow" to the default 09:00 the next day', () => {
    expect(localParts(parseWhen('tomorrow', NOW))).toEqual(
      at(2026, 2, 4, 9, 0),
    );
  });

  it('lets an explicit time override the default hour', () => {
    expect(localParts(parseWhen('tomorrow at 7', NOW))).toEqual(
      at(2026, 2, 4, 7, 0),
    );
  });

  it('carries the minutes of an explicit time onto the relative day', () => {
    expect(localParts(parseWhen('tomorrow at 8:30 pm', NOW))).toEqual(
      at(2026, 2, 4, 20, 30),
    );
  });

  it('lets a day part set the hour when there is no explicit time', () => {
    expect(localParts(parseWhen('tomorrow morning', NOW))).toEqual(
      at(2026, 2, 4, 8, 0),
    );
  });

  it('resolves "overmorrow" two days out', () => {
    expect(localParts(parseWhen('overmorrow', NOW))).toEqual(
      at(2026, 2, 5, 9, 0),
    );
  });

  it('returns an ISO string that round-trips exactly', () => {
    const result = parseWhen('tomorrow', NOW);
    expect(typeof result).toBe('string');
    expect(new Date(result as string).toISOString()).toBe(result);
  });
});

describe('parseWhen Spanish phrases', () => {
  it('resolves the accented "mañana" to tomorrow', () => {
    expect(localParts(parseWhen('mañana', NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  it('resolves the unaccented "manana" to tomorrow', () => {
    expect(localParts(parseWhen('manana', NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  it('resolves "hoy" to today', () => {
    expect(localParts(parseWhen('hoy', NOW))).toEqual(at(2026, 2, 3, 9, 0));
  });

  it('does not treat a bare "esta" as today', () => {
    expect(parseWhen('esta', NOW)).toBeNull();
  });

  it('treats "esta" as today once a day part qualifies it', () => {
    expect(localParts(parseWhen('esta night', NOW))).toEqual(
      at(2026, 2, 3, 21, 0),
    );
  });

  it('resolves "esta noche" to 21:00 today', () => {
    // DAY_PART_HOURS carries the Spanish parts of the day, so "noche" is a
    // day part and the "esta" guard lets the relative-day branch fire.
    expect(localParts(parseWhen('esta noche', NOW))).toEqual(
      at(2026, 2, 3, 21, 0),
    );
  });

  it('resolves "esta tarde" to 14:00 today', () => {
    expect(localParts(parseWhen('esta tarde', NOW))).toEqual(
      at(2026, 2, 3, 14, 0),
    );
  });

  it('resolves a bare "mediodia" to noon today', () => {
    expect(localParts(parseWhen('mediodia', NOW))).toEqual(
      at(2026, 2, 3, 12, 0),
    );
  });

  it('rolls "madrugada" to 06:00 tomorrow because it is already past', () => {
    expect(localParts(parseWhen('madrugada', NOW))).toEqual(
      at(2026, 2, 4, 6, 0),
    );
  });

  it('lets a Spanish day part set the hour on "manana"', () => {
    expect(localParts(parseWhen('manana por la tarde', NOW))).toEqual(
      at(2026, 2, 4, 14, 0),
    );
  });
});

describe('parseWhen relative offsets', () => {
  it('adds days for "in 3 days"', () => {
    expect(localParts(parseWhen('in 3 days', NOW))).toEqual(
      at(2026, 2, 6, 9, 0),
    );
  });

  it('accepts the singular "in 1 day"', () => {
    expect(localParts(parseWhen('in 1 day', NOW))).toEqual(
      at(2026, 2, 4, 9, 0),
    );
  });

  it('accepts the Spanish "in 3 dias"', () => {
    expect(localParts(parseWhen('in 3 dias', NOW))).toEqual(
      at(2026, 2, 6, 9, 0),
    );
  });

  it('lets an explicit time set the hour on the offset day', () => {
    expect(localParts(parseWhen('in 3 days at 8pm', NOW))).toEqual(
      at(2026, 2, 6, 20, 0),
    );
  });

  it('adds weeks for "in 2 weeks"', () => {
    expect(localParts(parseWhen('in 2 weeks', NOW))).toEqual(
      at(2026, 2, 17, 9, 0),
    );
  });

  it('accepts the Spanish "in 2 semanas"', () => {
    expect(localParts(parseWhen('in 2 semanas', NOW))).toEqual(
      at(2026, 2, 17, 9, 0),
    );
  });

  it('lets a day part set the hour on the offset week', () => {
    expect(localParts(parseWhen('in 2 weeks tonight', NOW))).toEqual(
      at(2026, 2, 17, 21, 0),
    );
  });

  it('adds hours for "in 5 hours" and zeroes the minutes', () => {
    expect(localParts(parseWhen('in 5 hours', NOW))).toEqual(
      at(2026, 2, 3, 15, 0),
    );
  });

  it('accepts the Spanish "in 2 horas"', () => {
    expect(localParts(parseWhen('in 2 horas', NOW))).toEqual(
      at(2026, 2, 3, 12, 0),
    );
  });

  it('rolls past midnight for "in 20 hours"', () => {
    expect(localParts(parseWhen('in 20 hours', NOW))).toEqual(
      at(2026, 2, 4, 6, 0),
    );
  });

  it('ignores a stated clock time on the hours branch', () => {
    expect(localParts(parseWhen('in 5 hours at 8pm', NOW))).toEqual(
      at(2026, 2, 3, 15, 0),
    );
  });

  it('prefers days over weeks when both could match', () => {
    expect(localParts(parseWhen('in 3 days in 2 weeks', NOW))).toEqual(
      at(2026, 2, 6, 9, 0),
    );
  });
});

describe('parseWhen weekday names', () => {
  // NOW is a Tuesday, so Friday is three days out.
  it('resolves an English weekday to the next one ahead', () => {
    expect(localParts(parseWhen('on friday', NOW))).toEqual(
      at(2026, 2, 6, 9, 0),
    );
  });

  it('resolves a Spanish weekday to the next one ahead', () => {
    expect(localParts(parseWhen('el viernes', NOW))).toEqual(
      at(2026, 2, 6, 9, 0),
    );
  });

  it('folds the accent in "miércoles"', () => {
    expect(localParts(parseWhen('miércoles', NOW))).toEqual(
      at(2026, 2, 4, 9, 0),
    );
  });

  it('wraps to the following week for a weekday earlier in this one', () => {
    expect(localParts(parseWhen('on monday', NOW))).toEqual(
      at(2026, 2, 9, 9, 0),
    );
  });

  it('sends a weekday equal to today a full week out, never to today', () => {
    expect(localParts(parseWhen('on tuesday', NOW))).toEqual(
      at(2026, 2, 10, 9, 0),
    );
  });

  it('sends the Spanish name of the current weekday a full week out too', () => {
    expect(localParts(parseWhen('el martes', NOW))).toEqual(
      at(2026, 2, 10, 9, 0),
    );
  });

  it('applies an explicit time to the weekday', () => {
    expect(localParts(parseWhen('friday 8pm', NOW))).toEqual(
      at(2026, 2, 6, 20, 0),
    );
  });

  it('applies a 24-hour time, minutes included, to the weekday', () => {
    expect(localParts(parseWhen('friday 20:30', NOW))).toEqual(
      at(2026, 2, 6, 20, 30),
    );
  });

  it('applies a day part to the weekday', () => {
    expect(localParts(parseWhen('friday evening', NOW))).toEqual(
      at(2026, 2, 6, 19, 0),
    );
  });

  it('prefers a relative day word over a weekday name', () => {
    expect(localParts(parseWhen('tomorrow not friday', NOW))).toEqual(
      at(2026, 2, 4, 9, 0),
    );
  });
});

describe('parseWhen bare clock times', () => {
  it('keeps a time still ahead of now on today', () => {
    expect(localParts(parseWhen('8pm', NOW))).toEqual(at(2026, 2, 3, 20, 0));
  });

  it('rolls a time already past today to tomorrow', () => {
    expect(localParts(parseWhen('8am', NOW))).toEqual(at(2026, 2, 4, 8, 0));
  });

  it('rolls a time exactly equal to now to tomorrow', () => {
    expect(localParts(parseWhen('at 10', NOW))).toEqual(at(2026, 2, 4, 10, 0));
  });

  it('schedules "at 8:30 pm" for 20:30 today, minutes and meridiem intact', () => {
    expect(localParts(parseWhen('at 8:30 pm', NOW))).toEqual(
      at(2026, 2, 3, 20, 30),
    );
  });

  it('rolls "at 8:30 am" to 08:30 tomorrow because it is already past', () => {
    expect(localParts(parseWhen('at 8:30 am', NOW))).toEqual(
      at(2026, 2, 4, 8, 30),
    );
  });

  it('keeps the minutes of a 24-hour time', () => {
    expect(localParts(parseWhen('20:30', NOW))).toEqual(at(2026, 2, 3, 20, 30));
  });
});

describe('parseWhen day parts with no day', () => {
  it('keeps a day part still ahead of now on today', () => {
    expect(localParts(parseWhen('in the evening', NOW))).toEqual(
      at(2026, 2, 3, 19, 0),
    );
  });

  it('resolves the afternoon to 14:00 today', () => {
    expect(localParts(parseWhen('in the afternoon', NOW))).toEqual(
      at(2026, 2, 3, 14, 0),
    );
  });

  it('resolves noon to 12:00 today', () => {
    expect(localParts(parseWhen('at noon', NOW))).toEqual(
      at(2026, 2, 3, 12, 0),
    );
  });

  it('rolls a day part already past today to tomorrow', () => {
    expect(localParts(parseWhen('in the morning', NOW))).toEqual(
      at(2026, 2, 4, 8, 0),
    );
  });

  it('rolls midnight to the start of tomorrow', () => {
    expect(localParts(parseWhen('midnight', NOW))).toEqual(
      at(2026, 2, 4, 0, 0),
    );
  });

  it('does not read "night" out of the middle of "tonight"', () => {
    // "tonight" must resolve through the relative-day branch (today 21:00),
    // not through a bare day part that would roll to tomorrow.
    expect(localParts(parseWhen('tonight', NOW))).toEqual(
      at(2026, 2, 3, 21, 0),
    );
  });
});

describe('parseWhen clock times with no am or pm beside a day part', () => {
  it('reads "at 8 tonight" as 20:00 today, not 08:00', () => {
    expect(localParts(parseWhen('at 8 tonight', NOW))).toEqual(
      at(2026, 2, 3, 20, 0),
    );
  });

  it('reads "tomorrow evening at 7" as 19:00 tomorrow', () => {
    expect(localParts(parseWhen('tomorrow evening at 7', NOW))).toEqual(
      at(2026, 2, 4, 19, 0),
    );
  });

  it('reads "at 9:30 in the evening" as 21:30 today, with no day named', () => {
    expect(localParts(parseWhen('at 9:30 in the evening', NOW))).toEqual(
      at(2026, 2, 3, 21, 30),
    );
  });

  it('reads the Spanish "esta tarde at 4" as 16:00 today', () => {
    expect(localParts(parseWhen('esta tarde at 4', NOW))).toEqual(
      at(2026, 2, 3, 16, 0),
    );
  });

  it('keeps "at 7 in the morning" in the morning', () => {
    expect(localParts(parseWhen('at 7 in the morning', NOW))).toEqual(
      at(2026, 2, 4, 7, 0),
    );
  });

  it('keeps an explicit am even beside an evening day part', () => {
    expect(localParts(parseWhen('tomorrow evening at 6am', NOW))).toEqual(
      at(2026, 2, 4, 6, 0),
    );
  });

  it('keeps a 24-hour time beside a night day part', () => {
    expect(localParts(parseWhen('tonight at 20:15', NOW))).toEqual(
      at(2026, 2, 3, 20, 15),
    );
  });

  it('keeps 12 as said rather than guessing noon or midnight', () => {
    expect(localParts(parseWhen('tomorrow night at 12', NOW))).toEqual(
      at(2026, 2, 4, 12, 0),
    );
  });
});

describe('parseWhen with no date in the text', () => {
  it('returns null for an empty string', () => {
    expect(parseWhen('', NOW)).toBeNull();
  });

  it('returns null for punctuation that normalises away', () => {
    expect(parseWhen('   !!!  ', NOW)).toBeNull();
  });

  it('returns null for a quantity that is not a time', () => {
    expect(parseWhen('give 2 tablets', NOW)).toBeNull();
  });

  it('returns null for an ordinary sentence', () => {
    expect(parseWhen('refill the water bowl', NOW)).toBeNull();
  });
});

describe('parseWhen same-day phrases already past', () => {
  // A day part supplies an implied hour, so a past one is rolled forward
  // rather than scheduling a reminder in the past.
  const LATE = new Date(2026, 2, 3, 23, 0, 0);

  it('rolls "tonight" to tomorrow when 21:00 has already passed', () => {
    expect(localParts(parseWhen('tonight', LATE) as string)).toEqual(
      at(2026, 2, 4, 21, 0),
    );
  });

  it('rolls "esta noche" to tomorrow when 21:00 has already passed', () => {
    expect(localParts(parseWhen('esta noche', LATE) as string)).toEqual(
      at(2026, 2, 4, 21, 0),
    );
  });

  it('keeps "tonight" on the same day while 21:00 is still ahead', () => {
    const early = new Date(2026, 2, 3, 10, 0, 0);
    expect(localParts(parseWhen('tonight', early) as string)).toEqual(
      at(2026, 2, 3, 21, 0),
    );
  });

  it('honours an explicit time on the named day even once it has passed', () => {
    // The owner said both the day and the hour; a handoff shows the date on a
    // form they can edit, so their words are not second-guessed.
    expect(localParts(parseWhen('today at 8am', LATE) as string)).toEqual(
      at(2026, 2, 3, 8, 0),
    );
  });

  it('honours a bare "today" at the default hour even once it has passed', () => {
    expect(localParts(parseWhen('today', LATE) as string)).toEqual(
      at(2026, 2, 3, 9, 0),
    );
  });
});

/*
 * A dose is not a clock time.
 *
 * "0.25 ml" and "1.25 mg" are among the commonest things an owner says, and
 * the dot reads as a clock separator just as happily as a decimal point. The
 * fraction only has to land in 00-59 to pass as minutes - .25, .30 and .50 all
 * do - so the dose became the hour and the reminder was scheduled for
 * twenty-five past midnight instead of the 09:00 default.
 */
describe('parseWhen does not read a measured dose as a clock time', () => {
  it('keeps the default hour when the only dotted number is a dose', () => {
    expect(
      localParts(
        parseWhen('remind me to give Max 0.25 ml of metacam tomorrow', NOW),
      ),
    ).toEqual(at(2026, 2, 4, 9, 0));
  });

  it.each([
    ['millilitres', 'give 0.25 ml tomorrow'],
    ['milligrams', 'give 1.25 mg tomorrow'],
    ['micrograms', 'give 2.50 mcg tomorrow'],
    ['tablets', 'give 1.30 tablets tomorrow'],
    ['cubic centimetres', 'give 0.50 cc tomorrow'],
  ])('ignores a dose measured in %s', (_unit, text) => {
    expect(localParts(parseWhen(text, NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  it('still reads a time said after a dose', () => {
    expect(
      localParts(parseWhen('give 0.25 ml at 20.30 tomorrow', NOW)),
    ).toEqual(at(2026, 2, 4, 20, 30));
  });

  it('reads a time said after a candidate with no readable minute', () => {
    // No unit follows "0.75", so the unit guard does not skip it - it is
    // dropped by the hour/minute check instead, which must not stop the scan
    // either. Giving up on the first unreadable candidate loses the 20.30
    // that was actually said.
    expect(
      localParts(parseWhen('give 0.75 of a tablet at 20.30 tomorrow', NOW)),
    ).toEqual(at(2026, 2, 4, 20, 30));
  });

  it('does not mistake a word that starts with a unit for the unit', () => {
    // "go" is not the unit "g": the guard requires a word boundary, or a real
    // time would be thrown away whenever the next word happened to start with
    // a unit letter.
    expect(
      localParts(parseWhen('walk him at 20.30 go out tomorrow', NOW)),
    ).toEqual(at(2026, 2, 4, 20, 30));
  });

  it('reads no time at all from a bare dose', () => {
    expect(parseClockTime('give 0.25 ml')).toBeNull();
  });
});

/*
 * A dotted number is only a clock time when something says it is.
 *
 * The unit guard above only fires when a unit follows, so every dose said
 * without one - "0.50 of his heart pill", "a 2.50 dose" - still became the
 * hour, and so did a price: "spent 12.50 on food" scheduled 12:50. A dot is a
 * decimal point far more often than a clock separator here, so the dot form
 * now carries the preposition requirement a bare hour already had. A colon
 * keeps needing no evidence, because nobody writes a dose or a price with one.
 */
describe('parseWhen reads a dotted number as a time only when introduced', () => {
  it.each([
    ['no unit follows the dose', 'give 0.50 of his heart pill tomorrow'],
    ['the unit is elided', 'give 1.25 of the tablet tomorrow'],
    ['the quantity qualifies a noun', 'give half a 2.50 dose tomorrow'],
    ['the number is a price', 'spent 12.50 on food tomorrow'],
    ['the price has a clock-shaped hour', 'spent 20.30 on food tomorrow'],
  ])('keeps the default hour when %s', (_case, text) => {
    expect(localParts(parseWhen(text, NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  /*
   * A preposition a quantity can also follow is no evidence at all.
   *
   * The first cut of this guard accepted "around", "before", "after" and
   * "by". Every one of them introduces an amount as readily as a time -
   * "spent around 12.50", "reduce his dose by 0.50" - and "around" is the
   * commonest hedge English puts in front of a price or a dose, so the list
   * let both headline failures straight back in.
   */
  it.each([
    ['around hedges a price', 'spent around 12.50 on food tomorrow'],
    [
      'around hedges a dose',
      'give Bruno around 0.50 of his heart pill tomorrow',
    ],
    ['before precedes a dose', 'give Bruno before 1.25 of the tablet tomorrow'],
    ['after precedes a dose', 'give Bruno after 1.25 of the tablet tomorrow'],
    [
      'by introduces a reduction',
      'remind me to reduce his dose by 0.50 tomorrow',
    ],
    ['by introduces an increase', 'increase the dose by 1.25 tomorrow'],
  ])('keeps the default hour when %s', (_case, text) => {
    expect(localParts(parseWhen(text, NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  it.each([
    ['at', 'walk him at 20.30 tomorrow'],
    ['until', 'keep him in until 20.30 tomorrow'],
    ['till', 'keep him in till 20.30 tomorrow'],
    ['the Spanish "a las"', 'pasear a las 20.30 manana'],
  ])('still reads a time introduced by %s', (_case, text) => {
    expect(localParts(parseWhen(text, NOW))).toEqual(at(2026, 2, 4, 20, 30));
  });

  it('still reads a colon time with no preposition at all', () => {
    // The colon carries its own evidence, so requiring a preposition there
    // would throw away a time nothing else could rescue.
    expect(localParts(parseWhen('walk him 20:30 tomorrow', NOW))).toEqual(
      at(2026, 2, 4, 20, 30),
    );
  });

  it('reads the time after a price rather than the price itself', () => {
    expect(
      localParts(parseWhen('spent 12.50 on food at 20.30 tomorrow', NOW)),
    ).toEqual(at(2026, 2, 4, 20, 30));
  });
});

/*
 * A time preposition is no evidence when the number is an amount.
 *
 * The preposition requirement was meant to select words a quantity cannot
 * follow, but "at", "until" and "till" all introduce a target amount in
 * ordinary titration language - "set his dose at 0.50 of a tablet", "titrate
 * until 1.25" - so the dose became the hour again on the owner-facing path.
 * The dot is now read as a clock separator only when the hour is one nothing
 * but a clock uses; below that the colon and meridiem forms carry the time.
 */
describe('parseWhen does not read a dotted amount introduced by a time preposition', () => {
  it.each([
    ['at, with the unit elided', 'set his dose at 0.50 of a tablet tomorrow'],
    ['at, with no continuation at all', 'keep his dose at 1.25 tomorrow'],
    ['until', 'titrate until 0.50 of a tablet tomorrow'],
    ['till', 'titrate till 0.50 of a tablet tomorrow'],
    ['until, on a whole-number hour', 'reduce until 1.25 of a tablet tomorrow'],
  ])('keeps the default hour when the amount follows %s', (_case, text) => {
    expect(localParts(parseWhen(text, NOW))).toEqual(at(2026, 2, 4, 9, 0));
  });

  it('does not reread the integer part of the amount as a bare hour', () => {
    // Refusing the dotted candidate is not enough on its own: "at 0.50" still
    // offers "at 0" to the bare-hour rule, which scheduled the dose for
    // midnight instead of leaving the visible 09:00 default.
    expect(parseClockTime('set his dose at 0.50 of a tablet')).toBeNull();
  });

  it('still refuses a rate whose hour a clock could use', () => {
    // The clock-only hour cannot separate this one: an infusion rate is said
    // with the same preposition and lands in 13-23 as readily as a time, so
    // the unit that follows is the only thing that marks it as a quantity.
    expect(
      localParts(parseWhen('infuse at 16.50 ml per hour tomorrow', NOW)),
    ).toEqual(at(2026, 2, 4, 9, 0));
  });

  it('still reads an hour only a clock uses', () => {
    expect(localParts(parseWhen('walk him at 20.30 tomorrow', NOW))).toEqual(
      at(2026, 2, 4, 20, 30),
    );
  });
});
