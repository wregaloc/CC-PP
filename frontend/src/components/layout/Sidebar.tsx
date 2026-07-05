import { NavLink } from "react-router-dom";

import { visibleNavItems } from "@/components/layout/navItems";
import { useAuth } from "@/features/auth/context/AuthContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Sidebar de navegación. En escritorio (`lg:`) es una columna fija siempre
 * visible; en móvil es un drawer superpuesto que se abre/cierra desde el
 * botón de hamburguesa del Navbar (ver [[react-enterprise-frontend]] —
 * responsive obligatorio en los tres puntos de referencia).
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const items = user ? visibleNavItems(user.role) : [];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-neutral-200 bg-white
          transition-transform duration-200 ease-in-out
          dark:border-neutral-800 dark:bg-neutral-900
          lg:static lg:z-auto lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav className="flex h-full flex-col gap-1 p-4" aria-label="Navegación principal">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
