import {
  isPictureFile,
  PICTURE_ACCEPT,
  PICTURE_MIME_TYPES,
  PICTURE_TYPE_ERROR,
} from '@/app/lib/pictureFiles';

describe('pictureFiles', () => {
  it('offers exactly png, jpeg, gif and webp to the file picker', () => {
    expect(PICTURE_ACCEPT).toBe('image/png,image/jpeg,image/gif,image/webp');
    expect([...PICTURE_MIME_TYPES]).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  });

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])('accepts %s', (type) => {
    expect(isPictureFile({ type })).toBe(true);
  });

  it.each([
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'image/avif',
    'image/bmp',
    'image/jpg',
    'application/pdf',
    'text/html',
    '',
  ])('turns away %s', (type) => {
    expect(isPictureFile({ type })).toBe(false);
  });

  it('names every accepted type in its message', () => {
    for (const label of ['PNG', 'JPG', 'GIF', 'WEBP']) {
      expect(PICTURE_TYPE_ERROR).toContain(label);
    }
  });
});
