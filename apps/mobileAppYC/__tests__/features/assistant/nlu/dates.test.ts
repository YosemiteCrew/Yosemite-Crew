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
