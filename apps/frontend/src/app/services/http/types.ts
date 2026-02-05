import type { AxiosRequestConfig } from "axios";

export type HttpConfig = AxiosRequestConfig;

export type HttpResult<T> = {
  data: T;
  status: number;
};
