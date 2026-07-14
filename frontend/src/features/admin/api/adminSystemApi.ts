import { httpClient } from "@/lib/httpClient";
import type { SystemSummary } from "@/features/admin/types";

export async function getSystemSummary(): Promise<SystemSummary> {
  const response = await httpClient.get<SystemSummary>("/admin/system/summary");
  return response.data;
}
