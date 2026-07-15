import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { DataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { FileDropzone } from "@/features/admin/components/FileDropzone";
import { PaginationControls } from "@/features/admin/components/PaginationControls";
import { SelectField } from "@/features/admin/components/SelectField";
import { useUploadFile, useUploadHistory } from "@/features/admin/hooks/useUploads";
import type { UploadFileType, UploadLogSummary, UploadResultResponse } from "@/features/admin/types";
import { normalizeError } from "@/lib/apiError";

const FILE_TYPE_OPTIONS: { value: UploadFileType; label: string; accept: string }[] = [
  { value: "DATA", label: "Data (audiencia diaria)", accept: ".csv,.xlsx" },
  { value: "KEYWORDS", label: "Keywords", accept: ".xlsx" },
  { value: "SPLIT_SENSE", label: "Split Sense (sentimiento)", accept: ".xlsx" },
  { value: "AUSPICIOS", label: "Auspicios", accept: ".xlsx" },
];

const UPLOAD_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  success: "Exitosa",
  error: "Con errores",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Módulo 5 (Fase 10): carga de archivos (Admin) — el backend ya existe
 * (app/api/v1/endpoints/uploads.py), esta página es su interfaz. */
export function AdminUploadsPage() {
  const [fileType, setFileType] = useState<UploadFileType>("DATA");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadResultResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const uploadMutation = useUploadFile();
  const history = useUploadHistory({ page: historyPage });

  const selectedOption = FILE_TYPE_OPTIONS.find((option) => option.value === fileType)!;

  const handleFileSelected = (file: File) => {
    setResult(null);
    setUploadError(null);
    setProgress(0);
    uploadMutation.mutate(
      { fileType, file, onProgress: setProgress },
      {
        onSuccess: (data) => {
          setResult(data);
          setProgress(null);
        },
        onError: (error) => {
          setUploadError(normalizeError(error).message);
          setProgress(null);
        },
      },
    );
  };

  const historyColumns: DataTableColumn<UploadLogSummary>[] = [
    { key: "file_type", header: "Tipo", render: (row) => row.file_type },
    { key: "original_filename", header: "Archivo", render: (row) => row.original_filename },
    {
      key: "status",
      header: "Estado",
      render: (row) => UPLOAD_STATUS_LABELS[row.status] ?? row.status,
    },
    { key: "rows_loaded", header: "Filas cargadas", render: (row) => row.rows_loaded ?? "—" },
    { key: "rows_skipped", header: "Filas rechazadas", render: (row) => row.rows_skipped ?? "—" },
    {
      key: "uploaded_by",
      header: "Subido por",
      render: (row) => row.uploaded_by.full_name,
      hideOnMobile: true,
    },
    {
      key: "started_at",
      header: "Fecha",
      render: (row) => formatDateTime(row.started_at),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title="Carga de Archivos">
        <div className="flex flex-col gap-4">
          <div className="max-w-xs">
            <SelectField
              label="Tipo de archivo"
              value={fileType}
              disabled={uploadMutation.isPending}
              onChange={(event) => {
                setFileType(event.target.value as UploadFileType);
                setResult(null);
                setUploadError(null);
              }}
            >
              {FILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>

          <FileDropzone
            accept={selectedOption.accept}
            disabled={uploadMutation.isPending}
            onFileSelected={handleFileSelected}
          />

          {progress !== null && (
            <div className="flex flex-col gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full bg-blue-600 transition-all dark:bg-blue-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{progress}%</span>
            </div>
          )}

          {uploadError && <Alert variant="error">{uploadError}</Alert>}

          {result && (
            <Alert variant={result.status === "success" ? "success" : "error"}>
              <div className="flex flex-col gap-1">
                <span>
                  {result.original_filename} — {result.rows_loaded} de {result.rows_total} filas
                  cargadas ({result.rows_skipped} rechazadas)
                </span>
                {result.error_message && <span>{result.error_message}</span>}
              </div>
            </Alert>
          )}
        </div>
      </AdminCard>

      <AdminCard title="Historial de cargas">
        <QueryState
          isLoading={history.isLoading}
          isError={history.isError}
          error={history.error}
          onRetry={history.refetch}
          loadingFallback={<Skeleton className="h-48 w-full" />}
        >
          {history.data && (
            <>
              <DataTable
                columns={historyColumns}
                rows={history.data.items}
                getRowKey={(row) => row.id}
                emptyMessage="Todavía no se cargó ningún archivo."
              />
              <PaginationControls
                page={history.data.page}
                pageSize={history.data.page_size}
                total={history.data.total}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </QueryState>
      </AdminCard>
    </div>
  );
}
