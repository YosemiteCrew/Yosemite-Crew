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





export const getCognitoUserId = (req : Request) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('Missing token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  return decoded?.username as string;
}

// ✅ Optional endpoint to issue new tokens using refresh token
// export const refreshToken = (req: Request, res: Response): void => {
//   const { refreshToken } = req.body;

//   if (!refreshToken) {
//     res.status(401).json({ message: 'No refresh token provided' });
//     return;
//   }

//   // Verify the refresh token
//   jwt.verify(refreshToken, process.env.JWT_SECRET as string, (err, decoded) => {
//     if (err || typeof decoded === 'string') {
//       console.log('Refresh Token verification failed:', err?.message);
//       res.status(403).json({ message: 'Invalid or expired refresh token' });
//       return;
//     }

//     // Payload for generating new tokens
//     const payload = {
//       email: decoded.email,
//       userId: decoded.userId,
//       userType: decoded.businessType,
//     };

//     // Create a new access token
//     const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
//       expiresIn: process.env.EXPIRE_IN,
//     });

//     // Create a new refresh token
//     const newRefreshToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
//       expiresIn: process.env.EXPIRE_IN_REFRESH,
//     });

//     // Send tokens back to client
//     res.json({ token: newAccessToken, refreshToken: newRefreshToken });
//   });
// };

/*
=====================================================================
📝 PREVIOUS VERSIONS (COMMENTED FOR REFERENCE AND BACKWARD COMPATIBILITY)
=====================================================================

// Legacy: Basic verifyToken implementation using require and JS syntax
// const jwt = require("jsonwebtoken");
// const verifyTokenAndRefresh = (req, res, next) => {
//   const token = req.headers["authorization"]?.split(" ")[1];
//   if (!token) {
//     console.log("No token provided");
//     return res.status(401).json({ message: "No token provided" });
//   }
//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       console.log("Token verification error:", err.message);
//       return res.status(401).json({ message: "Unauthorized", error: err.message });
//     }
//     req.user = decoded;
//     next();
//   });
// };

// Legacy: Handles token from sessionStorage frontend - older version
// const verifyTokenAndRefresh = (req, res, next) => {
//   const accessToken = req.headers.authorization?.split(" ")[1];
//   if (accessToken) {
//     jwt.verify(accessToken, process.env.JWT_SECRET, (err, decoded) => {
//       if (err) {
//         console.log("Access Token verification failed:", err.message);
//         return res.status(403).json({
//           message: "Invalid or expired access token and no refresh token",
//         });
//       }
//       console.log("Access Token verified:", decoded);
//       req.user = decoded;
//       return next();
//     });
//   } else {
//     return res.status(401).json({ message: "No tokens provided" });
//   }
// };

// Legacy: Refresh token logic (non-TS version)
// const refreshToken = (req, res) => {
//   const { refreshToken } = req.body;
//   if (!refreshToken) {
//     return res.status(401).json({ message: "No refresh token provided" });
//   }
//   jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       console.log("Refresh Token verification failed:", err.message);
//       return res.status(403).json({ message: "Invalid or expired refresh token" });
//     }
//     const newAccessToken = jwt.sign(
//       { email: decoded.email, userId: decoded.userId, userType: decoded.businessType },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.EXPIRE_IN }
//     );
//     const refreshToken = jwt.sign(
//       { email: decoded.email, userId: decoded.userId, userType: decoded.businessType },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.EXPIRE_IN_REFRESH }
//     );
//     res.json({ token: newAccessToken, refreshToken: refreshToken });
//   });
// };
*/

