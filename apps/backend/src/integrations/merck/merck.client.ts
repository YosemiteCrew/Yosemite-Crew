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

  async search(
    params: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<{
    data: string;
    contentType: string | null;
    status: number;
    finalUrl: string | null;
  }> {
    const response = await this.http.get<string>("", {
      params,
      headers,
      responseType: "text",
    });
    const data: unknown = response.data;
    const text = typeof data === "string" ? data : JSON.stringify(data ?? "");
    const contentType = String(response.headers?.["content-type"] ?? "").trim();
    const finalUrl =
      (response.request as { res?: { responseUrl?: string } })?.res
        ?.responseUrl ?? null;
    return {
      data: text,
      contentType: contentType || null,
      status: response.status,
      finalUrl,
    };
  }
}
