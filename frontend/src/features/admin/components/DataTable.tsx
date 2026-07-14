import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Se oculta en móvil (`< 640px`) para no desbordar la pantalla — ver
   * [[react-enterprise-frontend]]: las tablas densas deben degradar con
   * criterio, no encogerse hasta ser ilegibles. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}

/** Tabla genérica con scroll horizontal controlado — usada por las pantallas
 * de Equipo, Clientes y Usuarios del panel de administración. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "Sin resultados.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-3 py-2 font-medium text-neutral-500 dark:text-neutral-400 ${
                  column.hideOnMobile ? "hidden sm:table-cell" : ""
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2 text-neutral-700 dark:text-neutral-300 ${
                    column.hideOnMobile ? "hidden sm:table-cell" : ""
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
