import { useId, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { PodPulseLogo } from "@/components/layout/PodPulseLogo";
import { GemBackground } from "@/features/auth/components/GemBackground";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ApiError } from "@/lib/apiError";

interface LocationState {
  from?: string;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[rgba(180,151,90,0.2)] bg-[rgba(8,7,5,0.75)] px-5 py-3.5 text-lg text-[#f5f1e8] " +
  "placeholder:text-[#8c7a5a] focus:outline-none focus:ring-2 focus:ring-[rgba(180,151,90,0.5)]";

export function LoginPage() {
  const { login, isAuthenticated, isLoading: isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ya hay sesión (p. ej. el refresh de arranque tuvo éxito) — no tiene
  // sentido mostrar el formulario de login, vuelve a donde iba el usuario.
  if (!isBootstrapping && isAuthenticated) {
    const redirectTo = (location.state as LocationState | null)?.from ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = (location.state as LocationState | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center overflow-hidden px-4"
      style={{ background: "linear-gradient(160deg, #17140f 0%, #0e0c09 70%)" }}
    >
      {/* Resplandor ambiente cálido */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 35% 50%, rgba(180,151,90,0.10), transparent 50%), " +
            "radial-gradient(circle at 78% 30%, rgba(216,188,130,0.06), transparent 45%)",
        }}
      />

      <GemBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl justify-end">
        <div
          // Ancho en `vw` (no un `max-w-*` fijo): un tamaño fijo en rem
          // ocupa una fracción distinta de la pantalla según el zoom del
          // navegador (a menos zoom, el viewport en px CSS es más grande, y
          // la tarjeta se ve cada vez más chica en proporción). Con `vw` la
          // tarjeta ocupa siempre ~20% del ancho de viewport sin importar el
          // zoom, calibrado para verse igual que al 50% de zoom.
          className="w-full max-w-[clamp(20rem,20vw,40rem)] rounded-2xl p-12 backdrop-blur-xl"
          style={{
            background: "rgba(14, 12, 9, 0.6)",
            border: "1px solid rgba(180, 151, 90, 0.25)",
            boxShadow: "0 0 50px rgba(180,151,90,0.10), 0 24px 60px rgba(0,0,0,0.65)",
          }}
        >
          {/* PodPulseLogo divide "POD"/"PULSE" en spans separados — su nombre
              accesible no coincide con el texto plano "PodPulse", así que el
              heading real queda oculto visualmente (el logo ya comunica la
              marca) solo para lectores de pantalla / tests de accesibilidad. */}
          <h1 className="sr-only">PodPulse</h1>
          <div className="mb-4 flex scale-150 items-center justify-center">
            <PodPulseLogo />
          </div>
          <p
            className="mb-10 mt-4 text-center text-sm uppercase tracking-[0.3em]"
            style={{ color: "rgba(180,151,90,0.7)" }}
          >
            Inicia sesión para continuar
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.1)] px-3.5 py-2.5 text-sm text-[#f5b4b4]"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor={emailId} className="mb-2 block text-base text-[rgba(245,241,232,0.6)]">
                Email
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@empresa.com"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor={passwordId} className="mb-2 block text-base text-[rgba(245,241,232,0.6)]">
                Contraseña
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg py-3.5 text-lg font-semibold text-[#0e0c09] transition-transform
                hover:scale-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              style={{ background: "linear-gradient(90deg, #8a6f3c, #b4975a, #d8bc82)" }}
            >
              {isSubmitting ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
