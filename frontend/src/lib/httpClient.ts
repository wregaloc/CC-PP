import axios, { type InternalAxiosRequestConfig } from "axios";

import { normalizeError } from "@/lib/apiError";
import { getAccessToken, setAccessToken } from "@/lib/tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Cliente HTTP único de la app (ver [[react-enterprise-frontend]] — Axios es
 * el estándar del proyecto). `withCredentials` es necesario para que el
 * navegador mande la cookie HttpOnly del refresh_token en /auth/refresh y
 * /auth/logout (ver docs/API.md).
 */
export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS_WITHOUT_RETRY = ["/auth/login", "/auth/refresh"];

let refreshPromise: Promise<string | null> | null = null;

/**
 * Pide un access_token nuevo con la cookie del refresh_token. Usa una
 * instancia de axios *sin* los interceptores de arriba a propósito — si
 * usara `httpClient`, un 401 de /auth/refresh volvería a disparar este mismo
 * interceptor y crearía un bucle infinito.
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post<{ access_token: string }>(
      `${API_BASE_URL}/auth/refresh`,
      null,
      { withCredentials: true },
    );
    setAccessToken(response.data.access_token);
    return response.data.access_token;
  } catch {
    setAccessToken(null);
    return null;
  }
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_RETRY.some((path) =>
      originalRequest?.url?.includes(path),
    );

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      // Varias requests pueden fallar con 401 a la vez (p. ej. al expirar el
      // access_token mientras la página tiene varias queries en curso) — se
      // comparte una sola promesa de refresh en vez de disparar una por cada
      // request, todas esperan el mismo resultado.
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return httpClient(originalRequest);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);
