import type { AxiosProgressEvent } from "axios";

import { httpClient } from "@/lib/httpClient";
import type {
  PaginatedUploadHistory,
  UploadFileType,
  UploadResultResponse,
} from "@/features/admin/types";

const UPLOAD_PATH_BY_TYPE: Record<UploadFileType, string> = {
  DATA: "/uploads/data",
  KEYWORDS: "/uploads/keywords",
  SPLIT_SENSE: "/uploads/split-sense",
  AUSPICIOS: "/uploads/auspicios",
};

export async function uploadFile(
  fileType: UploadFileType,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadResultResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await httpClient.post<UploadResultResponse>(
    UPLOAD_PATH_BY_TYPE[fileType],
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );
  return response.data;
}

export async function getUploadHistory(params: {
  file_type?: UploadFileType;
  page: number;
  page_size: number;
}): Promise<PaginatedUploadHistory> {
  const response = await httpClient.get<PaginatedUploadHistory>("/uploads/history", { params });
  return response.data;
}
