import { resolveImageSource } from '@/shared/utils/resolveImageSource';

// This const is fine for your 'expect' calls
const mockHospitalIcon = 12345;

// The fix is here: use the literal value '12345' inside the factory
// instead of the 'mockHospitalIcon' variable.
jest.mock('@/assets/images', () => ({
  Images: {
    hospitalIcon: 12345, // <-- THIS IS THE FIX
  },
}));

describe('resolveImageSource', () => {
  // Test Case 1: Source is a number (e.g., require('./local-image.png'))
  it('should return the number directly if the source is a number', () => {
    const localImageRequire = 98765;
    expect(resolveImageSource(localImageRequire)).toBe(localImageRequire);
  });

  // Test Case 2: Source is undefined
  it('should return the default hospitalIcon if the source is undefined', () => {
    expect(resolveImageSource()).toBe(mockHospitalIcon);
  });

  // Test Case 3: Source is null
  it('should return the default hospitalIcon if the source is null', () => {
    expect(resolveImageSource(null as any)).toBe(mockHospitalIcon);
  });

  // Test Case 4: Source is a string (e.g., a URL)
  it('should return a URI object if the source is a string', () => {
    const uri = 'https://example.com/image.jpg';
    expect(resolveImageSource(uri as any)).toEqual({ uri: uri });
  });

  // Test Case 5: Source is an array with a string URI
  it('should resolve the first element if the source is an array with a string', () => {
    const uri = 'https://example.com/image.jpg';
    expect(resolveImageSource([uri, 'other-uri.png'] as any)).toEqual({ uri: uri });
  });

  // Test Case 6: Source is an array with a number
  it('should resolve the first element if the source is an array with a number', () => {
    const localImageRequire = 777;
    expect(resolveImageSource([localImageRequire, 888] as any)).toBe(localImageRequire);
  });

  // Test Case 7: Source is already a valid object { uri: '...' }
  it('should return the object directly if it is a valid ImageSourcePropType object', () => {
    const source = { uri: 'https://example.com/image.jpg' };
    expect(resolveImageSource(source)).toBe(source);
  });

  // Test Case 8: Source is an empty array
  it('should return the default hospitalIcon if the source is an empty array', () => {
    expect(resolveImageSource([] as any)).toBe(mockHospitalIcon);
  });

  // Test Case 9: Source is an empty object
  it('should return the default hospitalIcon if the source is an empty object', () => {
    expect(resolveImageSource({} as any)).toBe(mockHospitalIcon);
  });

  // Test Case 10: Source is an object with a falsy uri
  it('should return the default hospitalIcon if the source object has a falsy uri', () => {
    expect(resolveImageSource({ uri: null } as any)).toBe(mockHospitalIcon);
    expect(resolveImageSource({ uri: undefined } as any)).toBe(mockHospitalIcon);
    expect(resolveImageSource({ uri: '' } as any)).toBe(mockHospitalIcon);
  });
});