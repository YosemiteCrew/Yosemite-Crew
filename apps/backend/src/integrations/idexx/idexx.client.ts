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

  async getRefVersions<T = unknown>(): Promise<T> {
    const { data } = await this.http.get("/api/v1/ref/versions");
    return data as T;
  }

  async getRefSpecies<T = unknown>(): Promise<T> {
    const { data } = await this.http.get("/api/v1/ref/species");
    return data as T;
  }

  async getRefBreeds<T = unknown>(): Promise<T> {
    const { data } = await this.http.get("/api/v1/ref/breeds");
    return data as T;
  }

  async getRefGenders<T = unknown>(): Promise<T> {
    const { data } = await this.http.get("/api/v1/ref/genders");
    return data as T;
  }

  async getRefTests<T = unknown>(): Promise<T> {
    const { data } = await this.http.get("/api/v1/ref/tests");
    return data as T;
  }
}
