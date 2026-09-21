'use strict';

// Chromium reports a failed load as a numeric net error. A tab that lost its
// connection and a tab whose page is broken are different things to a user -
// the first is "you're offline", the second is a page error - but `did-fail-load`
// gives both the same shape, so the tab bar drew the red error badge for both
// and the offline badge it already had CSS for was never reached.
//
// Only genuinely network-class codes belong here. ERR_FAILED (-2) is the
// catch-all Chromium falls back to and says nothing about the network;
// TLS, HTTP and content errors (ERR_EMPTY_RESPONSE, ERR_CERT_*) mean the host
// WAS reached, and ERR_CONNECTION_ABORTED (-103) is mostly a cancelled
// navigation rather than a lost link - none of them belong here.
const NETWORK_ERROR_CODES: Record<number, string> = {
  [-21]: 'ERR_NETWORK_CHANGED',
  [-100]: 'ERR_CONNECTION_CLOSED',
  [-101]: 'ERR_CONNECTION_RESET',
  [-102]: 'ERR_CONNECTION_REFUSED',
  [-104]: 'ERR_CONNECTION_FAILED',
  [-105]: 'ERR_NAME_NOT_RESOLVED',
  [-106]: 'ERR_INTERNET_DISCONNECTED',
  [-109]: 'ERR_ADDRESS_UNREACHABLE',
  [-118]: 'ERR_CONNECTION_TIMED_OUT',
  [-130]: 'ERR_PROXY_CONNECTION_FAILED',
  [-137]: 'ERR_NAME_RESOLUTION_FAILED',
  [-138]: 'ERR_NETWORK_ACCESS_DENIED',
};

export const networkErrorName = (code: number): string | null => NETWORK_ERROR_CODES[code] ?? null;

export const isNetworkError = (code: number): boolean => networkErrorName(code) !== null;

// The two badge-bearing fields of a tab, derived from one failed load. Exactly
// one of them is ever set, so a tab never shows both badges.
export const loadFailureMeta = (
  code: number,
  description: string
): {
  error: string | null;
  offline: boolean;
} =>
  isNetworkError(code) ? { error: null, offline: true } : { error: description, offline: false };
