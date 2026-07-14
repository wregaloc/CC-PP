import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createClient,
  getClient,
  getClientUsers,
  listClients,
  toggleClientActive,
  updateClient,
  uploadClientLogo,
} from "@/features/admin/api/adminClientsApi";

const CLIENTS_KEY = "admin-clients";

interface UseAdminClientsParams {
  page: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export function useAdminClients({ page, pageSize = 20, search, isActive }: UseAdminClientsParams) {
  return useQuery({
    queryKey: [CLIENTS_KEY, page, pageSize, search, isActive],
    queryFn: () =>
      listClients({ page, page_size: pageSize, search: search || undefined, is_active: isActive }),
  });
}

export function useAdminClient(clientId: string | undefined) {
  return useQuery({
    queryKey: [CLIENTS_KEY, "detail", clientId],
    queryFn: () => getClient(clientId as string),
    enabled: clientId !== undefined,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createClient(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, name }: { clientId: string; name: string }) =>
      updateClient(clientId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

export function useToggleClientActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => toggleClientActive(clientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

export function useClientUsers(clientId: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, "users", clientId],
    queryFn: () => getClientUsers(clientId),
  });
}

export function useUploadClientLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, file }: { clientId: string; file: File }) =>
      uploadClientLogo(clientId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}
