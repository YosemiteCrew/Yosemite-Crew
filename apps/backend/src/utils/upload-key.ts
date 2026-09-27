import { createHash } from "node:crypto";

/**
 * Storage keys a request may name. The upload URL routes issue keys of the form
 * `<folder>/<file name>`, so a key is accepted only in exactly that form: a
 * nested, relative or encoded path is refused, never normalised.
 */

/** Where fresh uploads land before a record takes them over. */
export const TEMP_UPLOAD_PREFIX = "temp/uploads/";

/** True for `<prefix><file name>`, the file sitting directly in the folder. */
export const isUploadKeyIn = (prefix: string, key: unknown): key is string =>
  typeof key === "string" &&
  key.startsWith(prefix) &&
  /^[\w-][\w.-]*$/.test(key.slice(prefix.length));

/**
 * The folder one person's fresh uploads land in. It is named after them, so a
 * fresh upload can only be handed to a record by the person who made it.
 */
export const tempUploadPrefixFor = (uploaderId: string): string =>
  `${TEMP_UPLOAD_PREFIX}${createHash("sha256")
    .update(uploaderId)
    .digest("hex")
    .slice(0, 32)}/`;

/**
 * True for a fresh upload `uploaderId` made, the only file a record they save
 * may take over by moving it.
 */
export const isTempUploadKey = (
  key: unknown,
  uploaderId: string | undefined,
): key is string =>
  typeof uploaderId === "string" &&
  uploaderId !== "" &&
  isUploadKeyIn(tempUploadPrefixFor(uploaderId), key);

/** Picture links saved as given: an https address or an inline image. */
const isPictureLink = (value: string): boolean =>
  /^data:image\/(?:png|jpeg|gif|webp)(?:;base64)?,/i.test(value) ||
  (/^https:\/\/\S+$/i.test(value) && URL.canParse(value));

/**
 * Checks a picture before it is saved. A picture link is saved as given, and so
 * is the value the record already holds (`current`). A fresh upload the caller
 * made is returned, for the caller to move into the record's own folder. Any
 * other value raises the caller's own 400 through `onInvalid` before anything
 * is written.
 */
export const uploadKeyToMove = (
  value: string | null | undefined,
  { uploaderId, current }: { uploaderId?: string; current?: string | null },
  onInvalid: () => never,
): string | null => {
  if (!value || value === current || isPictureLink(value)) return null;
  if (!isTempUploadKey(value, uploaderId)) onInvalid();
  return value;
};
