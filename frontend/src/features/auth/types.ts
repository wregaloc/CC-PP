import type { UserRole } from "@/types/roles";

/** Body de POST /auth/login — ver docs/API.md. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Response de POST /auth/login y /auth/refresh. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Body de POST /auth/change-password. */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/** Claims relevantes del access_token, decodificadas en el cliente solo para
 * UI (ver app/core/security.py::create_access_token en el backend). */
export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  is_active: boolean;
  exp: number;
  iat: number;
  jti: string;
}

/** Identidad mínima del usuario autenticado que expone AuthContext. */
export interface AuthUser {
  id: string;
  role: UserRole;
}
