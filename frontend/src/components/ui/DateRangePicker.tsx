import { useEffect, useMemo, useRef, useState } from "react";

export interface DateRange {
  from?: string;
  to?: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min?: string;
  max?: string;
  label?: string;
}

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_LABELS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function clamp(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

function formatShort(iso?: string): string | null {
  if (!iso) return null;
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTH_LABELS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function getCalendarDays(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // lunes=0 ... domingo=6
  const gridStart = addDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/**
 * Selector de rango de fechas con calendario visual + atajos rápidos — el
 * origen (`min`/`max`) se ancla al rango real de datos disponibles
 * (`/filters/periodos`), no a la fecha del sistema: "Última semana" sobre un
 * dataset histórico debe significar "los últimos 7 días con datos", no una
 * semana vacía si "hoy" cae fuera del rango cargado.
 */
export function DateRangePicker({ value, onChange, min, max, label = "Rango de fechas" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorIso = max ?? toISO(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => fromISO(value.from ?? anchorIso));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const presets = useMemo(() => {
    const anchor = fromISO(anchorIso);
    const range = (from: Date, to: Date): DateRange => ({
      from: clamp(toISO(from), min, max),
      to: clamp(toISO(to), min, max),
    });
    return [
      { label: "Hoy", range: () => range(anchor, anchor) },
      { label: "Ayer", range: () => range(addDays(anchor, -1), addDays(anchor, -1)) },
      { label: "Última semana", range: () => range(addDays(anchor, -6), anchor) },
      { label: "Último mes", range: () => range(addDays(anchor, -29), anchor) },
      { label: "Último trimestre", range: () => range(addDays(anchor, -89), anchor) },
      ...(min && max ? [{ label: "Todo el período", range: (): DateRange => ({ from: min, to: max }) }] : []),
    ];
  }, [anchorIso, min, max]);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  function handleDayClick(day: Date) {
    const iso = toISO(day);
    if (min && iso < min) return;
    if (max && iso > max) return;

    if (!value.from || (value.from && value.to)) {
      onChange({ from: iso, to: undefined });
    } else if (iso < value.from) {
      onChange({ from: iso, to: value.from });
      setOpen(false);
    } else {
      onChange({ from: value.from, to: iso });
      setOpen(false);
    }
  }

  const triggerLabel =
    value.from || value.to
      ? `${formatShort(value.from) ?? "…"} – ${formatShort(value.to) ?? "…"}`
      : "Seleccionar fechas";

  return (
    <div className="relative flex flex-col gap-1" ref={containerRef}>
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm
          text-neutral-900 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950
          dark:text-neutral-100 dark:hover:border-neutral-600"
      >
        {triggerLabel}
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-neutral-400">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full z-20 mt-1 flex flex-col gap-3 rounded-lg border border-neutral-200
            bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row"
        >
          <div className="flex flex-row gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800
            sm:w-36 sm:flex-col sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const next = preset.range();
                  onChange(next);
                  if (next.from) setVisibleMonth(fromISO(next.from));
                  setOpen(false);
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100
                  dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onChange({ from: undefined, to: undefined });
                setOpen(false);
              }}
              className="mt-auto rounded-md px-2 py-1.5 text-left text-sm font-medium text-blue-600
                hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              Restablecer
            </button>
          </div>

          <div className="flex w-72 flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </span>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-neutral-400 dark:text-neutral-500">
              {WEEKDAY_LABELS.map((wd) => (
                <span key={wd}>{wd}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
              {calendarDays.map((day) => {
                const iso = toISO(day);
                const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                const isDisabled = (!!min && iso < min) || (!!max && iso > max);
                const isStart = iso === value.from;
                const isEnd = iso === value.to;
                const isInRange = !!value.from && !!value.to && iso > value.from && iso < value.to;
                const isEdge = isStart || isEnd;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square rounded-md text-xs transition-colors ${
                      isDisabled
                        ? "cursor-not-allowed text-neutral-300 dark:text-neutral-700"
                        : !isCurrentMonth
                          ? "text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-neutral-800"
                          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    } ${isInRange ? "bg-blue-50 dark:bg-blue-950/40" : ""} ${
                      isEdge ? "!bg-blue-600 font-semibold !text-white" : ""
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
