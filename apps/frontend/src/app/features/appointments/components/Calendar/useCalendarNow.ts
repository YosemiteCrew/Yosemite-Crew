import { useEffect, useState } from 'react';

export const useCalendarNow = (): Date => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    let minuteTimer: ReturnType<typeof setInterval> | null = null;
    let minuteAlignTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (minuteAlignTimer) {
        globalThis.clearTimeout(minuteAlignTimer);
        minuteAlignTimer = null;
      }
      if (minuteTimer) {
        globalThis.clearInterval(minuteTimer);
        minuteTimer = null;
      }
    };

    const scheduleMinuteUpdates = () => {
      clearTimers();
      const msIntoCurrentMinute = Date.now() % 60_000;
      const msUntilNextMinute = msIntoCurrentMinute === 0 ? 60_000 : 60_000 - msIntoCurrentMinute;
      minuteAlignTimer = globalThis.setTimeout(() => {
        updateNow();
        minuteTimer = globalThis.setInterval(updateNow, 60_000);
      }, msUntilNextMinute);
    };

    updateNow();
    scheduleMinuteUpdates();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
        scheduleMinuteUpdates();
      }
    };
    const onTimezoneChange = () => {
      updateNow();
      scheduleMinuteUpdates();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    globalThis.addEventListener('yc:timezone-changed', onTimezoneChange as EventListener);

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      globalThis.removeEventListener('yc:timezone-changed', onTimezoneChange as EventListener);
    };
  }, []);

  return new Date(nowMs);
};
