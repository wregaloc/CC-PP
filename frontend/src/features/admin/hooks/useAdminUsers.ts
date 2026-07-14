import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdminUser,
  listAdminUsers,
  setAdminUserPassword,
  toggleAdminUserActive,
  updateAdminUser,
} from "@/features/admin/api/adminUsersApi";
import type {
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  ListAdminUsersParams,
} from "@/features/admin/types";

const USERS_KEY = "admin-users";

export function useAdminUsers(params: ListAdminUsersParams) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => listAdminUsers(params),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminUserCreatePayload) => createAdminUser(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminUserUpdatePayload }) =>
      updateAdminUser(userId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useToggleAdminUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => toggleAdminUserActive(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useSetAdminUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      setAdminUserPassword(userId, password),
  });
}
