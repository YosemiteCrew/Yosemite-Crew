'use client';

import { useEffect } from 'react';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';

export const useFullscreenLoader = (source: string, isActive: boolean) => {
  const show = useFullscreenLoaderStore((s) => s.show);
  const hide = useFullscreenLoaderStore((s) => s.hide);

  useEffect(() => {
    if (!isActive) {
      hide(source);
      return;
    }

    show(source);
    return () => {
      hide(source);
    };
  }, [hide, isActive, show, source]);
};
