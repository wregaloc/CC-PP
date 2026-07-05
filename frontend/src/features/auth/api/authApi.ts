import { httpClient } from "@/lib/httpClient";

import type { ChangePasswordRequest, LoginRequest, TokenResponse } from "@/features/auth/types";

export async function login(body: LoginRequest): Promise<TokenResponse> {
  const response = await httpClient.post<TokenResponse>("/auth/login", body);
  return response.data;
}

export async function refresh(): Promise<TokenResponse> {
  const response = await httpClient.post<TokenResponse>("/auth/refresh");
  return response.data;
}

export async function logout(): Promise<void> {
  await httpClient.post("/auth/logout");
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await httpClient.post("/auth/change-password", body);
}
