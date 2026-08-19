import React from 'react';
import { IoChevronForward } from 'react-icons/io5';
import {
  getMenuItemClassName,
  type MenuAction,
  type MenuSubmenu,
} from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';

type MenuActionsListProps = {
  actions: MenuAction[];
  activeSubmenu: MenuSubmenu;
  itemRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onHover: (action: MenuAction) => void;
  onActivate: (action: MenuAction) => void;
};

const MenuActionsList = ({
  actions,
  activeSubmenu,
  itemRefs,
  onHover,
  onActivate,
}: MenuActionsListProps) => (
  <div className="flex flex-col gap-0.5">
    {actions.map((action, index) => (
      <React.Fragment key={action.key}>
        {index > 0 ? (
          <div className="mx-1 border-t border-[var(--hairline)]" aria-hidden="true" />
        ) : null}
        <button
          ref={(element) => {
            itemRefs.current[action.key] = element;
          }}
          type="button"
          role="menuitem"
          aria-haspopup={action.submenu ? 'menu' : undefined}
          aria-expanded={action.submenu ? activeSubmenu === action.submenu : undefined}
          className={getMenuItemClassName(action.destructive, activeSubmenu === action.submenu)}
          onMouseEnter={() => onHover(action)}
          onClick={() => onActivate(action)}
        >
          <span className="truncate">{action.label}</span>
          {action.submenu ? <IoChevronForward size={10} className="shrink-0 opacity-55" /> : null}
        </button>
      </React.Fragment>
    ))}
  </div>
);

export default MenuActionsList;
