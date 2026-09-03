/** Shared constants for the assistant feature. */

/** Deep-link scheme already registered by the app on both platforms. */
export const ASSISTANT_LINK_SCHEME = 'yc://app';

/** Maximum turns kept in the transcript. Older turns are dropped. */
export const MAX_TRANSCRIPT_MESSAGES = 60;

/**
 * Maximum characters accepted from one utterance. Long pastes are truncated
 * rather than rejected so a rambling question still gets an answer.
 */
export const MAX_UTTERANCE_LENGTH = 500;

/**
 * Confidence at or above which the deterministic parser's answer is used
 * without consulting the on-device model.
 */
export const RULES_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Confidence for a bare pet name ("Bruno?").
 *
 * Deliberately below the threshold above: naming an animal with no verb is a
 * guess about intent, so it is the one rules result the on-device model is
 * allowed to overrule.
 */
export const BARE_NAME_CONFIDENCE = 0.45;

/** How many pets the snapshot carries to the native side. */
export const SNAPSHOT_PET_LIMIT = 12;

/** How many upcoming items of each kind the snapshot carries. */
export const SNAPSHOT_ITEM_LIMIT = 20;

/** Days ahead that count as "upcoming" for tasks and appointments. */
export const UPCOMING_WINDOW_DAYS = 30;

/** Days before a due date that a vaccination counts as "due soon". */
export const VACCINATION_DUE_SOON_DAYS = 30;

/**
 * How far back an overdue vaccination still earns a place in the snapshot.
 *
 * The snapshot holds a fixed number of entries, so without this an owner with
 * a long unrecorded history crowds out the shot due next week.
 */
export const VACCINATION_STALE_DAYS = 90;
