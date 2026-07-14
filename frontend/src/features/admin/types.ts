/** Tipos espejo de los schemas del backend usados por el panel de
 * administración (Fase 10) — ver backend/app/schemas/admin_system.py,
 * admin_user.py, client.py y upload.py. */

export type UserRole = "admin" | "interno" | "cliente";

export interface UploadedByOut {
  id: string;
  email: string;
  full_name: string;
}

export type UploadFileType = "DATA" | "KEYWORDS" | "SPLIT_SENSE" | "AUSPICIOS";
export type UploadStatus = "pending" | "processing" | "success" | "error";

export interface UploadLogSummary {
  id: string;
  file_type: UploadFileType;
  original_filename: string;
  status: UploadStatus;
  rows_total: number | null;
  rows_loaded: number | null;
  rows_skipped: number | null;
  uploaded_by: UploadedByOut;
  started_at: string;
  completed_at: string | null;
}

export interface UploadLogDetail extends UploadLogSummary {
  error_detail: Record<string, unknown> | null;
}

export interface PaginatedUploadHistory {
  items: UploadLogSummary[];
  page: number;
  page_size: number;
  total: number;
}

export interface RejectedRowOut {
  row_index: number;
  reason: string;
  raw_data: Record<string, unknown>;
}

export interface UploadResultResponse {
  file_type: string;
  original_filename: string;
  rows_total: number;
  rows_loaded: number;
  rows_skipped: number;
  status: string;
  error_message: string | null;
  upload_log_id: string | null;
  rejected: RejectedRowOut[];
}

export interface SystemSummary {
  api_status: string;
  database_status: string;
  overall_status: string;
  total_clientes: number;
  total_usuarios: number;
  total_equipo: number;
  last_upload: UploadLogSummary | null;
  last_update_at: string | null;
}

export interface AdminUserOut {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  cargo: string | null;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  created_by_id: string | null;
}

export interface PaginatedUsers {
  items: AdminUserOut[];
  page: number;
  page_size: number;
  total: number;
}

export interface AdminUserCreatePayload {
  email: string;
  full_name: string;
  role: UserRole;
  password: string;
  cargo?: string | null;
  client_id?: string | null;
}

export interface AdminUserUpdatePayload {
  email: string;
  full_name: string;
  role: UserRole;
  cargo?: string | null;
  client_id?: string | null;
}

export interface ListAdminUsersParams {
  role?: UserRole[];
  is_active?: boolean;
  client_id?: string;
  page?: number;
  page_size?: number;
}

export interface ClientOut {
  id: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedClients {
  items: ClientOut[];
  page: number;
  page_size: number;
  total: number;
}
