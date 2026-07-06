import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { TIPO_LABEL } from "@/features/dashboard/lib/tipoColors";
import type { ProgramaRankingItem } from "@/features/dashboard/types";

interface RankingTableProps {
  items: ProgramaRankingItem[];
}

/** Vista tabular accesible del ranking — alternativa al gráfico de barras
 * para lectores de pantalla (un SVG de Recharts no es navegable como tabla)
 * y para pantallas pequeñas donde 10 barras horizontales no caben bien. */
export function RankingTable({ items }: RankingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Ranking de programas por vistas totales</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th scope="col" className="py-2 pr-2">
              #
            </th>
            <th scope="col" className="py-2 pr-2">
              Programa
            </th>
            <th scope="col" className="py-2 pr-2">
              Canal
            </th>
            <th scope="col" className="py-2 pr-2">
              Tipo
            </th>
            <th scope="col" className="py-2 text-right">
              Vistas Totales
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.programa}-${item.canal}`}
              className="border-b border-neutral-100 dark:border-neutral-800/60"
            >
              <td className="py-2 pr-2 text-neutral-500 dark:text-neutral-400">{item.ranking}</td>
              <td className="py-2 pr-2 font-medium text-neutral-900 dark:text-neutral-100">
                {item.programa}
              </td>
              <td className="py-2 pr-2 text-neutral-600 dark:text-neutral-400">{item.canal}</td>
              <td className="py-2 pr-2 text-neutral-600 dark:text-neutral-400">
                {item.tipo ? TIPO_LABEL[item.tipo] : "—"}
              </td>
              <td className="py-2 text-right text-neutral-900 dark:text-neutral-100">
                {formatCompactNumber(item.vistas_totales)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
