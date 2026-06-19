'use strict';

export type WindowDisplayMode = 'mirror' | 'extend';
export type DisplayRole = 'whiteboard' | 'kiosk' | 'presentation';

export interface DisplayConfig {
  role: DisplayRole;
  url: string;
  mode: WindowDisplayMode;
  displayIndex: number;
}

export interface DisplayInfo {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  scaleFactor: number;
}

export interface SecondaryDisplayManager {
  openDisplay: (config: DisplayConfig) => string;
  closeDisplay: (id: string) => boolean;
  closeAll: () => void;
  getDisplayIds: () => string[];
  getDisplays: () => {
    id: string;
    config: DisplayConfig;
    status: 'open' | 'closed';
  }[];
}

interface DisplayDeps {
  getDisplays?: () => DisplayInfo[];
  createWindow?: (config: DisplayConfig, display: DisplayInfo) => string;
  closeWindow?: (id: string) => boolean;
  generateId?: () => string;
}

let dispCounter = 0;
const defaultGenerateId = (): string => `display-${Date.now()}-${++dispCounter}`;

const WHITEBOARD_THEME_CSS = `
<style>
  body {
    margin: 0; padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0;
    display: flex; flex-direction: column; height: 100vh;
  }
  .header { border-bottom: 1px solid #334155; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 24px; margin: 0; color: #f8fafc; }
  .header .date { color: #94a3b8; font-size: 14px; }
  .patient-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; flex: 1; overflow-y: auto; }
  .patient-card { background: #1e293b; border-radius: 8px; padding: 16px; border-left: 4px solid #3b82f6; }
  .patient-card.checked-in { border-left-color: #22c55e; }
  .patient-card.in-treatment { border-left-color: #eab308; }
  .patient-card.waiting { border-left-color: #3b82f6; }
  .patient-name { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .patient-info { font-size: 13px; color: #94a3b8; }
  .patient-status { font-size: 12px; margin-top: 8px; padding: 2px 8px; border-radius: 4px; display: inline-block; }
  .status-waiting { background: #1e3a5f; color: #60a5fa; }
  .status-checked-in { background: #14532d; color: #4ade80; }
  .status-treatment { background: #713f12; color: #facc15; }
  .footer { border-top: 1px solid #334155; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center; }
</style>
`;

export const generateWhiteboardHtml = (
  patients: Array<{
    name: string;
    owner?: string;
    status: string;
    reason?: string;
    waitTime?: number;
  }>
): string => {
  const cards = patients
    .map((p) => {
      let statusClass = 'waiting';
      if (p.status === 'checked-in') statusClass = 'checked-in';
      else if (p.status === 'in-treatment') statusClass = 'in-treatment';
      return `<div class="patient-card ${statusClass}">
      <p class="patient-name">${escapeHtml(p.name)}</p>
      ${p.owner ? `<p class="patient-info">Owner: ${escapeHtml(p.owner)}</p>` : ''}
      <span class="patient-status status-${p.status}">${escapeHtml(p.status.replace('-', ' '))}</span>
      ${p.waitTime ? `<span class="patient-info" style="margin-left: 8px;">Wait: ${p.waitTime}m</span>` : ''}
      ${p.reason ? `<p class="patient-info" style="margin-top: 4px;">${escapeHtml(p.reason)}</p>` : ''}
    </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><head>${WHITEBOARD_THEME_CSS}<meta charset="utf-8"><title>Exam Room Whiteboard</title></head><body>
    <div class="header">
      <h1>Exam Room Whiteboard</h1>
      <div class="date">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
    <div class="patient-grid">${cards || '<p style="color: #64748b;">No patients currently in the clinic.</p>'}</div>
    <div class="footer">Yosemite Crew PIMS &mdash; Auto-refreshes every 30 seconds</div>
  </body></html>`;
};

const escapeHtml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const createSecondaryDisplayManager = (deps: DisplayDeps = {}): SecondaryDisplayManager => {
  const getDisplays = deps.getDisplays || (() => []);
  const createWindow = deps.createWindow || (() => defaultGenerateId());
  const closeWindow = deps.closeWindow || (() => true);
  const generateId = deps.generateId || defaultGenerateId;

  const openDisplays = new Map<
    string,
    { config: DisplayConfig; status: 'open' | 'closed'; windowId: string }
  >();

  const findNonPrimaryDisplay = (): DisplayInfo | undefined =>
    getDisplays().find((d) => !d.isPrimary);

  const openDisplay = (config: DisplayConfig): string => {
    const id = generateId();
    const display = getDisplays()[config.displayIndex] || findNonPrimaryDisplay();
    // Keep the id returned by createWindow: production's closeWindow looks the
    // BrowserWindow up by that real id, not by the generated display id.
    const windowId = createWindow(
      config,
      display || {
        id: 'default',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        isPrimary: true,
        scaleFactor: 1,
      }
    );
    openDisplays.set(id, { config, status: 'open', windowId });
    return id;
  };

  const closeDisplay = (id: string): boolean => {
    const entry = openDisplays.get(id);
    if (!entry) return false;
    closeWindow(entry.windowId);
    openDisplays.delete(id);
    return true;
  };

  const closeAll = (): void => {
    for (const entry of openDisplays.values()) {
      closeWindow(entry.windowId);
    }
    openDisplays.clear();
  };

  const getDisplayIds = (): string[] => [...openDisplays.keys()];

  const getDisplaysState = (): {
    id: string;
    config: DisplayConfig;
    status: 'open' | 'closed';
  }[] =>
    Array.from(openDisplays.entries()).map(([id, state]) => ({
      id,
      config: state.config,
      status: state.status,
    }));

  return {
    openDisplay,
    closeDisplay,
    closeAll,
    getDisplayIds,
    getDisplays: getDisplaysState,
  };
};
