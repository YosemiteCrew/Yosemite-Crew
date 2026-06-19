'use strict';

import fs from 'node:fs';
import path from 'node:path';

export const MAX_RECENTS = 20;
export const RECENTS_FILENAME = 'command-palette-recents.json';

export interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  keywords: string[];
  url?: string;
  type: 'navigate' | 'action';
}

export interface RecentEntry {
  id: string;
  label: string;
  url: string;
  visitedAt: number;
}

// URLs map to the real PIMS routes (apps/frontend/src/app/(routes)/(app)).
// Action items navigate to the owning page with an `?action=` intent param the
// web app can read to open the corresponding modal (forward-compatible: without
// that handler they simply land on the correct page).
export const BUILTIN_ACTIONS: PaletteItem[] = [
  {
    id: 'go-dashboard',
    label: 'Dashboard',
    description: 'Go to workspace home',
    keywords: ['home', 'overview'],
    url: 'yosemitecrew://dashboard',
    type: 'navigate',
  },
  {
    id: 'go-appointments',
    label: 'Appointments',
    description: 'View and manage appointments',
    keywords: ['schedule', 'calendar', 'visits', 'booking'],
    url: 'yosemitecrew://appointments',
    type: 'navigate',
  },
  {
    id: 'go-patients',
    label: 'Patients',
    description: 'Companion (patient) records',
    keywords: ['records', 'clients', 'companions', 'medical', 'pets'],
    url: 'yosemitecrew://companions',
    type: 'navigate',
  },
  {
    id: 'go-chat',
    label: 'Chat',
    description: 'Messages and notifications',
    keywords: ['messages', 'inbox', 'communication', 'alerts'],
    url: 'yosemitecrew://chat',
    type: 'navigate',
  },
  {
    id: 'go-finance',
    label: 'Finance',
    description: 'Invoices and payments',
    keywords: ['invoices', 'payments', 'billing', 'charges'],
    url: 'yosemitecrew://finance',
    type: 'navigate',
  },
  {
    id: 'go-tasks',
    label: 'Tasks',
    description: 'Your tasks and to-dos',
    keywords: ['todo', 'work', 'checklist'],
    url: 'yosemitecrew://tasks',
    type: 'navigate',
  },
  {
    id: 'go-inventory',
    label: 'Inventory',
    description: 'Stock and supplies',
    keywords: ['stock', 'supplies', 'drugs', 'products'],
    url: 'yosemitecrew://inventory',
    type: 'navigate',
  },
  {
    id: 'go-insights',
    label: 'Insights',
    description: 'Analytics and reporting',
    keywords: ['analytics', 'reports', 'data', 'statistics'],
    url: 'yosemitecrew://insights',
    type: 'navigate',
  },
  {
    id: 'go-forms',
    label: 'Forms',
    description: 'Templates and forms',
    keywords: ['templates', 'documents', 'forms'],
    url: 'yosemitecrew://forms',
    type: 'navigate',
  },
  {
    id: 'go-organization',
    label: 'Organization',
    description: 'Practice settings',
    keywords: ['practice', 'clinic', 'team', 'org'],
    url: 'yosemitecrew://organization',
    type: 'navigate',
  },
  {
    id: 'action-new-appointment',
    label: 'New appointment',
    description: 'Book a new appointment',
    keywords: ['create', 'schedule', 'book', 'add'],
    url: 'yosemitecrew://appointments?action=new',
    type: 'action',
  },
  {
    id: 'action-find-patient',
    label: 'Find patient',
    description: 'Search for a companion',
    keywords: ['search', 'lookup', 'client', 'find'],
    url: 'yosemitecrew://companions?action=search',
    type: 'action',
  },
  {
    id: 'action-new-invoice',
    label: 'Create invoice',
    description: 'Generate a new invoice',
    keywords: ['bill', 'charge', 'payment', 'create'],
    url: 'yosemitecrew://finance?action=new-invoice',
    type: 'action',
  },
  {
    id: 'action-check-in',
    label: 'Check in patient',
    description: 'Walk-in patient check-in',
    keywords: ['arrival', 'walk-in', 'register'],
    url: 'yosemitecrew://appointments?action=check-in',
    type: 'action',
  },
  {
    id: 'open-settings',
    label: 'Open settings',
    description: 'Application preferences',
    keywords: ['preferences', 'config', 'options'],
    type: 'action',
  },
  {
    id: 'tab:new',
    label: 'New tab',
    description: 'Open a new browser tab',
    keywords: ['tab', 'add', 'open'],
    type: 'action',
  },
  {
    id: 'tab:close',
    label: 'Close tab',
    description: 'Close the current tab',
    keywords: ['close', 'remove', 'exit'],
    type: 'action',
  },
  {
    id: 'tab:reopen',
    label: 'Reopen closed tab',
    description: 'Restore the last closed tab',
    keywords: ['undo', 'restore', 'reopen'],
    type: 'action',
  },
  {
    id: 'tab:search',
    label: 'Search tabs',
    description: 'Find and switch to a tab',
    keywords: ['find', 'switch', 'search', 'filter'],
    type: 'action',
  },
  {
    id: 'tab:toggle-vertical',
    label: 'Toggle vertical tabs',
    description: 'Switch between horizontal and sidebar layout',
    keywords: ['vertical', 'sidebar', 'layout', 'orientation'],
    type: 'action',
  },
  {
    id: 'tab:toggle-split',
    label: 'Toggle split view',
    description: 'View two tabs side by side',
    keywords: ['split', 'side', 'dual', 'layout'],
    type: 'action',
  },
];

