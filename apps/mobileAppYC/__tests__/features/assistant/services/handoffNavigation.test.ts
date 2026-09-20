import {
  parseAssistantLink,
  resolveHandoffTarget,
} from '@/features/assistant/services/handoffNavigation';
import * as dateHelpers from '@/shared/utils/dateHelpers';

describe('parseAssistantLink', () => {
  it('treats a bare yc://app as the root path with no params', () => {
    expect(parseAssistantLink('yc://app')).toEqual({path: '/', params: {}});
  });

  it('keeps the path and returns empty params when there is no query', () => {
    expect(parseAssistantLink('yc://app/tasks/new')).toEqual({
      path: '/tasks/new',
      params: {},
    });
  });

  it('splits the query into key/value pairs', () => {
    expect(
      parseAssistantLink('yc://app/tasks/new?when=2026-09-10&pet=bruno'),
    ).toEqual({
      path: '/tasks/new',
      params: {when: '2026-09-10', pet: 'bruno'},
    });
  });

  it('percent-decodes both keys and values', () => {
    expect(
      parseAssistantLink('yc://app/tasks/new?pet%20name=Mr%2E%20Bruno'),
    ).toEqual({
      path: '/tasks/new',
      params: {'pet name': 'Mr. Bruno'},
    });
  });

  it('decodes "+" in a value as a space', () => {
    expect(
      parseAssistantLink('yc://app/tasks/new?title=book+a+vet+visit'),
    ).toEqual({
      path: '/tasks/new',
      params: {title: 'book a vet visit'},
    });
  });

  it('decodes "+" as a space in the key as well as the value', () => {
    expect(parseAssistantLink('yc://app/x?a+b=c+d')).toEqual({
      path: '/x',
      params: {'a b': 'c d'},
    });
  });

  it('decodes "+" in a key that has no value', () => {
    expect(parseAssistantLink('yc://app/x?flag+two')).toEqual({
      path: '/x',
      params: {'flag two': ''},
    });
  });

  it('skips an empty pair produced by a doubled ampersand', () => {
    expect(parseAssistantLink('yc://app/x?a=1&&b=2')).toEqual({
      path: '/x',
      params: {a: '1', b: '2'},
    });
  });

  it('skips a pair whose key is empty', () => {
    expect(parseAssistantLink('yc://app/x?=orphan&a=1')).toEqual({
      path: '/x',
      params: {a: '1'},
    });
  });

  it('gives a key with no "=" an empty-string value', () => {
    expect(parseAssistantLink('yc://app/x?flag')).toEqual({
      path: '/x',
      params: {flag: ''},
    });
  });

  it('splits on the first "=" only, so a value may contain further "=" signs', () => {
    expect(parseAssistantLink('yc://app/x?a=b=c')).toEqual({
      path: '/x',
      params: {a: 'b=c'},
    });
  });

  it('keeps a trailing "=" as part of a base64-ish value', () => {
    expect(parseAssistantLink('yc://app/x?token=YWJjZA==&a=1')).toEqual({
      path: '/x',
      params: {token: 'YWJjZA==', a: '1'},
    });
  });

  it('gives a key followed by a bare "=" an empty-string value', () => {
    expect(parseAssistantLink('yc://app/x?a=')).toEqual({
      path: '/x',
      params: {a: ''},
    });
  });

  it('returns empty params for a "?" with nothing after it', () => {
    expect(parseAssistantLink('yc://app/x?')).toEqual({path: '/x', params: {}});
  });

  it('strips a trailing slash from the path', () => {
    expect(parseAssistantLink('yc://app/tasks/new/')).toEqual({
      path: '/tasks/new',
      params: {},
    });
  });

  it('strips a run of trailing slashes from the path', () => {
    expect(parseAssistantLink('yc://app/tasks/new///?a=1')).toEqual({
      path: '/tasks/new',
      params: {a: '1'},
    });
  });

  it('collapses a lone "/" back to the root path', () => {
    expect(parseAssistantLink('yc://app/')).toEqual({path: '/', params: {}});
  });

  it('trims surrounding whitespace before matching', () => {
    expect(parseAssistantLink('  yc://app/assistant  ')).toEqual({
      path: '/assistant',
      params: {},
    });
  });

  it('returns null for a non-matching scheme', () => {
    expect(parseAssistantLink('https://app/tasks/new')).toBeNull();
  });

  it('returns null for a host that merely starts with "app"', () => {
    expect(parseAssistantLink('yc://apples/tasks')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseAssistantLink('')).toBeNull();
  });
});

