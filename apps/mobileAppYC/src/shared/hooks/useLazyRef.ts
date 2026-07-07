import {useRef, type RefObject} from 'react';

export const useLazyRef = <T>(createValue: () => T): RefObject<T> => {
  const ref = useRef<T | null>(null);

  ref.current ??= createValue();

  return ref as RefObject<T>;
};
