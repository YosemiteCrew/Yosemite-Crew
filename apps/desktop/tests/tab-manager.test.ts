import { createTabManager } from '../src/core/tab-manager';
import type { TabManager } from '../src/core/tab-manager';

describe('TabManager', () => {
  let tm: TabManager;

  beforeEach(() => {
    tm = createTabManager();
  });

  describe('create', () => {
    it('creates a tab and sets it active', () => {
      const id = tm.create('https://example.com');
      const state = tm.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeId).toBe(id);
      expect(state.tabs[0].url).toBe('https://example.com');
      expect(state.tabs[0].loading).toBe(true);
      expect(state.tabs[0].pinned).toBe(false);
    });

    it('creates a pinned tab before unpinned ones', () => {
      const id1 = tm.create('https://a.com', { pinned: true });
      const id2 = tm.create('https://b.com');
      const id3 = tm.create('https://c.com', { pinned: true });
      const state = tm.getState();
      expect(state.tabs[0].id).toBe(id1);
      expect(state.tabs[1].id).toBe(id3);
      expect(state.tabs[2].id).toBe(id2);
    });

    it('accepts an initial title', () => {
      tm.create('https://example.com', { title: 'My Tab' });
      expect(tm.getState().tabs[0].title).toBe('My Tab');
    });

    it('generates unique ids', () => {
      const id1 = tm.create('https://a.com');
      const id2 = tm.create('https://b.com');
      expect(id1).not.toBe(id2);
    });
  });

  describe('close', () => {
    it('closes a tab and activates another', () => {
      const id1 = tm.create('https://a.com');
      const id2 = tm.create('https://b.com');
      tm.activate(id1);
      tm.close(id1);
      const state = tm.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeId).toBe(id2);
    });

    it('returns false for unknown id', () => {
      expect(tm.close('nonexistent')).toBe(false);
    });

    it('pushed closed unpinned tab onto stack', () => {
      const id = tm.create('https://a.com');
      tm.close(id);
      expect(tm.getState().closedStack).toHaveLength(1);
    });

    it('does not push closed pinned tab onto stack', () => {
      const id = tm.create('https://a.com', { pinned: true });
      tm.close(id);
      expect(tm.getState().closedStack).toHaveLength(0);
    });

    it('limits closed stack to MAX_CLOSED_STACK', () => {
      for (let i = 0; i < 25; i++) {
        tm.create(`https://${i}.com`);
      }
      const ids = tm.getState().tabs.map((t) => t.id);
      for (const id of ids) {
        tm.close(id);
      }
      expect(tm.getState().closedStack.length).toBeLessThanOrEqual(20);
    });

    it('sets active to null when last tab closed', () => {
      const id = tm.create('https://a.com');
      tm.close(id);
      expect(tm.getState().activeId).toBeNull();
    });
  });

  describe('activate', () => {
    it('activates an existing tab', () => {
      const id1 = tm.create('https://a.com');
      tm.create('https://b.com');
      tm.activate(id1);
      expect(tm.getState().activeId).toBe(id1);
    });

    it('returns false for unknown id', () => {
      expect(tm.activate('x')).toBe(false);
    });
  });

  describe('move', () => {
    it('reorders tabs within same pinned group', () => {
      const id1 = tm.create('https://a.com');
      const id2 = tm.create('https://b.com');
      const id3 = tm.create('https://c.com');
      tm.move(id3, 0);
      const state = tm.getState();
      expect(state.tabs[0].id).toBe(id3);
      expect(state.tabs[1].id).toBe(id1);
      expect(state.tabs[2].id).toBe(id2);
    });

    it('refuses to move pinned tab after unpinned', () => {
      const id1 = tm.create('https://a.com', { pinned: true });
      tm.create('https://b.com');
      const result = tm.move(id1, 2);
      expect(result).toBe(false);
    });

    it('clamps toIndex', () => {
      const id1 = tm.create('https://a.com');
      tm.create('https://b.com');
      const result = tm.move(id1, 999);
      expect(result).toBe(true);
    });

    it('returns false for unknown id', () => {
      expect(tm.move('x', 0)).toBe(false);
    });
  });

  describe('pin', () => {
    it('pins a tab and moves it before unpinned', () => {
      tm.create('https://a.com');
      const id2 = tm.create('https://b.com');
      tm.pin(id2, true);
      const state = tm.getState();
      expect(state.tabs[0].id).toBe(id2);
      expect(state.tabs[0].pinned).toBe(true);
    });

    it('unpins a tab and moves it after pinned', () => {
      const id1 = tm.create('https://a.com', { pinned: true });
      tm.pin(id1, false);
      expect(tm.getState().tabs[0].pinned).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(tm.pin('x', true)).toBe(false);
    });

    it('idempotent if already pinned', () => {
      const id = tm.create('https://a.com', { pinned: true });
      expect(tm.pin(id, true)).toBe(true);
    });
  });

  describe('duplicate', () => {
    it('duplicates a tab with same url', () => {
      const id = tm.create('https://example.com', { title: 'Original' });
      const dupId = tm.duplicate(id);
      expect(dupId).not.toBeNull();
      expect(dupId).not.toBe(id);
      const state = tm.getState();
      const dup = state.tabs.find((t) => t.id === dupId);
      expect(dup?.url).toBe('https://example.com');
    });

    it('returns null for unknown id', () => {
      expect(tm.duplicate('x')).toBeNull();
    });
  });

  describe('reopenClosed', () => {
    it('restores the last closed tab', () => {
      const id = tm.create('https://example.com');
      tm.close(id);
      const restoredId = tm.reopenClosed();
      expect(restoredId).not.toBeNull();
      expect(restoredId).not.toBe(id);
      expect(tm.getState().tabs).toHaveLength(1);
    });

    it('returns null when stack is empty', () => {
      expect(tm.reopenClosed()).toBeNull();
    });
  });

  describe('updateMeta', () => {
    it('updates tab metadata', () => {
      const id = tm.create('https://example.com');
      tm.updateMeta(id, {
        title: 'New Title',
        loading: false,
        favicon: 'https://fav.icon',
      });
      const tab = tm.getState().tabs[0];
      expect(tab.title).toBe('New Title');
      expect(tab.loading).toBe(false);
      expect(tab.favicon).toBe('https://fav.icon');
    });

    it('returns false for unknown id', () => {
      expect(tm.updateMeta('x', { title: 'X' })).toBe(false);
    });
  });

  describe('getState', () => {
    it('returns snapshots (immutable copies)', () => {
      tm.create('https://a.com');
      const state = tm.getState();
      state.tabs[0].title = 'Hacked';
      expect(tm.getState().tabs[0].title).not.toBe('Hacked');
    });
  });

  describe('persist / restore', () => {
    it('round-trips tab state', () => {
      const id1 = tm.create('https://a.com', { pinned: true });
      tm.create('https://b.com');
      tm.updateMeta(id1, { title: 'A', loading: false });

      const json = tm.persist();
      const tm2 = createTabManager();
      expect(tm2.restore(json)).toBe(true);

      const state2 = tm2.getState();
      expect(state2.tabs).toHaveLength(2);
      expect(state2.tabs[0].pinned).toBe(true);
      expect(state2.tabs[0].url).toBe('https://a.com');
      expect(state2.tabs[0].title).toBe('A');
      expect(state2.tabs[1].url).toBe('https://b.com');
    });

    it('returns false for invalid JSON', () => {
      expect(tm.restore('not-json')).toBe(false);
    });

    it('returns false for JSON without tabs array', () => {
      expect(tm.restore(JSON.stringify({}))).toBe(false);
    });

    it('returns false when no tabs remain after restore', () => {
      const json = JSON.stringify({ tabs: [], activeId: null });
      expect(tm.restore(json)).toBe(false);
      expect(tm.getState().tabs).toHaveLength(0);
      expect(tm.getState().activeId).toBeNull();
    });

    it('drops restored tabs whose URL fails the validator', () => {
      const json = JSON.stringify({
        tabs: [{ url: 'https://app.example/a' }, { url: 'file:///etc/passwd' }, { url: '' }],
        activeId: null,
      });
      // Parse and compare the host exactly — a startsWith check would also accept
      // hosts like app.example.evil.com (CodeQL: incomplete URL sanitization).
      const isAllowed = (u: string): boolean => {
        try {
          return new URL(u).host === 'app.example';
        } catch {
          return false;
        }
      };
      expect(tm.restore(json, isAllowed)).toBe(true);
      const state = tm.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].url).toBe('https://app.example/a');
    });

    it('returns false when every restored tab is filtered out', () => {
      const json = JSON.stringify({
        tabs: [{ url: 'file:///x' }, { url: 'http://evil.com' }],
        activeId: null,
      });
      expect(tm.restore(json, () => false)).toBe(false);
      expect(tm.getState().tabs).toHaveLength(0);
    });
  });

  describe('activeTab getter', () => {
    it('returns null when no tabs', () => {
      expect(tm.activeTab).toBeNull();
    });

    it('returns the active tab', () => {
      tm.create('https://a.com');
      expect(tm.activeTab).not.toBeNull();
      expect(tm.activeTab!.url).toBe('https://a.com');
    });
  });

  describe('tabCount getter', () => {
    it('returns correct count', () => {
      expect(tm.tabCount).toBe(0);
      tm.create('https://a.com');
      expect(tm.tabCount).toBe(1);
      tm.create('https://b.com');
      expect(tm.tabCount).toBe(2);
    });
  });

  describe('initial tabs', () => {
    it('accepts initial tab list', () => {
      const existing = createTabManager([
        {
          id: 'pre_1',
          title: 'Existing',
          url: 'https://existing.com',
          favicon: '',
          loading: false,
          pinned: false,
          zoom: 1.0,
          error: null,
          offline: false,
          created: Date.now(),
        },
      ]);
      expect(existing.tabCount).toBe(1);
      expect(existing.activeTab?.url).toBe('https://existing.com');
    });
  });
});
