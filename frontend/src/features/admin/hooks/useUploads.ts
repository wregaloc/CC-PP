import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUploadHistory, uploadFile } from "@/features/admin/api/uploadsApi";
import type { UploadFileType } from "@/features/admin/types";

const HISTORY_KEY = "admin-upload-history";

export function useUploadHistory(params: { fileType?: UploadFileType; page: number }) {
  return useQuery({
    queryKey: [HISTORY_KEY, params],
    queryFn: () =>
      getUploadHistory({ file_type: params.fileType, page: params.page, page_size: 20 }),
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fileType,
      file,
      onProgress,
    }: {
      fileType: UploadFileType;
      file: File;
      onProgress: (percent: number) => void;
    }) => uploadFile(fileType, file, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] }),
  });
}
