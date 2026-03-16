import axios, { AxiosInstance } from "axios";

export interface IdexxResultsClientConfig {
  baseUrl?: string;
  username: string;
  password: string;
  pimsId: string;
  pimsVersion: string;
}

export class IdexxResultsClient {
  private readonly http: AxiosInstance;

  private normalizeHeaders(
    headers: Record<string, unknown>,
  ): Record<string, string> {
    const normalized: Record<string, string> = {};
    const coerceValue = (input: unknown): string | null => {
      if (typeof input === "string") return input;
      if (
        typeof input === "number" ||
        typeof input === "boolean" ||
        typeof input === "bigint"
      ) {
        return String(input);
      }
      if (Array.isArray(input)) {
        const parts = input
          .map(coerceValue)
          .filter((value): value is string => value !== null);
        return parts.length ? parts.join(", ") : null;
      }
      return null;
    };

    for (const [key, value] of Object.entries(headers)) {
      const stringValue = coerceValue(value);
      if (!stringValue) continue;
      normalized[key.toLowerCase()] = stringValue;
    }
    return normalized;
  }

  constructor(config: IdexxResultsClientConfig) {
    const baseUrl = config.baseUrl ?? "https://partner.vetconnectplus.com";
    const authToken = Buffer.from(
      `${config.username}:${config.password}`,
      "utf8",
    ).toString("base64");

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${authToken}`,
        "x-pims-id": config.pimsId,
        "x-pims-version": config.pimsVersion,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });
  }

  async getLatestResults<T = unknown>(limit = 50): Promise<T> {
    const response = await this.http.get<T>(
      `/api/v3/results/latest?limit=${limit}`,
    );
    return response.data;
  }

  async confirmLatestBatch<T = unknown>(batchId: string): Promise<T> {
    const response = await this.http.post<T>(
      `/api/v3/results/latest/confirm/${encodeURIComponent(batchId)}`,
    );
    return response.data;
  }

  async getResult<T = unknown>(resultId: string): Promise<T> {
    const response = await this.http.get<T>(
      `/api/v3/results/${encodeURIComponent(resultId)}`,
    );
    return response.data;
  }

  async getResultPdf(
    resultId: string,
  ): Promise<{ data: ArrayBuffer; headers: Record<string, string> }> {
    const response = await this.http.get<ArrayBuffer>(
      `/api/v3/results/${encodeURIComponent(resultId)}/pdf`,
      { responseType: "arraybuffer" },
    );
    return {
      data: response.data,
      headers: this.normalizeHeaders(response.headers as Record<string, unknown>),
    };
  }

  async getResultNotificationsPdf(
    resultId: string,
  ): Promise<{ data: ArrayBuffer; headers: Record<string, string> }> {
    const response = await this.http.get<ArrayBuffer>(
      `/api/v3/results/${encodeURIComponent(resultId)}/notifications/pdf`,
      { responseType: "arraybuffer" },
    );
    return {
      data: response.data,
      headers: this.normalizeHeaders(response.headers as Record<string, unknown>),
    };
  }

  async searchResults<T = unknown>(
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const response = await this.http.get<T>(
      `/api/v3/results/search?${query.toString()}`,
    );
    return response.data;
  }
}
