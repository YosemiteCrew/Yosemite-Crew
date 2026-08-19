import type { ElectronApplication } from '@playwright/test';

// Invoke an application-menu item by label, the way pressing its accelerator
// does.
//
// The tab shortcuts (Cmd/Ctrl+T, +W, +Shift+T) are menu accelerators declared in
// src/ui/app-menu.ts, and the command palette is a globalShortcut. Both are
// handled by Electron's native layer, above the renderer. `page.keyboard.press`
// injects input into the renderer through CDP, so it never reaches either: the
// specs that pressed Meta+T were not exercising the shortcut, they were sending
// a keystroke into a web page that ignores it, and then timing out waiting for a
// tab that was never going to appear.
//
// Playwright cannot synthesise OS-level input, so there is no way to press the
// accelerator for real. Clicking the menu item runs the same handler the
// accelerator is bound to, which is the part that can actually break - the
// binding between menu entry and action.
export const clickMenuItem = async (app: ElectronApplication, label: string): Promise<void> => {
  await app.evaluate(async ({ Menu }, wanted) => {
    type MenuItemLike = {
      label?: string;
      submenu?: { items: MenuItemLike[] };
      click: () => void;
    };

    const find = (items: MenuItemLike[]): MenuItemLike | null => {
      for (const item of items) {
        if (item.label === wanted) return item;
        const nested = item.submenu ? find(item.submenu.items) : null;
        if (nested) return nested;
      }
      return null;
    };

    const menu = Menu.getApplicationMenu();
    if (!menu) throw new Error('no application menu is set');
    const item = find(menu.items as unknown as MenuItemLike[]);
    if (!item) throw new Error(`no application menu item labelled "${wanted}"`);
    item.click();
  }, label);
};