describe('resolveHandoffTarget', () => {
  it('routes /tasks/new to the add-task screen with an ISO "when" read as a local day', () => {
    const when = new Date(2026, 8, 10, 9, 30).toISOString();
    expect(resolveHandoffTarget(`yc://app/tasks/new?when=${when}`)).toEqual({
      tab: 'Tasks',
      screen: 'AddTask',
      params: {prefillDate: '2026-09-10'},
    });
  });

  describe('reading "when" on the device clock, not the UTC day', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // Jest's sandboxed process.env does not reach the timezone the runtime
    // uses, so the zone cannot be pinned per test. These cases instead fail
    // for a UTC slice wherever the runner is: the spy in every zone, the
    // round trips in any zone that is not UTC.
    it('formats the exact instant in local time rather than slicing the string', () => {
      const format = jest
        .spyOn(dateHelpers, 'formatDateToISODate')
        .mockReturnValue('local-day');
      // 21:00 on 10 September in Los Angeles is 04:00Z on the 11th.
      const when = '2026-09-11T04:00:00.000Z';

      expect(
        resolveHandoffTarget(`yc://app/tasks/new?when=${when}`)?.params,
      ).toEqual({prefillDate: 'local-day'});
      expect(format).toHaveBeenCalledTimes(1);
      expect(format.mock.calls[0][0].getTime()).toBe(Date.parse(when));
    });

    it.each([
      ['just after local midnight', 0, 30],
      ['just before local midnight', 23, 30],
    ])('keeps a "when" %s on the local day', (_label, hours, minutes) => {
      const when = new Date(2026, 8, 10, hours, minutes).toISOString();
      expect(
        resolveHandoffTarget(`yc://app/tasks/new?when=${when}`)?.params,
      ).toEqual({prefillDate: '2026-09-10'});
    });
  });

  it('leaves prefillDate undefined when "when" is not a date', () => {
    expect(
      resolveHandoffTarget('yc://app/tasks/new?when=tomorrow')?.params,
    ).toEqual({prefillDate: undefined});
  });

  it('passes an already-date-only "when" through unchanged', () => {
    expect(resolveHandoffTarget('yc://app/tasks/new?when=2026-12-01')).toEqual({
      tab: 'Tasks',
      screen: 'AddTask',
      params: {prefillDate: '2026-12-01'},
    });
  });

  it('leaves prefillDate undefined when "when" is absent', () => {
    const target = resolveHandoffTarget('yc://app/tasks/new');
    expect(target).toEqual({
      tab: 'Tasks',
      screen: 'AddTask',
      params: {prefillDate: undefined},
    });
    // The key is still present, it simply carries no value.
    expect(target?.params).toHaveProperty('prefillDate', undefined);
    expect(Object.keys(target?.params ?? {})).toEqual(['prefillDate']);
  });

  it('leaves prefillDate undefined when "when" is present but empty', () => {
    expect(resolveHandoffTarget('yc://app/tasks/new?when=')?.params).toEqual({
      prefillDate: undefined,
    });
    expect(
      resolveHandoffTarget('yc://app/tasks/new?when=')?.params?.prefillDate,
    ).toBeUndefined();
  });

  it('ignores query params other than "when" on /tasks/new', () => {
    expect(
      resolveHandoffTarget('yc://app/tasks/new?pet=bruno&title=vet'),
    ).toEqual({
      tab: 'Tasks',
      screen: 'AddTask',
      params: {prefillDate: undefined},
    });
  });

  it('routes /expenses/new through the nested expenses stack under the home tab', () => {
    expect(resolveHandoffTarget('yc://app/expenses/new')).toEqual({
      tab: 'HomeStack',
      screen: 'ExpensesStack',
      nested: {screen: 'AddExpense'},
    });
  });

  it('routes /appointments/book to browse with search auto-focused', () => {
    expect(resolveHandoffTarget('yc://app/appointments/book')).toEqual({
      tab: 'Appointments',
      screen: 'BrowseBusinesses',
      params: {autoFocusSearch: true},
    });
  });

  it('routes /assistant to the assistant screen with no params', () => {
    expect(resolveHandoffTarget('yc://app/assistant')).toEqual({
      tab: 'HomeStack',
      screen: 'Assistant',
    });
  });

  it('resolves a route despite a trailing slash', () => {
    expect(resolveHandoffTarget('yc://app/appointments/book/')).toEqual({
      tab: 'Appointments',
      screen: 'BrowseBusinesses',
      params: {autoFocusSearch: true},
    });
  });

  it('returns null for a known-looking but unmapped path', () => {
    expect(resolveHandoffTarget('yc://app/tasks/edit')).toBeNull();
  });

  it('returns null for the root path', () => {
    expect(resolveHandoffTarget('yc://app')).toBeNull();
  });

  it('returns null when the link does not parse at all', () => {
    expect(resolveHandoffTarget('yosemite://app/assistant')).toBeNull();
  });
});

describe('parseAssistantLink malformed input', () => {
  // yc://app is an exported deep link, so any installed app can hand us one.
  // decodeURIComponent throws a URIError on a stray '%', which used to escape
  // the parser and surface as an unhandled rejection in the deep-link handler.
  it('keeps a malformed percent escape verbatim instead of throwing', () => {
    expect(parseAssistantLink('yc://app/tasks/new?title=%')).toEqual({
      path: '/tasks/new',
      params: {title: '%'},
    });
  });

  it('keeps a malformed percent escape in a key verbatim', () => {
    expect(parseAssistantLink('yc://app/x?%ZZ=1')).toEqual({
      path: '/x',
      params: {'%ZZ': '1'},
    });
  });

  it('still decodes the valid pairs alongside a malformed one', () => {
    expect(parseAssistantLink('yc://app/x?bad=%&good=a%20b')).toEqual({
      path: '/x',
      params: {bad: '%', good: 'a b'},
    });
  });

  it('routes a link carrying a malformed value rather than throwing', () => {
    expect(resolveHandoffTarget('yc://app/appointments/book?pet=%')).toEqual({
      tab: 'Appointments',
      screen: 'BrowseBusinesses',
      params: {autoFocusSearch: true},
    });
  });
});
