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
const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY = process.env.EXPIRE_IN || "15m";
const REFRESH_EXPIRY = process.env.EXPIRE_IN_REFRESH || "7d";



export const verifyToken =  (req: CustomRequest, res: Response, next: NextFunction) => {
  const accessToken = req.cookies?.accessToken as string;
  const refreshToken = req.cookies?.refreshToken as string;

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ message: 'No tokens provided' });
  }

  try {
    // ✅ Try verifying access token first
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(401).json({ message: 'Invalid access token type' });
    }
    const decoded = jwt.verify(accessToken, ACCESS_SECRET) as JwtPayload;
    req.user = decoded;
    return next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      // ⏳ Access token expired — try refresh token
      try {
        if (!refreshToken || typeof refreshToken !== 'string') {
          return res.status(401).json({ message: 'Invalid refresh token type' });
        }
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;

        // 🔄 Issue new tokens
        const newPayload = {
          userId: decodedRefresh.userId as string,
          email: decodedRefresh.email as string,
          userType: decodedRefresh.userType as string,
        };

        const newAccessToken = jwt.sign(newPayload, ACCESS_SECRET, {
          expiresIn: ACCESS_EXPIRY,
        });

        const newRefreshToken = jwt.sign(newPayload, REFRESH_SECRET, {
          expiresIn: REFRESH_EXPIRY,
        });

        // 🍪 Set new tokens as cookies
        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 1000 * 60 * 15, // 15 minutes
        });

        res.cookie('refreshToken', newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        });

        req.user = newPayload;
        return next();
      } catch {
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
      }
    } else {
      return res.status(403).json({ message: 'Invalid access token' });
    }
  }
};