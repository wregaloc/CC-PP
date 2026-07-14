import { Outlet } from "react-router-dom";

import { AdminNav } from "@/features/admin/components/AdminNav";

/** Shell del panel de administración: título + nav secundaria de los 5
 * módulos + contenido de la ruta activa. Vive dentro del `<AppLayout/>`
 * general (mismo Navbar/Sidebar de siempre) — ver frontend/src/app/router.tsx. */
export function AdminLayout() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Administración
      </h1>
      <AdminNav />
      <Outlet />
    </div>
  );
}
