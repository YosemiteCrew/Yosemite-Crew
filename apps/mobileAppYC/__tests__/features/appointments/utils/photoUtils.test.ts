import {isDummyPhoto, needsPhotoFallback} from '@/features/appointments/utils/photoUtils';

describe('photoUtils', () => {
  describe('isDummyPhoto', () => {
    it('should return false for non-string values', () => {
      expect(isDummyPhoto(null)).toBe(false);
      expect(isDummyPhoto(undefined)).toBe(false);
      expect(isDummyPhoto(123 as any)).toBe(false);
      expect(isDummyPhoto({} as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDummyPhoto('')).toBe(false);
      expect(isDummyPhoto('   ')).toBe(false);
    });

    it('should detect example.com as dummy host', () => {
      expect(isDummyPhoto('https://example.com/photo.jpg')).toBe(true);
      expect(isDummyPhoto('http://example.com/photo.jpg')).toBe(true);
      expect(isDummyPhoto('example.com/photo.jpg')).toBe(true);
    });

    it('should detect placeholder.com as dummy host', () => {
      expect(isDummyPhoto('https://placeholder.com/image.png')).toBe(true);
      expect(isDummyPhoto('http://placeholder.com/image.png')).toBe(true);
      expect(isDummyPhoto('placeholder.com/image.png')).toBe(true);
    });

    it('should detect subdomains of dummy hosts', () => {
      expect(isDummyPhoto('https://cdn.example.com/photo.jpg')).toBe(true);
      expect(isDummyPhoto('https://images.placeholder.com/img.png')).toBe(true);
    });

    it('should detect placeholder in URL path', () => {
      expect(isDummyPhoto('https://mysite.com/placeholder/image.jpg')).toBe(true);
      expect(isDummyPhoto('https://api.com/images/placeholder.png')).toBe(true);
      expect(isDummyPhoto('/assets/placeholder.jpg')).toBe(true);
    });

    it('should detect Placeholder with different casing', () => {
      expect(isDummyPhoto('https://mysite.com/Placeholder/image.jpg')).toBe(true);
      expect(isDummyPhoto('https://mysite.com/PLACEHOLDER.png')).toBe(true);
    });

    it('should return false for real photo URLs', () => {
      expect(isDummyPhoto('https://cdn.mysite.com/photo.jpg')).toBe(false);
      expect(isDummyPhoto('https://storage.googleapis.com/bucket/image.png')).toBe(false);
      expect(isDummyPhoto('https://s3.amazonaws.com/photos/img123.jpg')).toBe(false);
    });

    it('should return false for local file paths', () => {
      expect(isDummyPhoto('/assets/images/photo.jpg')).toBe(false);
      expect(isDummyPhoto('./images/avatar.png')).toBe(false);
    });

    it('should handle URLs with query parameters', () => {
      expect(isDummyPhoto('https://example.com/photo.jpg?size=large')).toBe(true);
      expect(isDummyPhoto('https://mysite.com/image.jpg?placeholder=true')).toBe(true);
    });

    it('should handle URLs with hash fragments', () => {
      expect(isDummyPhoto('https://example.com/photo.jpg#main')).toBe(true);
      expect(isDummyPhoto('https://mysite.com/image.jpg#placeholder')).toBe(true);
    });

    it('should handle URLs without protocol', () => {
      expect(isDummyPhoto('example.com/photo.jpg')).toBe(true);
      expect(isDummyPhoto('cdn.example.com/image.png')).toBe(true);
    });

    it('should handle malformed URLs gracefully', () => {
      expect(isDummyPhoto('not a url')).toBe(false);
      expect(isDummyPhoto('https://site.com/my-placeholder-image')).toBe(true);
    });
  });

  describe('needsPhotoFallback', () => {
    it('should return true when photo is missing and googlePlacesId exists', () => {
      const result = needsPhotoFallback(null, null, 'place-123');
      expect(result).toBe(true);
    });

    it('should return true when photo is dummy and googlePlacesId exists', () => {
      const result = needsPhotoFallback(
        'https://example.com/photo.jpg',
        null,
        'place-123',
      );
      expect(result).toBe(true);
    });

    it('should return false when photo is valid', () => {
      const result = needsPhotoFallback(
        'https://cdn.mysite.com/photo.jpg',
        null,
        'place-123',
      );
      expect(result).toBe(false);
    });

    it('should return false when fallbackPhoto exists', () => {
      const result = needsPhotoFallback(
        null,
        'https://fallback.com/photo.jpg',
        'place-123',
      );
      expect(result).toBe(false);
    });

    it('should return false when googlePlacesId is missing', () => {
      const result = needsPhotoFallback(null, null, null);
      expect(result).toBe(false);
    });

    it('should return false when googlePlacesId is empty string', () => {
      const result = needsPhotoFallback(null, null, '');
      expect(result).toBe(false);
    });

    it('should handle undefined photo', () => {
      const result = needsPhotoFallback(undefined, null, 'place-123');
      expect(result).toBe(true);
    });

    it('should handle undefined fallbackPhoto', () => {
      const result = needsPhotoFallback(null, undefined, 'place-123');
      expect(result).toBe(true);
    });

    it('should handle undefined googlePlacesId', () => {
      const result = needsPhotoFallback(null, null, undefined);
      expect(result).toBe(false);
    });

    it('should return false when both photo and fallbackPhoto exist', () => {
      const result = needsPhotoFallback(
        'https://mysite.com/photo.jpg',
        'https://fallback.com/photo.jpg',
        'place-123',
      );
      expect(result).toBe(false);
    });

    it('should return true when photo is placeholder and conditions met', () => {
      const result = needsPhotoFallback(
        'https://mysite.com/placeholder.jpg',
        null,
        'place-123',
      );
      expect(result).toBe(true);
    });

    it('should handle empty string photo', () => {
      const result = needsPhotoFallback('', null, 'place-123');
      expect(result).toBe(true);
    });

    it('should handle whitespace photo', () => {
      const result = needsPhotoFallback('   ', null, 'place-123');
      expect(result).toBe(false); // isDummyPhoto returns false for whitespace
    });
  });
});
