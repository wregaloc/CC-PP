import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "@/features/auth/api/authApi";
import type { AccessTokenClaims, AuthUser } from "@/features/auth/types";
import { normalizeError } from "@/lib/apiError";
import { decodeJwtPayload } from "@/lib/jwt";
import { getAccessToken, setAccessToken, subscribeAccessToken } from "@/lib/tokenStore";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true mientras se resuelve el arranque de sesión inicial (POST /auth/refresh) */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const claims = decodeJwtPayload<AccessTokenClaims>(token);
  if (!claims) return null;
  return { id: claims.sub, role: claims.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => userFromToken(getAccessToken()));
  const [isLoading, setIsLoading] = useState(true);

  // Mantiene sincronizado el estado de React con tokenStore, que también
  // puede cambiar fuera de este componente (el interceptor 401 de httpClient
  // limpia el token si un refresh silencioso falla en cualquier request).
  useEffect(() => subscribeAccessToken((token) => setUser(userFromToken(token))), []);

  useEffect(() => {
    let cancelled = false;
    // Arranque de sesión: si existe una cookie de refresh_token válida de una
    // visita anterior, esto la canjea por un access_token nuevo sin pedir
    // login de nuevo. Que falle (no hay cookie, o expiró) es el flujo
    // esperado para un visitante no autenticado, no un error a mostrar.
    authApi
      .refresh()
      .then((tokens) => {
        if (!cancelled) setAccessToken(tokens.access_token);
      })
      .catch(() => {
        if (!cancelled) setAccessToken(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const tokens = await authApi.login({ email, password });
      setAccessToken(tokens.access_token);
    } catch (error) {
      throw normalizeError(error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Aunque el backend falle al invalidar el refresh token, la sesión del
      // cliente se limpia igual — fail closed del lado del cliente: nunca
      // dejar una sesión "a medias" que parezca activa en la UI.
    } finally {
      setAccessToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return context;
}
