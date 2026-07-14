import { useLayoutEffect, useRef, useState } from 'react';
import {
  MENU_ESTIMATED_WIDTH,
  SUBMENU_ESTIMATED_WIDTH,
  SUBMENU_HORIZONTAL_GAP,
  SUBMENU_ROW_OFFSET,
  VIEWPORT_MARGIN,
  type MenuSubmenu,
  type SubmenuPosition,
} from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';

/**
 * Encapsulates the active-submenu state and the positioning logic used to keep
 * the status/room submenu anchored to its trigger item while staying inside
 * the viewport. Extracted verbatim from AppointmentContextMenu — behavior is
 * unchanged.
 */
export function useAppointmentContextSubmenuPosition(
  menuRef: React.RefObject<HTMLDivElement | null>,
  menuStyle: React.CSSProperties
) {
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenu>(null);
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition>({
    top: Number(menuStyle.top ?? 0),
    left: Number(menuStyle.left ?? 0) + MENU_ESTIMATED_WIDTH + SUBMENU_HORIZONTAL_GAP,
    openToLeft: false,
  });

  const showSubmenu = (
    submenu: MenuSubmenu,
    key: string,
    itemRefs: React.RefObject<Record<string, HTMLButtonElement | null>>
  ) => {
    const target = itemRefs.current[key];
    if (target) {
      const rect = target.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      const menuLeft = menuRect?.left ?? Number(menuStyle.left ?? 0);
      const menuWidth = menuRect?.width || MENU_ESTIMATED_WIDTH;
      const menuRight = menuLeft + menuWidth;
      const preferredRightLeft = menuRight + SUBMENU_HORIZONTAL_GAP;
      const shouldOpenLeft =
        preferredRightLeft + SUBMENU_ESTIMATED_WIDTH > globalThis.innerWidth - VIEWPORT_MARGIN;
      const nextLeft = shouldOpenLeft
        ? Math.max(VIEWPORT_MARGIN, menuLeft - SUBMENU_ESTIMATED_WIDTH - SUBMENU_HORIZONTAL_GAP)
        : preferredRightLeft;
      const nextTop = Math.max(VIEWPORT_MARGIN, rect.top - SUBMENU_ROW_OFFSET);

      setSubmenuPosition({
        left: nextLeft,
        openToLeft: shouldOpenLeft,
        top: nextTop,
      });
    }
    setActiveSubmenu(submenu);
  };

  useLayoutEffect(() => {
    if (!activeSubmenu) {
      return;
    }

    const submenuRect = submenuRef.current?.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    if (!submenuRect || !menuRect) {
      return;
    }

    const measuredSubmenuWidth = submenuRect.width || SUBMENU_ESTIMATED_WIDTH;
    const measuredSubmenuHeight = submenuRect.height;
    const nextLeft = submenuPosition.openToLeft
      ? Math.max(VIEWPORT_MARGIN, menuRect.left - measuredSubmenuWidth - SUBMENU_HORIZONTAL_GAP)
      : menuRect.right + SUBMENU_HORIZONTAL_GAP;
    const nextTop = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        submenuPosition.top,
        globalThis.innerHeight - measuredSubmenuHeight - VIEWPORT_MARGIN
      )
    );

    if (
      Math.abs(nextLeft - submenuPosition.left) > 0.5 ||
      Math.abs(nextTop - submenuPosition.top) > 0.5
    ) {
      setSubmenuPosition((currentPosition) => ({
        ...currentPosition,
        left: nextLeft,
        top: nextTop,
      }));
    }
  }, [
    activeSubmenu,
    menuRef,
    submenuPosition.left,
    submenuPosition.openToLeft,
    submenuPosition.top,
  ]);

  return {
    submenuRef,
    activeSubmenu,
    setActiveSubmenu,
    submenuPosition,
    showSubmenu,
  };
}
