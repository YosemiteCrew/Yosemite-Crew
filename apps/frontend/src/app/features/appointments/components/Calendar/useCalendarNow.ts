import { useEffect, useState } from 'react';

export const useCalendarNow = (): Date => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    const minuteTimer = globalThis.setInterval(updateNow, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
      }
    };
    const onTimezoneChange = () => updateNow();

    document.addEventListener('visibilitychange', onVisibilityChange);
    globalThis.addEventListener('yc:timezone-changed', onTimezoneChange as EventListener);

    return () => {
      globalThis.clearInterval(minuteTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      globalThis.removeEventListener('yc:timezone-changed', onTimezoneChange as EventListener);
    };
  }, []);

  return new Date(nowMs);
};
