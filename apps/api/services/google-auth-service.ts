
import { OAuth2Client } from "google-auth-library";
import keys from "../google-services.json";

export class GoogleAuth {
  static getAuthenticatedClient(): OAuth2Client {
    
    return new OAuth2Client({
      clientId: keys.web.client_id,
      clientSecret: keys.web.client_secret,
      redirectUri: keys.web.redirect_uris[0],
    });
  }

  static getAuthUrl(): string {
    const oAuth2Client = this.getAuthenticatedClient();
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ];
    return oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });
  }
}
