import { renderHook } from '@testing-library/react';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';

describe('usePlannerLayout', () => {
  it('returns list-specific planner classes', () => {
    expect(
      getPlannerLayoutClassNames({
        activeView: 'list',
        listWrapperClassName: 'list-wrapper',
        plannerClassName: 'planner-shell',
      })
    ).toEqual({
      wrapperClassName: 'list-wrapper',
      plannerSectionClassName: 'w-full flex-1 min-h-0 overflow-hidden',
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
});
