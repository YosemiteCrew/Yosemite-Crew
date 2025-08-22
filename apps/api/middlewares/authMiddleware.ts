import dotenv from 'dotenv';
dotenv.config();
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

// Extend the Request interface to include the user payload after decoding JWT
interface CustomRequest extends Request {
  user?: string | JwtPayload;
}

// ✅ Middleware: Verifies access token and attaches user info to req.user
export const verifyTokenAndRefresh = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): void => {
  // Extract token from Authorization header: "Bearer <token>"
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  // Verify the token using JWT_SECRET
  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
    if (err) {
      console.log('Token verification error:', err.message);
      res.status(401).json({ message: 'Unauthorized', error: err.message });
      return;
    }

    // Attach decoded token data to the request
    req.user = decoded;
    next(); // Continue to the next middleware or route handler
  });
};





export const getCognitoUserId = (req: Request) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('Missing token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  return decoded?.username as string;
}

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_SECRET = process.env.JWT_SECRET as string;
const ACCESS_EXPIRY = process.env.EXPIRE_IN ?? "15m"; // short-lived
const REFRESH_EXPIRY = process.env.EXPIRE_IN_REFRESH;


interface CustomRequest extends Request {
  user?: JwtPayload;
}

export const verifyToken = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;
    //  console.log("Access Token:", accessToken);
  // console.log("Refresh Token:", refreshToken);
  // 1️⃣ If neither token is present
  if (!accessToken && !refreshToken) {
     res.status(401).json({ message: 'No tokens provided' });
     return
  }

  // 2️⃣ Try Access Token
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, ACCESS_SECRET) as JwtPayload;
      // console.log("Decoded Access Token:", decoded);
      req.user = decoded;
       next(); // ✅ Access token is valid
       return
    } catch (err) {
      if (!(err instanceof jwt.TokenExpiredError)) {
         res.status(403).json({ message: 'Invalid access token' });
         return
      }
      // else — token expired, try refresh
    }
  }

  // 3️⃣ Access token failed or expired — Try Refresh Token
  if (refreshToken) {
    try {
      const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
      console.log("Decoded Refresh Token:", decodedRefresh);
      const newPayload = {
        userId: decodedRefresh.userId,
        email: decodedRefresh.email,
        userType: decodedRefresh.userType,
      };

      // Sign new tokens
      const newAccessToken = jwt.sign(newPayload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
      });

      const newRefreshToken = jwt.sign(newPayload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
      });

      // Set new tokens
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "development",
        sameSite: "strict",
        maxAge: 1000 * 60 * 15,
      });

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "development",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      req.user = newPayload;
       next(); // ✅ Token refreshed
       return
    } catch (err) {
       res.status(403).json({ message: 'Invalid or expired refresh token' });
       return
    }
  }

  // 4️⃣ Fallback - no valid tokens
   res.status(401).json({ message: 'Authentication failed' });
   return
};