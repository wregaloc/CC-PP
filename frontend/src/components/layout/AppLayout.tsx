import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { visibleNavItems } from "@/components/layout/navItems";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AssistantWidget } from "@/features/assistant/components/AssistantWidget";

/** Shell de la app para toda ruta autenticada: Navbar + Sidebar + contenido
 * de la ruta activa (`<Outlet/>`). Las páginas no reimplementan este chrome —
 * ver [[react-enterprise-frontend]] (layouts anidados con Outlet).
 *
 * El Sidebar solo se renderiza si el rol actual tiene más de un ítem visible
 * (ver `visibleNavItems`) — Interno/Cliente hoy solo tienen "Dashboard", así
 * que mostrarles una barra lateral para navegar a un único destino es chrome
 * sin propósito; ven el proyecto directamente, sin sidebar ni botón
 * hamburguesa. Admin sí la ve, porque además tiene "Administración". */
export function AppLayout() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const showSidebar = user ? visibleNavItems(user.role).length > 1 : false;

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {showSidebar && <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <Navbar onToggleSidebar={showSidebar ? () => setIsSidebarOpen((open) => !open) : undefined} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Módulo IA (por ahora solo Admin, ver [[podpulse-project-constitution]]) */}
      {user?.role === "admin" && <AssistantWidget />}
    </div>
  );
}
