import { httpClient } from "@/lib/httpClient";
import type { ClientOut, PaginatedClients, PaginatedUsers } from "@/features/admin/types";

interface ListClientsParams {
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export async function listClients(params: ListClientsParams): Promise<PaginatedClients> {
  const response = await httpClient.get<PaginatedClients>("/admin/clients", { params });
  return response.data;
}

export async function getClient(clientId: string): Promise<ClientOut> {
  const response = await httpClient.get<ClientOut>(`/admin/clients/${clientId}`);
  return response.data;
}

export async function createClient(name: string): Promise<ClientOut> {
  const response = await httpClient.post<ClientOut>("/admin/clients", { name });
  return response.data;
}

export async function updateClient(clientId: string, name: string): Promise<ClientOut> {
  const response = await httpClient.put<ClientOut>(`/admin/clients/${clientId}`, { name });
  return response.data;
}

export async function toggleClientActive(clientId: string): Promise<ClientOut> {
  const response = await httpClient.patch<ClientOut>(`/admin/clients/${clientId}/toggle-active`);
  return response.data;
}

export async function getClientUsers(clientId: string): Promise<PaginatedUsers> {
  const response = await httpClient.get<PaginatedUsers>(`/admin/clients/${clientId}/users`, {
    params: { page_size: 200 },
  });
  return response.data;
}
