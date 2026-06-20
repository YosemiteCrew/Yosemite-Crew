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
const nav = (
  id: string,
  label: string,
  description: string,
  keywords: string[],
  slug: string
): PaletteItem => ({
  id,
  label,
  description,
  keywords,
  url: `yosemitecrew://${slug}`,
  type: 'navigate',
});

const action = (
  id: string,
  label: string,
  description: string,
  keywords: string[],
  slug?: string
): PaletteItem => ({
  id,
  label,
  description,
  keywords,
  ...(slug ? { url: `yosemitecrew://${slug}` } : {}),
  type: 'action',
});

export const BUILTIN_ACTIONS: PaletteItem[] = [
  nav('go-dashboard', 'Dashboard', 'Go to workspace home', ['home', 'overview'], 'dashboard'),
  nav(
    'go-appointments',
    'Appointments',
    'View and manage appointments',
    ['schedule', 'calendar', 'visits', 'booking'],
    'appointments'
  ),
  nav(
    'go-patients',
    'Patients',
    'Companion (patient) records',
    ['records', 'clients', 'companions', 'medical', 'pets'],
    'companions'
  ),
  nav(
    'go-chat',
    'Chat',
    'Messages and notifications',
    ['messages', 'inbox', 'communication', 'alerts'],
    'chat'
  ),
  nav(
    'go-finance',
    'Finance',
    'Invoices and payments',
    ['invoices', 'payments', 'billing', 'charges'],
    'finance'
  ),
  nav('go-tasks', 'Tasks', 'Your tasks and to-dos', ['todo', 'work', 'checklist'], 'tasks'),
  nav(
    'go-inventory',
    'Inventory',
    'Stock and supplies',
    ['stock', 'supplies', 'drugs', 'products'],
    'inventory'
  ),
  nav(
    'go-insights',
    'Insights',
    'Analytics and reporting',
    ['analytics', 'reports', 'data', 'statistics'],
    'insights'
  ),
  nav('go-forms', 'Forms', 'Templates and forms', ['templates', 'documents', 'forms'], 'forms'),
  nav(
    'go-organization',
    'Organization',
    'Practice settings',
    ['practice', 'clinic', 'team', 'org'],
    'organization'
  ),
  action(
    'action-new-appointment',
    'New appointment',
    'Book a new appointment',
    ['create', 'schedule', 'book', 'add'],
    'appointments?action=new'
  ),
  action(
    'action-find-patient',
    'Find patient',
    'Search for a companion',
    ['search', 'lookup', 'client', 'find'],
    'companions?action=search'
  ),
  action(
    'action-new-invoice',
    'Create invoice',
    'Generate a new invoice',
    ['bill', 'charge', 'payment', 'create'],
    'finance?action=new-invoice'
  ),
  action(
    'action-check-in',
    'Check in patient',
    'Walk-in patient check-in',
    ['arrival', 'walk-in', 'register'],
    'appointments?action=check-in'
  ),
  action('open-settings', 'Open settings', 'Application preferences', [
    'preferences',
    'config',
    'options',
  ]),
  action('tab:new', 'New tab', 'Open a new browser tab', ['tab', 'add', 'open']),
  action('tab:close', 'Close tab', 'Close the current tab', ['close', 'remove', 'exit']),
  action('tab:reopen', 'Reopen closed tab', 'Restore the last closed tab', [
    'undo',
    'restore',
    'reopen',
  ]),
  action('tab:search', 'Search tabs', 'Find and switch to a tab', [
    'find',
    'switch',
    'search',
    'filter',
  ]),
  action(
    'tab:toggle-vertical',
    'Toggle vertical tabs',
    'Switch between horizontal and sidebar layout',
    ['vertical', 'sidebar', 'layout', 'orientation']
  ),
  action('tab:toggle-split', 'Toggle split view', 'View two tabs side by side', [
    'split',
    'side',
    'dual',
    'layout',
  ]),
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
