/**
 * Almacén en memoria del access token — deliberadamente NO usa localStorage
 * (ver [[enterprise-security]] y docs/API.md: el access_token vive solo en
 * memoria del cliente). Se pierde al recargar la página a propósito; el
 * arranque de sesión (AuthProvider) lo repone llamando a /auth/refresh, que
 * usa la cookie httpOnly del refresh_token.
 *
 * Vive fuera de React (no es un Context) porque el interceptor de axios en
 * httpClient.ts necesita leerlo/escribirlo sin depender del árbol de
 * componentes — AuthContext se suscribe a los cambios para mantener su
 * propio estado de React sincronizado.
 */

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) {
    listener(token);
  }
}

export function subscribeAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
