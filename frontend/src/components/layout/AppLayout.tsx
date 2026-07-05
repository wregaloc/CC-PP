import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

/** Shell de la app para toda ruta autenticada: Navbar + Sidebar + contenido
 * de la ruta activa (`<Outlet/>`). Las páginas no reimplementan este chrome —
 * ver [[react-enterprise-frontend]] (layouts anidados con Outlet). */
export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
