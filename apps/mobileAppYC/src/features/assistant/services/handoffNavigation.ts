/**
 * Turns an assistant deep link into a navigation target.
 *
 * Kept as a pure mapping so the routing is unit-testable without a navigator,
 * and so the same table serves both an in-app handoff and a cold start from
 * Siri or an Android shortcut, which arrive as the identical URL.
 */
import type {TabParamList} from '@/navigation/types';
import {trimEndWhile} from '../utils/trimEdges';

export interface HandoffTarget {
  tab: keyof TabParamList;
  screen: string;
  params?: Record<string, unknown>;
  /** Nested navigator hop, used by the expenses stack under the home tab. */
  nested?: {screen: string; params?: Record<string, unknown>};
}

/**
 * Percent-decodes a query fragment, tolerating malformed input.
 *
 * `yc://app` is an exported deep link, so any installed app can hand us a
 * link, and `decodeURIComponent` throws a URIError on a stray '%'. That threw
 * out of the parser and surfaced as an unhandled rejection in the deep-link
 * handler, so a malformed value is kept verbatim instead.
 */
const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Only this app's own scheme and host are accepted. */
const LINK_PREFIX = 'yc://app';

/** Splits `a=1&b=2` into a map, tolerating malformed pairs. */
const parseQuery = (query: string): Record<string, string> => {
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) {
      continue;
    }
    // Split on the FIRST '=' only: `split('=')` discarded everything after
    // a second one, silently corrupting any value containing '='.
    const separator = pair.indexOf('=');
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? '' : pair.slice(separator + 1);
    if (!rawKey) {
      continue;
    }
    // In a form-encoded query '+' means a space on both sides of the '='.
    params[safeDecode(rawKey.replaceAll('+', ' '))] = safeDecode(
      rawValue.replaceAll('+', ' '),
    );
  }
  return params;
};

/** Extracts the path and query of a `yc://app/...` link. */
export const parseAssistantLink = (
  link: string,
): {path: string; params: Record<string, string>} | null => {
  const trimmed = link.trim();
  if (!trimmed.startsWith(LINK_PREFIX)) {
    return null;
  }

  const remainder = trimmed.slice(LINK_PREFIX.length);
  const queryStart = remainder.indexOf('?');
  const rawPath =
    queryStart === -1 ? remainder : remainder.slice(0, queryStart);
  const query = queryStart === -1 ? '' : remainder.slice(queryStart + 1);

  // Anything between the host and the path separator would be a different
  // host ("yc://appstore/..."), not a path on ours.
  if (rawPath.length > 0 && !rawPath.startsWith('/')) {
    return null;
  }

  const path = trimEndWhile(rawPath, char => char === '/') || '/';
  return {path, params: parseQuery(query)};
};

/**
 * Maps a link to a target.
 *
 * Unknown paths return null so an unrecognised link lands the user nowhere
 * rather than on an arbitrary screen.
 */
export const resolveHandoffTarget = (link: string): HandoffTarget | null => {
  const parsed = parseAssistantLink(link);
  if (!parsed) {
    return null;
  }

  const {path, params} = parsed;

  if (path === '/tasks/new') {
    return {
      tab: 'Tasks',
      screen: 'AddTask',
      params: {
        // The add-task form takes a date, not a timestamp.
        prefillDate: params.when ? params.when.slice(0, 10) : undefined,
      },
    };
  }

  if (path === '/expenses/new') {
    return {
      tab: 'HomeStack',
      screen: 'ExpensesStack',
      nested: {screen: 'AddExpense'},
    };
  }

  if (path === '/appointments/book') {
    return {
      tab: 'Appointments',
      screen: 'BrowseBusinesses',
      params: {autoFocusSearch: true},
    };
  }

  if (path === '/assistant') {
    return {tab: 'HomeStack', screen: 'Assistant'};
  }

  return null;
};
