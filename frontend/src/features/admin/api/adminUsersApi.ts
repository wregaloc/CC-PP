import { httpClient } from "@/lib/httpClient";
import type {
  AdminUserCreatePayload,
  AdminUserOut,
  AdminUserUpdatePayload,
  ListAdminUsersParams,
  PaginatedUsers,
} from "@/features/admin/types";

/** Construye los query params a mano (en vez de pasarle el objeto directo a
 * axios) porque `role` es repetible (`?role=admin&role=interno`, ver
 * backend/app/api/v1/endpoints/admin_users.py) — el serializador por defecto
 * de axios emite `role[]=admin` para arrays, que FastAPI no reconoce. */
function buildListParams(params: ListAdminUsersParams): URLSearchParams {
  const search = new URLSearchParams();
  params.role?.forEach((role) => search.append("role", role));
  if (params.is_active !== undefined) search.set("is_active", String(params.is_active));
  if (params.client_id) search.set("client_id", params.client_id);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 50));
  return search;
}

export async function listAdminUsers(params: ListAdminUsersParams): Promise<PaginatedUsers> {
  const response = await httpClient.get<PaginatedUsers>("/admin/users", {
    params: buildListParams(params),
  });
  return response.data;
}

export async function createAdminUser(payload: AdminUserCreatePayload): Promise<AdminUserOut> {
  const response = await httpClient.post<AdminUserOut>("/admin/users", payload);
  return response.data;
}

export async function updateAdminUser(
  userId: string,
  payload: AdminUserUpdatePayload,
): Promise<AdminUserOut> {
  const response = await httpClient.put<AdminUserOut>(`/admin/users/${userId}`, payload);
  return response.data;
}

export async function toggleAdminUserActive(userId: string): Promise<AdminUserOut> {
  const response = await httpClient.patch<AdminUserOut>(`/admin/users/${userId}/toggle-active`);
  return response.data;
}

export async function setAdminUserPassword(userId: string, password: string): Promise<AdminUserOut> {
  const response = await httpClient.post<AdminUserOut>(`/admin/users/${userId}/set-password`, {
    password,
  });
  return response.data;
}
