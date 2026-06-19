'use strict';

export interface TasksCategory {
  type: 'tasks';
  items: { title: string; args: string }[];
}

export const createJumpList = (exeName: string): TasksCategory[] => {
  return [
    {
      type: 'tasks',
      items: [
        { title: `Open ${exeName.replace('.exe', '')}`, args: '' },
        { title: 'Check for Updates', args: '--check-for-updates' },
      ],
    },
  ];
};

export interface WindowsNiceties {
  getWindowsVersion: () => string;
  setTaskbarProgress: (progress: number) => void;
  flashTaskbar: () => void;
}

interface WinDeps {
  getWindowsVersion?: () => string;
  mainWindow?: {
    setProgressBar: (progress: number) => void;
    flashFrame: (flash: boolean) => void;
  };
}

export const createWindowsNiceties = (deps: WinDeps = {}): WindowsNiceties => {
  const getWindowsVersion = deps.getWindowsVersion || (() => '10.0.0');

  const setTaskbarProgress = (progress: number): void => {
    if (!deps.mainWindow) return;
    try {
      deps.mainWindow.setProgressBar(Math.max(0, Math.min(1, progress)));
    } catch {
      // Taskbar progress is non-critical
    }
  };

  const flashTaskbar = (): void => {
    if (!deps.mainWindow) return;
    try {
      deps.mainWindow.flashFrame(true);
    } catch {
      // Taskbar flash is non-critical
    }
  };

  return {
    getWindowsVersion,
    setTaskbarProgress,
    flashTaskbar,
  };
};
