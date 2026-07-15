import { renderHook } from '@testing-library/react';
import { useHasMounted } from '@/app/hooks/useHasMounted';

describe('useHasMounted', () => {
  it('returns true once rendered on the client', () => {
    const { result } = renderHook(() => useHasMounted());
    expect(result.current).toBe(true);
  });
});
