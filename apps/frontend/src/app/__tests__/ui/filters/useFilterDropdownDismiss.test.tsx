import { fireEvent, renderHook } from '@testing-library/react';
import { useFilterDropdownDismiss } from '@/app/ui/filters/useFilterDropdownDismiss';

describe('useFilterDropdownDismiss', () => {
  const setup = (open = true) => {
    const trigger = document.createElement('button');
    const panel = document.createElement('div');
    const inner = document.createElement('span');
    panel.appendChild(inner);
    const outside = document.createElement('div');
    document.body.append(trigger, panel, outside);
    const setOpen = jest.fn();
    const view = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useFilterDropdownDismiss(isOpen, setOpen, { current: trigger }, { current: panel }),
      { initialProps: { isOpen: open } }
    );
    return { trigger, panel, inner, outside, setOpen, ...view };
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('closes on a mousedown outside the trigger and panel', () => {
    const { outside, setOpen } = setup();
    fireEvent.mouseDown(outside);
    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('stays open for mousedowns on the trigger or inside the panel', () => {
    const { trigger, inner, setOpen } = setup();
    fireEvent.mouseDown(trigger);
    fireEvent.mouseDown(inner);
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('closes on any scroll, including nested scroll containers', () => {
    const { outside, setOpen } = setup();
    fireEvent.scroll(outside);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('treats unattached refs as outside and still closes', () => {
    const setOpen = jest.fn();
    renderHook(() => useFilterDropdownDismiss(true, setOpen, { current: null }, { current: null }));
    fireEvent.mouseDown(document.body);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('attaches no listeners while closed', () => {
    const { outside, setOpen } = setup(false);
    fireEvent.mouseDown(outside);
    fireEvent.scroll(window);
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('removes its listeners when the dropdown closes', () => {
    const { outside, setOpen, rerender } = setup();
    rerender({ isOpen: false });
    fireEvent.mouseDown(outside);
    fireEvent.scroll(window);
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const { outside, setOpen, unmount } = setup();
    unmount();
    fireEvent.mouseDown(outside);
    fireEvent.scroll(window);
    expect(setOpen).not.toHaveBeenCalled();
  });
});
