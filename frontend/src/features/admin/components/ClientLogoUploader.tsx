import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { getClientLogoUrl } from "@/features/admin/api/adminClientsApi";
import { useUploadClientLogo } from "@/features/admin/hooks/useAdminClients";
import { normalizeError } from "@/lib/apiError";

interface ClientLogoUploaderProps {
  clientId: string;
  hasLogo: boolean;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Drag & drop + selección manual del logo de un cliente (Módulo 3). La
 * validación real del contenido vive en el backend (firma binaria) — esto
 * solo filtra por extensión como UX, no como seguridad. */
export function ClientLogoUploader({ clientId, hasLogo }: ClientLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadLogo = useUploadClientLogo();

  const handleFile = async (file: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no soportado — usá PNG, JPEG o WEBP.");
      return;
    }
    try {
      await uploadLogo.mutateAsync({ clientId, file });
    } catch (uploadError) {
      setError(normalizeError(uploadError).message);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {hasLogo && (
          // Cache-busted con el timestamp del último upload para que el navegador no
          // siga mostrando el logo anterior tras reemplazarlo (misma URL siempre).
          <img
            src={`${getClientLogoUrl(clientId)}?t=${Date.now()}`}
            alt="Logo actual"
            className="h-16 w-16 rounded-md border border-neutral-200 object-contain dark:border-neutral-800"
          />
        )}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`flex-1 cursor-pointer rounded-md border-2 border-dashed p-4 text-center text-sm
            transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
        >
          {uploadLogo.isPending ? "Subiendo..." : "Arrastrá una imagen o hacé clic para elegirla"}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={onFileInputChange}
            className="hidden"
          />
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
