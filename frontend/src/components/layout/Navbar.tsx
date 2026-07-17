import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { PodPulseLogo } from "@/components/layout/PodPulseLogo";
import { useAuth } from "@/features/auth/context/AuthContext";

interface NavbarProps {
  /** Ausente cuando el rol actual no tiene sidebar que mostrar/ocultar (ver
   * AppLayout) — en ese caso no se renderiza el botón hamburguesa. */
  onToggleSidebar?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  interno: "Interno",
  cliente: "Cliente",
};

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Abrir/cerrar menú de navegación"
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 lg:hidden"
          >
            <span aria-hidden="true">☰</span>
          </button>
        )}
        <PodPulseLogo />
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-600 dark:text-neutral-400 sm:inline">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <Button variant="ghost" onClick={handleLogout} isLoading={isLoggingOut}>
            Cerrar sesión
          </Button>
        </div>
      )}
    </header>
  );
}
