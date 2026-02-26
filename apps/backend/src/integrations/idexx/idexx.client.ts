import axios, { AxiosInstance } from "axios";

export interface IdexxClientConfig {
  baseUrl?: string;
  username: string;
  password: string;
  pimsId: string;
  pimsVersion: string;
  labAccountId?: string;
}

export class IdexxClient {
  private readonly http: AxiosInstance;

  constructor(config: IdexxClientConfig) {
    const baseUrl = config.baseUrl ?? "https://integration.vetconnectplus.com";
    const authToken = Buffer.from(
      `${config.username}:${config.password}`,
      "utf8",
    ).toString("base64");

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${authToken}`,
        "X-Pims-Id": config.pimsId,
        "X-Pims-Version": config.pimsVersion,
        ...(config.labAccountId
          ? { "X-Lab-Account-Id": config.labAccountId }
          : {}),
      },
      timeout: 15000,
    });
  }

  async validateCredentials(): Promise<void> {
    await this.http.get("/api/v1/auth/validate");
  }
}
