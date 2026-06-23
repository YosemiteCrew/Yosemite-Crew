import { isHttpsImageUrl, getSafeImageUrl, getSafeOrgImageUrl } from '@/app/lib/urls';

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    avatars: {
      dog: 'https://cdn.example.com/avatars/dog.png',
      cat: 'https://cdn.example.com/avatars/cat.png',
      horse: 'https://cdn.example.com/avatars/horse.png',
      person: 'https://cdn.example.com/avatars/person.png',
      business: 'https://cdn.example.com/avatars/business.png',
    },
    organization: {
      fromS3Key: (s3Key: string) => `https://org-cdn.example.com/${s3Key}`,
    },
  },
}));

describe('isHttpsImageUrl', () => {
  it('returns true for https urls', () => {
    expect(isHttpsImageUrl('https://example.com/image.png')).toBe(true);
    expect(isHttpsImageUrl('https://cdn.example.com/path/to/img.jpg')).toBe(true);
  });

  it('returns false for non-https or missing values', () => {
    expect(isHttpsImageUrl('http://example.com/image.png')).toBe(false);
    expect(isHttpsImageUrl('ftp://example.com/image.png')).toBe(false);
    expect(isHttpsImageUrl(undefined)).toBe(false);
    expect(isHttpsImageUrl(null)).toBe(false);
    expect(isHttpsImageUrl('')).toBe(false);
  });
});

describe('getSafeImageUrl', () => {
  it('returns the src when it is a valid https url', () => {
    const src = 'https://example.com/photo.jpg';
    expect(getSafeImageUrl(src, 'dog')).toBe(src);
  });

  it('returns the type-specific fallback for invalid src', () => {
    expect(getSafeImageUrl(null, 'cat')).toBe('https://cdn.example.com/avatars/cat.png');
    expect(getSafeImageUrl(undefined, 'dog')).toBe('https://cdn.example.com/avatars/dog.png');
    expect(getSafeImageUrl('', 'horse')).toBe('https://cdn.example.com/avatars/horse.png');
    expect(getSafeImageUrl('not-https', 'person')).toBe(
      'https://cdn.example.com/avatars/person.png'
    );
    expect(getSafeImageUrl('http://insecure.com/img.png', 'business')).toBe(
      'https://cdn.example.com/avatars/business.png'
    );
  });

  it('falls back to other/dog fallback when type has no specific default image', () => {
    // 'other' type maps to dog avatar
    const result = getSafeImageUrl(null, 'other' as any);
    expect(result).toBe('https://cdn.example.com/avatars/dog.png');
  });
});

describe('getSafeOrgImageUrl', () => {
  it('returns https urls unchanged', () => {
    expect(getSafeOrgImageUrl('https://example.com/item.png')).toBe('https://example.com/item.png');
  });

  it('converts inventory s3 keys into org cdn urls', () => {
    expect(getSafeOrgImageUrl('inventory/org-1/item.png')).toBe(
      'https://org-cdn.example.com/inventory/org-1/item.png'
    );
  });

  it('allows blob previews when explicitly enabled', () => {
    expect(getSafeOrgImageUrl('blob:test-preview', { allowBlob: true })).toBe('blob:test-preview');
  });

  it('rejects unsafe or empty values', () => {
    expect(getSafeOrgImageUrl('javascript:alert(1)')).toBe('');
    expect(getSafeOrgImageUrl('')).toBe('');
  });
});
