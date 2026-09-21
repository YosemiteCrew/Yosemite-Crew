'use strict';

// Copy decisions for the Preferences page: what the sync row says, and what the
// status line says after a save.
//
// This is a plain browser script rather than a module under src/: the local
// pages load it over file:// under a strict CSP, and the sandboxed preload
// cannot require a compiled module either, so a shared TypeScript module would
// reach neither. The unit tests require this file directly. Same arrangement as
// platform-labels.js.
(function (root) {
  // The separator the Update channel hint already uses, so the two rows match.
  const SEP = ' · ';

  /*
   * What the row says when there is nothing queued. "pending" keeps a label of
   * its own rather than falling back to "Up to date": the state means local
   * changes exist, and a count of zero only means the queue has not been
   * measured yet.
   */
  const STATE_LABELS = {
    idle: 'Up to date',
    pending: 'Pending local changes',
    offline: 'Offline',
    error: 'Last sync failed',
    blocked: 'Waiting for sync endpoint',
    'not-ready': 'Starting up',
  };

  /*
   * States that still say something once a count is shown. "idle" and "pending"
   * do not: "Up to date" beside "3 changes waiting to sync" contradicts itself,
   * and "Pending local changes" beside it repeats itself.
   */
  const QUALIFIERS = {
    offline: 'Offline',
    error: 'Last sync failed',
    blocked: 'Waiting for sync endpoint',
    'not-ready': 'Starting up',
  };

  const changesPhrase = function (count) {
    return count + ' change' + (count === 1 ? '' : 's') + ' waiting to sync';
  };

  /*
   * The row used to read "Up to date - pending 0 - dirty rows 0": two internal
   * counters, shown even at zero, with a separator the page uses nowhere else
   * (issue #3298). "dirtyRows" is an implementation detail of the local store
   * and is deliberately not surfaced at all - a user cannot act on it, and the
   * queue depth already answers "is anything waiting".
   */
  const syncStatusLabel = function (status) {
    const state = status && typeof status.state === 'string' ? status.state : '';
    const pending =
      status && Number.isFinite(status.pendingMutations) ? status.pendingMutations : 0;
    if (pending > 0) {
      const phrase = changesPhrase(pending);
      const qualifier = QUALIFIERS[state];
      return qualifier ? qualifier + SEP + phrase : phrase;
    }
    return STATE_LABELS[state] || 'Unknown';
  };

  // Settings keys the user can type a bad value into, named the way the page
  // names them. A key missing here is reported by its own name rather than
  // silently dropped, so a new free-text field is visibly unlabelled instead of
  // invisibly unreported.
  const FIELD_LABELS = {
    dndStart: 'Do not disturb start time',
    dndEnd: 'Do not disturb end time',
  };

  const TIME_HINT = 'Enter a time between 00:00 and 23:59.';

  /*
   * What the status line says after a save. The page previously said "Saved"
   * whenever the IPC call resolved, which was true of the call and not of the
   * field the user had just typed into: a partial time was dropped by the store
   * and the page still confirmed it (issue #3298).
   */
  const saveFeedback = function (rejected) {
    const keys = Array.isArray(rejected) ? rejected : [];
    if (keys.length === 0) return { message: 'Saved', tone: 'ok' };
    const names = keys.map(function (key) {
      return FIELD_LABELS[key] || key;
    });
    const subject =
      names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
    return { message: subject + ' not saved', tone: 'error' };
  };

  const api = {
    syncStatusLabel: syncStatusLabel,
    saveFeedback: saveFeedback,
    FIELD_LABELS: FIELD_LABELS,
    TIME_HINT: TIME_HINT,
    SEP: SEP,
  };
  root.ycSettingsView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
