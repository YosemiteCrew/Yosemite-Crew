import type { AxiosRequestConfig } from "axios";
import api from "@/app/services/axios";
import { normalizeHttpError } from "@/app/services/http/errors";

const unwrap = <T>(res: { data: T; status: number }) => ({ data: res.data, status: res.status });

export const http = {
  get: async <T>(url: string, config?: AxiosRequestConfig) => {
    try {
      const res = await api.get<T>(url, config);
      return unwrap(res);
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  post: async <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) => {
    try {
      const res = await api.post<T>(url, data, config);
      return unwrap(res);
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  put: async <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) => {
    try {
      const res = await api.put<T>(url, data, config);
      return unwrap(res);
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  patch: async <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) => {
    try {
      const res = await api.patch<T>(url, data, config);
      return unwrap(res);
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig) => {
    try {
      const res = await api.delete<T>(url, config);
      return unwrap(res);
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
};
