import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtHeader, type JwtPayload, type SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import logger from "../utils/logger";

const { COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_AUDIENCE } = process.env;

if (!COGNITO_REGION || !COGNITO_USER_POOL_ID) {
  logger.warn(
    "Cognito middleware is missing configuration. Set COGNITO_REGION and COGNITO_USER_POOL_ID to enable JWT validation.",
  );
}

const issuer = COGNITO_REGION && COGNITO_USER_POOL_ID
  ? `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`
  : undefined;

const client = issuer
  ? jwksClient({
      jwksUri: `${issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 20,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    })
  : null;

const getKey = (header: JwtHeader, callback: SigningKeyCallback) => {
  if (!client || !header.kid) {
    callback(new Error("Unable to retrieve signing key"));
    return;
  }

  client.getSigningKey(header.kid).then(
    (key) => {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    },
    (err : Error) => {
      logger.error("Failed to fetch signing key from JWKS", err);
      callback(err);
    },
  );
};

const verifyToken = (token: string): Promise<JwtPayload> => {
  if (!issuer) {
    return Promise.reject(new Error("Cognito JWT verification is not configured"));
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer,
        audience: COGNITO_AUDIENCE,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }

        if (!decoded || typeof decoded === "string") {
          reject(new Error("JWT payload is not an object"));
          return;
        }

        resolve(decoded);
      },
    );
  });
};

export interface CognitoJwtPayload extends JwtPayload {
  username?: string;
  [claim: string]: unknown;
}

export type AuthenticatedRequest<
  TParams = Request["params"],
  TResBody = unknown,
  TReqBody = unknown,
  TLocals extends Record<string, unknown> = Record<string, unknown>,
> = Request<TParams, TResBody, TReqBody, TLocals> & {
  auth?: CognitoJwtPayload;
};

export const authorizeCognito = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authorization header missing or invalid" });
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const payload = await verifyToken(token);

    (req as AuthenticatedRequest).auth = payload;

    next();
  } catch (error) {
    logger.warn(`JWT validation failed: ${(error as Error).message}`);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authorizeCognito;
