import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

interface FileDropzoneProps {
  accept: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

/** Drag & drop + selección manual de un archivo (Módulo 5). La validación
 * real de formato/columnas vive en el backend (ETL) — esto solo restringe
 * la extensión aceptada como UX. */
export function FileDropzone({ accept, disabled = false, onFileSelected }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelected(file);
    event.target.value = "";
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-8 text-center text-sm
        transition-colors ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
    >
      <span>Arrastrá el archivo acá o hacé clic para elegirlo</span>
      <span className="text-xs text-neutral-400 dark:text-neutral-500">Formato: {accept}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onFileInputChange}
        className="hidden"
      />
    </div>
  );
}
