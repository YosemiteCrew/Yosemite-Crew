import {normalizeMimeType} from '../../src/shared/utils/mime';

describe('normalizeMimeType', () => {
  it('returns empty string for null or undefined input', () => {
    expect(normalizeMimeType(null)).toBe('');
    expect(normalizeMimeType(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(normalizeMimeType('')).toBe('');
  });

  it('returns the mime type lowercased', () => {
    expect(normalizeMimeType('IMAGE/JPEG')).toBe('image/jpeg');
    expect(normalizeMimeType('Application/PDF')).toBe('application/pdf');
  });

  it('trims whitespace around the mime type', () => {
    expect(normalizeMimeType('  image/png  ')).toBe('image/png');
  });

  it('removes parameters like charset', () => {
    expect(normalizeMimeType('text/html; charset=utf-8')).toBe('text/html');
    expect(normalizeMimeType('application/json;charset=UTF-8')).toBe(
      'application/json',
    );
  });

  it('handles complex cases with whitespace and parameters', () => {
    expect(normalizeMimeType('  text/plain ; charset=us-ascii  ')).toBe(
      'text/plain',
    );
  });

  it('returns empty string if input is just whitespace', () => {
    expect(normalizeMimeType('   ')).toBe('');
  });

  // This test covers the case where split returns a valid but partial string
  it('handles strings without parameters correctly', () => {
    expect(normalizeMimeType('application')).toBe('application');
  });

  it('handles potential undefined base from split (defensive test)', () => {
    expect(normalizeMimeType(';charset=utf-8')).toBe('');
  });
});