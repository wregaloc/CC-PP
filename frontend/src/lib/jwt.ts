/**
 * Decodifica el payload de un JWT sin verificar la firma — solo para lectura
 * de claims en el cliente con fines de UI (mostrar el rol, saber si expiró
 * para no esperar a un 401). La única verificación real vive en el backend
 * (ver [[enterprise-security]]: nunca confiar en el cliente para autorización).
 */
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
