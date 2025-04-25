const jwt = require("jsonwebtoken");

const verifyTokenAndRefresh = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Get token from the 'Authorization' header

  console.log("Token:", token); // Log the token for debugging

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Token verification error:", err.message);
      return res
        .status(401)
        .json({ message: "Unauthorized", error: err.message });
    } else { /* empty */ }
    console.log("verify");
    req.user = decoded; // Attach the decoded user information to the request
    next(); // Proceed to the next middleware or route handler
  });
};

// module.exports = authMiddleware;

// const verifyTokenAndRefresh = (req, res, next) => {
//   // Get tokens from headers or body (since using sessionStorage on frontend)
//   const accessToken = req.headers.authorization?.split(" ")[1]; // Bearer <accessToken>

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

// const refreshToken = (req, res) => {
//   const { refreshToken } = req.body;

//   if (!refreshToken) {
//     return res.status(401).json({ message: "No refresh token provided" });
//   }

//   jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       console.log("Refresh Token verification failed:", err.message);
//       return res
//         .status(403)
//         .json({ message: "Invalid or expired refresh token" });
//     }

//     // Generate a new access token
//     const newAccessToken = jwt.sign(
//       {
//         email: decoded.email,
//         userId: decoded.userId,
//         userType: decoded.businessType,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.EXPIRE_IN }
//     );
//     const refreshToken = jwt.sign(
//       {
//         email: decoded.email,
//         userId: decoded.userId,
//         userType: decoded.businessType,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.EXPIRE_IN_REFRESH }
//     );

//     // Send the new access token as a response
//     res.json({ token: newAccessToken, refreshToken: refreshToken });
//   });
// };

module.exports = {
  verifyTokenAndRefresh,
  // authMiddleware
};
