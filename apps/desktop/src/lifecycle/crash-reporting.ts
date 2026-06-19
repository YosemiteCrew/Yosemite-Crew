'use strict';

import path from 'node:path';
import type { App, CrashReporter } from 'electron';
import type { DesktopLogger } from '../utils/logger';

interface CrashReportingDeps {
  app: Pick<App, 'getPath' | 'setPath' | 'getVersion' | 'isPackaged'>;
  crashReporter: Pick<CrashReporter, 'start'>;
  logger: DesktopLogger;
  env?: NodeJS.ProcessEnv;
}

interface CrashLoggingDeps {
  app: Pick<App, 'on'>;
  logger: DesktopLogger;
}

const CRASH_UPLOAD_URL_ENV = 'YC_DESKTOP_CRASH_UPLOAD_URL';

export const createCrashReporter = ({
  app,
  crashReporter,
  logger,
  env = process.env,
}: CrashReportingDeps): void => {
  const crashDir = path.join(app.getPath('userData'), 'crashes');
  try {
    app.setPath('crashDumps', crashDir);
  } catch (error) {
    logger.warn('crash_dump_path_failed', { error });
  }

  const uploadUrl = env[CRASH_UPLOAD_URL_ENV];
  const uploadToServer = Boolean(uploadUrl);

  crashReporter.start({
    productName: 'Yosemite Crew PIMS',
    companyName: 'Yosemite Crew',
    submitURL: uploadUrl || 'https://crash.invalid.yosemitecrew.local',
    uploadToServer,
    compress: uploadToServer,
    ignoreSystemCrashHandler: false,
    extra: {
      version: app.getVersion(),
      packaged: String(app.isPackaged),
    },
  });

  logger.info('crash_reporter_started', { crashDir, uploadToServer });
};

export const wireCrashLogging = ({ app, logger }: CrashLoggingDeps): void => {
  app.on('render-process-gone', (_event, webContents, details) => {
    logger.error('render_process_gone', {
      reason: details.reason,
      exitCode: details.exitCode,
      url: webContents?.getURL?.(),
    });
  });

  app.on('child-process-gone', (_event, details) => {
    logger.error('child_process_gone', details);
  });

  app.on('gpu-info-update', () => {
    logger.info('gpu_info_update');
  });
};

export const CRASH_REPORTING_ENV = {
  CRASH_UPLOAD_URL_ENV,
};
