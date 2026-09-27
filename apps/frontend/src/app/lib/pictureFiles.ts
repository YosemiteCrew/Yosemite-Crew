/** Image types a companion photo, profile picture or practice logo can be saved as. */
export const PICTURE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** `accept` value for a picture file input. */
export const PICTURE_ACCEPT = [...PICTURE_MIME_TYPES].join(',');

/** Shown next to a picture input when the chosen file is another type. */
export const PICTURE_TYPE_ERROR = 'Please choose a PNG, JPG, GIF or WEBP image.';

export const isPictureFile = (file: Pick<File, 'type'>): boolean =>
  PICTURE_MIME_TYPES.has(file.type);
