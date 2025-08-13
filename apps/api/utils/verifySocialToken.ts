import { OAuth2Client } from "google-auth-library";
// import jwt from "jsonwebtoken";
// import axios from "axios";
// import jwksClient from "jwks-rsa";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---- GOOGLE ----
const verifyGoogleToken = async (idToken: string) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

// ---- APPLE ----
// const verifyAppleToken = async (idToken: string) => {
//   const appleKeysUrl = "https://appleid.apple.com/auth/keys";

//   // Fetch Apple public keys
//   const client = jwksClient({
//     jwksUri: appleKeysUrl,
//   });

//   const decoded = jwt.decode(idToken, { complete: true })
//   if (!decoded || !decoded.header || !decoded.header.kid) {
//     throw new Error("Invalid Apple token");
//   }

//   const key = await client.getSigningKey(decoded.header.kid);
//   const publicKey = key.getPublicKey();

//   const verified = jwt.verify(idToken, publicKey, {
//     algorithms: ["RS256"],
//   });

//   return {
//     email: verified.email,
//     sub: verified.sub,
//     email_verified: verified.email_verified,
//   };
// };

// // ---- FACEBOOK ----
// const verifyFacebookToken = async (accessToken: string) => {
//   const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;

//   const response = await axios.get(url);
//   if (response.status !== 200 || !response.data) {
//     throw new Error("Invalid Facebook token");
//   }

//   return {
//     id: response.data.id,
//     email: response.data.email,
//     name: response.data.name,
//   };
// };

// ---- MAIN WRAPPER FUNCTION ----
export const verifySocialToken = async (provider: string, token: string) => {
  switch (provider.toLowerCase()) {
    case "google":
      return await verifyGoogleToken(token);

    // case "apple":
    //   return await verifyAppleToken(token);

    // case "facebook":
    //   return await verifyFacebookToken(token);

    default:
      throw new Error("Unsupported social login provider: " + provider);
  }
};
