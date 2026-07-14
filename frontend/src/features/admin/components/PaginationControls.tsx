import { Button } from "@/components/ui/Button";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Controles de paginación página anterior/siguiente — usados por las listas
 * paginadas del panel de administración (mismo contrato page/page_size/total
 * que ya exponen los endpoints /admin/* del backend). */
export function PaginationControls({ page, pageSize, total, onPageChange }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        Página {page} de {totalPages} · {total} resultados
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
