import {useRef} from 'react';

export const useBottomSheets = <T extends Record<string, any>>(refs: T) => {
  const sheetRefs = useRef(refs);

  const openSheet = (key: keyof T) => {
    sheetRefs.current[key]?.current?.open();
  };

  const closeSheet = (key: keyof T) => {
    sheetRefs.current[key]?.current?.close?.();
  };

  return {
    sheetRefs: sheetRefs.current,
    openSheet,
    closeSheet,
  };
};
