import {renderHook} from '@testing-library/react-hooks';
import {useLazyRef} from '@/shared/hooks/useLazyRef';

describe('useLazyRef', () => {
  it('creates the value once and keeps the same ref across rerenders', () => {
    const createValue = jest.fn(() => new Map<string, number>());
    const {result, rerender} = renderHook(() => useLazyRef(createValue));
    const firstRef = result.current;

    firstRef.current.set('initial', 1);
    rerender();

    expect(createValue).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(firstRef);
    expect(result.current.current.get('initial')).toBe(1);
  });
});
