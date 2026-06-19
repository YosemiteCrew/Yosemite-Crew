'use strict';

import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import archiver from 'archiver';
import type { DesktopConfig } from '../core/navigation-policy';
import type { Archiver } from 'archiver';

export const DIAGNOSTICS_LOG_LINES = 500;
export const DIAGNOSTICS_FILENAME = 'diagnostics.json';
export const LOG_FILENAME = 'desktop.log';

export interface DiagnosticData {
  generatedAt: string;
  app: {
    name: string;
    version: string;
    isPackaged: boolean;
  };
  system: {
    platform: string;
    arch: string;
    release: string;
  };
  runtime: {
    electron: string;
    chrome: string;
    node: string;
    v8?: string;
  };
  config: {
    startUrl: string;
    allowedOrigins: string[];
    inAppPopupOrigins: string[];
    blockedPathPrefixes: string[];
    appPartition: string;
  };
  fuses: Record<string, boolean>;
  recentLogLines: number;
}

export interface BundleContext {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  v8Version?: string;
  platform: string;
  arch: string;
  osRelease: string;
  isPackaged: boolean;
  config: DesktopConfig;
  fuses: Record<string, boolean>;
}

export const collectDiagnosticData = (ctx: BundleContext): DiagnosticData => ({
  generatedAt: new Date().toISOString(),
  app: {
    name: 'Yosemite Crew PIMS',
    version: ctx.appVersion,
    isPackaged: ctx.isPackaged,
  },
  system: {
    platform: ctx.platform,
    arch: ctx.arch,
    release: ctx.osRelease,
  },
  runtime: {
    electron: ctx.electronVersion,
    chrome: ctx.chromeVersion,
    node: ctx.nodeVersion,
    ...(ctx.v8Version ? { v8: ctx.v8Version } : {}),
  },
  config: {
    startUrl: ctx.config.startUrl.href,
    allowedOrigins: [...ctx.config.allowedOrigins],
    inAppPopupOrigins: [...ctx.config.inAppPopupOrigins],
    blockedPathPrefixes: ctx.config.blockedPathPrefixes,
    appPartition: ctx.config.appPartition,
  },
  fuses: ctx.fuses,
  recentLogLines: 0,
});

export const readRecentLogEntries = (
  logPath: string | undefined,
  maxLines: number = DIAGNOSTICS_LOG_LINES
): string[] => {
  if (!logPath || !existsSync(logPath)) return [];
  try {
    const content = readFileSync(logPath, 'utf8');
    return content.split('\n').filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
};

export const createDiagnosticBundle = (
  data: DiagnosticData,
  logEntries: string[]
): { diagnosticsJson: string; logContent: string } => ({
  diagnosticsJson: JSON.stringify({ ...data, recentLogLines: logEntries.length }, null, 2),
  logContent: logEntries.join('\n'),
});

export const writeDiagnosticZip = (
  destPath: string,
  diagnosticsJson: string,
  logContent: string
): Promise<string> => {
  const archive: Archiver = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(destPath);

  return new Promise<string>((resolve, reject) => {
    output.on('close', () => resolve(destPath));
    output.on('error', (err) => reject(err));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.append(diagnosticsJson, { name: DIAGNOSTICS_FILENAME });

    if (logContent) {
      archive.append(logContent, { name: LOG_FILENAME });
    }

    void archive.finalize();
  });
};
