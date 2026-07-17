import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { PodPulseLogo } from "@/components/layout/PodPulseLogo";
import { useTheme } from "@/app/providers/ThemeProvider";
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

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        {user && (
          <>
            <span className="hidden text-sm text-neutral-600 dark:text-neutral-400 sm:inline">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <Button variant="ghost" onClick={handleLogout} isLoading={isLoggingOut}>
              Cerrar sesión
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
