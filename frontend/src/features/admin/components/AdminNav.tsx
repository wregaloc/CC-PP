import { NavLink } from "react-router-dom";

const ADMIN_NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard del Sistema" },
  { to: "/admin/equipo", label: "Equipo" },
  { to: "/admin/clientes", label: "Clientes" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/uploads", label: "Carga de Archivos" },
];

/** Nav secundaria de los 5 módulos del panel de administración — vive dentro
 * de AdminLayout, separada de la Sidebar global de la app. */
export function AdminNav() {
  return (
    <nav
      aria-label="Navegación del panel de administración"
      className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800"
    >
      {ADMIN_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border border-[rgba(180,151,90,0.35)] bg-[rgba(180,151,90,0.12)] text-[#8a6f3c] dark:border-[rgba(180,151,90,0.35)] dark:bg-[rgba(180,151,90,0.15)] dark:text-[#d8bc82]"
                : "border border-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
