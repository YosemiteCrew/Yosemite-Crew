/**
 * Storage keys a request may name. The upload URL routes issue keys of the form
 * `<folder>/<file name>`, so a key is accepted only in exactly that form: a
 * nested, relative or encoded path is refused, never normalised.
 */

/** Where a fresh upload lands before a record takes it over. */
export const TEMP_UPLOAD_PREFIX = "temp/uploads/";

/** True for `<prefix><file name>`, the file sitting directly in the folder. */
export const isUploadKeyIn = (prefix: string, key: unknown): key is string =>
  typeof key === "string" &&
  key.startsWith(prefix) &&
  /^[\w-][\w.-]*$/.test(key.slice(prefix.length));

/** True for a fresh upload, the only file a record may take over by moving it. */
export const isTempUploadKey = (key: unknown): key is string =>
  isUploadKeyIn(TEMP_UPLOAD_PREFIX, key);

/**
 * The upload to move into a new record's own folder, or null for a link
 * (`https:`, `data:`), which is stored as given. Any other value must be a
 * fresh upload; `onInvalid` raises the caller's own 400 before anything is
 * written.
 */
export const uploadKeyToMove = (
  value: string | null | undefined,
  onInvalid: () => never,
): string | null => {
  if (!value || /^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  if (!isTempUploadKey(value)) onInvalid();
  return value;
};