export const scoreFuzzyMatch = (query: string, text: string): number => {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase().trim();

  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;

  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      if (consecutive > maxConsecutive) maxConsecutive = consecutive;
    } else {
      consecutive = 0;
    }
  }

  if (qi < q.length) return 0;
  return Math.min(50 + maxConsecutive * 5, 69);
};

export const searchPalette = (
  query: string,
  actions: PaletteItem[],
  recents: RecentEntry[]
): { item: PaletteItem; score: number }[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: { item: PaletteItem; score: number }[] = [];

  for (const item of actions) {
    const texts = [item.label, item.description || '', ...item.keywords].filter(Boolean);
    let bestScore = 0;
    for (const text of texts) {
      const s = scoreFuzzyMatch(q, text);
      if (s > bestScore) bestScore = s;
    }
    if (bestScore > 0) {
      const recentEntry = recents.find((r) => r.id === item.id);
      const recencyBoost = recentEntry
        ? Math.min(15, Math.max(0, 15 - (Date.now() - recentEntry.visitedAt) / 60000))
        : 0;
      scored.push({ item, score: bestScore + recencyBoost });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
};

export interface RecentsStore {
  load: () => RecentEntry[];
  recordVisit: (url: string, label: string, id: string) => RecentEntry[];
  clear: () => void;
}

interface StoreDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
}

export const createRecentsStore = (dirPath: string, deps: StoreDeps = {}): RecentsStore => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const filePath = path.join(dirPath, RECENTS_FILENAME);

  const load = (): RecentEntry[] => {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const entries: RecentEntry[] = JSON.parse(raw);
      if (!Array.isArray(entries)) return [];
      return entries.filter(
        (e) => typeof e.id === 'string' && typeof e.label === 'string' && typeof e.url === 'string'
      );
    } catch {
      return [];
    }
  };

  const recordVisit = (url: string, label: string, id: string): RecentEntry[] => {
    const entries = load().filter((e) => e.id !== id);
    entries.unshift({ id, label, url, visitedAt: Date.now() });
    const trimmed = entries.slice(0, MAX_RECENTS);

    try {
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, JSON.stringify(trimmed), 'utf8');
    } catch {
      // persist must never break the app
    }
    return trimmed;
  };

  const clear = (): void => {
    try {
      writeFileSync(filePath, '[]', 'utf8');
    } catch {
      // persist must never break the app
    }
  };

  return { load, recordVisit, clear };
};
