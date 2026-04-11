import { addToIndex, removeFromIndex } from '@/app/stores/utils/indexHelpers';

describe('addToIndex', () => {
  it('adds id to an empty index for the given key', () => {
    const result = addToIndex({}, 'key-a', 'id-1');
    expect(result).toEqual({ 'key-a': ['id-1'] });
  });

  it('appends id to an existing array', () => {
    const idx = { 'key-a': ['id-1'] };
    const result = addToIndex(idx, 'key-a', 'id-2');
    expect(result['key-a']).toEqual(['id-1', 'id-2']);
  });

  it('returns the same reference when id already exists (no duplicate)', () => {
    const idx = { 'key-a': ['id-1'] };
    const result = addToIndex(idx, 'key-a', 'id-1');
    expect(result).toBe(idx);
    expect(result['key-a']).toEqual(['id-1']);
  });

  it('does not mutate the original index', () => {
    const idx = { 'key-a': ['id-1'] };
    const result = addToIndex(idx, 'key-a', 'id-2');
    expect(idx['key-a']).toEqual(['id-1']); // original unchanged
    expect(result['key-a']).toEqual(['id-1', 'id-2']);
  });

  it('handles multiple keys independently', () => {
    let idx = addToIndex({}, 'key-a', 'id-1');
    idx = addToIndex(idx, 'key-b', 'id-2');
    expect(idx['key-a']).toEqual(['id-1']);
    expect(idx['key-b']).toEqual(['id-2']);
  });
});

describe('removeFromIndex', () => {
  it('removes an id from the array for the given key', () => {
    const idx = { 'key-a': ['id-1', 'id-2'] };
    const result = removeFromIndex(idx, 'key-a', 'id-1');
    expect(result['key-a']).toEqual(['id-2']);
  });

  it('returns the same reference when the array is empty (key missing)', () => {
    const idx = { 'key-a': ['id-1'] };
    const result = removeFromIndex(idx, 'key-b', 'id-1');
    expect(result).toBe(idx);
  });

  it('returns the same reference when the array is empty for the key', () => {
    const idx = { 'key-a': [] as string[] };
    const result = removeFromIndex(idx, 'key-a', 'id-1');
    expect(result).toBe(idx);
  });

  it('leaves array unchanged when id is not present', () => {
    const idx = { 'key-a': ['id-1', 'id-2'] };
    const result = removeFromIndex(idx, 'key-a', 'id-99');
    expect(result['key-a']).toEqual(['id-1', 'id-2']);
  });

  it('does not mutate the original index', () => {
    const idx = { 'key-a': ['id-1', 'id-2'] };
    const result = removeFromIndex(idx, 'key-a', 'id-1');
    expect(idx['key-a']).toEqual(['id-1', 'id-2']); // original unchanged
    expect(result['key-a']).toEqual(['id-2']);
  });

  it('handles undefined key by treating it as empty array and returning original', () => {
    const idx = { 'key-a': ['id-1'] };
    const result = removeFromIndex(idx, 'missing-key', 'id-1');
    expect(result).toBe(idx);
  });
});
