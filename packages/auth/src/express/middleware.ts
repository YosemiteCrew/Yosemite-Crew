import type { Express } from 'express';
import cors from 'cors';
import SuperTokens from 'supertokens-node';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { getAuthAppInfo } from '../config/appInfo.js';

export function registerSuperTokensBeforeRoutes(app: Express): void {
  const appInfo = getAuthAppInfo();

  app.use(
    cors({
      origin: appInfo.websiteDomain,
      allowedHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders()],
      credentials: true,
    })
  );

  app.use(middleware());
}

export function registerSuperTokensErrorHandler(app: Express): void {
  app.use(errorHandler());
}
