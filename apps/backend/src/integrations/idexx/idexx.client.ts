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
    const response = await this.http.get<T>("/api/v1/ref/versions");
    return response.data;
  }

  async getRefSpecies<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/ref/species");
    return response.data;
  }

  async getRefBreeds<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/ref/breeds");
    return response.data;
  }

  async getRefGenders<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/ref/genders");
    return response.data;
  }

  async getRefTests<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/ref/tests");
    return response.data;
  }

  async createOrder<T = unknown>(payload: unknown): Promise<T> {
    const response = await this.http.post<T>("/api/v1/order", payload);
    return response.data;
  }

  async getOrder<T = unknown>(idexxOrderId: string): Promise<T> {
    const response = await this.http.get<T>(`/api/v1/order/${idexxOrderId}`);
    return response.data;
  }

  async updateOrder<T = unknown>(idexxOrderId: string, payload: unknown): Promise<T> {
    const response = await this.http.put<T>(
      `/api/v1/order/${idexxOrderId}`,
      payload,
    );
    return response.data;
  }

  async cancelOrder<T = unknown>(idexxOrderId: string): Promise<T> {
    const response = await this.http.delete<T>(`/api/v1/order/${idexxOrderId}`);
    return response.data;
  }

  async addCensusPatient<T = unknown>(payload: unknown): Promise<T> {
    const response = await this.http.post<T>("/api/v1/census", payload);
    return response.data;
  }

  async listCensus<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/census");
    return response.data;
  }

  async deleteCensus<T = unknown>(): Promise<T> {
    const response = await this.http.delete<T>("/api/v1/census");
    return response.data;
  }

  async getCensusById<T = unknown>(censusId: string): Promise<T> {
    const response = await this.http.get<T>(
      `/api/v1/census/${encodeURIComponent(censusId)}`,
    );
    return response.data;
  }

  async deleteCensusById<T = unknown>(censusId: string): Promise<T> {
    const response = await this.http.delete<T>(
      `/api/v1/census/${encodeURIComponent(censusId)}`,
    );
    return response.data;
  }

  async getCensusPatient<T = unknown>(patientId: string): Promise<T> {
    const response = await this.http.get<T>(
      `/api/v1/census/patient?patientId=${encodeURIComponent(patientId)}`,
    );
    return response.data;
  }

  async deleteCensusPatient<T = unknown>(patientId: string): Promise<T> {
    const response = await this.http.delete<T>(
      `/api/v1/census/patient?patientId=${encodeURIComponent(patientId)}`,
    );
    return response.data;
  }

  async listIvlsDevices<T = unknown>(): Promise<T> {
    const response = await this.http.get<T>("/api/v1/ivls/devices");
    return response.data;
  }
}
