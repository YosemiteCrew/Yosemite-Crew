import { renderHook } from '@testing-library/react';
import {
  getPlannerAutoLockConfig,
  getPlannerLayoutClassNames,
  usePlannerAutoLock,
} from '@/app/hooks/usePlannerLayout';

describe('usePlannerLayout', () => {
  it('returns list-specific planner classes', () => {
    expect(
      getPlannerLayoutClassNames({
        activeView: 'list',
        listWrapperClassName: 'list-wrapper',
        plannerClassName: 'planner-shell',
      })
    ).toEqual({
      wrapperClassName: 'list-wrapper max-lg:h-auto max-lg:max-h-none max-lg:min-h-[420px]',
      plannerSectionClassName:
        'w-full flex-1 min-h-[360px] md:min-h-[420px] lg:min-h-0 overflow-hidden',
    });
  });

  it('returns shared planner classes for non-list views', () => {
    expect(
      getPlannerLayoutClassNames({
        activeView: 'calendar',
        listWrapperClassName: 'list-wrapper',
        plannerClassName: 'planner-shell',
      })
    ).toEqual({
      wrapperClassName: 'w-full flex flex-col gap-3',
      plannerSectionClassName: 'planner-shell',
    });
  });

  it('provides a ref for the planner section', () => {
    const { result } = renderHook(() => usePlannerAutoLock({ activeView: 'calendar' }));

    expect(result.current.plannerSectionRef.current).toBeNull();
  });

  it('keeps the existing desktop auto-lock thresholds', () => {
    expect(getPlannerAutoLockConfig(1024, 72)).toEqual({
      lockTop: 130,
      lockMinTop: -180,
      minBottomRatio: 0.55,
      resetTop: 220,
      scrollOffset: 72,
    });
  });

  it('uses mobile-friendly thresholds and offset', () => {
    expect(getPlannerAutoLockConfig(390, 72)).toEqual({
      lockTop: 160,
      lockMinTop: -120,
      minBottomRatio: 0.35,
      resetTop: 240,
      scrollOffset: -72,
    });
  });

  it('keeps a minimum mobile cover offset for pages with small top offsets', () => {
    expect(getPlannerAutoLockConfig(390, 16).scrollOffset).toBe(-56);
  });
});
