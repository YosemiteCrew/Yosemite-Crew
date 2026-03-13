import axios, { AxiosInstance } from "axios";

export interface MerckHealthlinkClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

export class MerckHealthlinkClient {
  private readonly http: AxiosInstance;

  constructor(config: MerckHealthlinkClientConfig) {
    const baseUrl = config.baseUrl.replace(/\?+$/, "");
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: config.timeoutMs,
    });
  }

  async search(params: Record<string, string>): Promise<string> {
    const response = await this.http.get<string>("", {
      params,
      responseType: "text",
    });
    const data: unknown = response.data;
    if (typeof data === "string") return data;
    return JSON.stringify(data ?? "");
  }
}
