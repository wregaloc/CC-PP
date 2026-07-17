/** Wordmark de marca — "POD" + "PULSE" en oro, con un ícono de onda de
 * audio en gradiente a la izquierda. Usado en el header en vez del texto
 * plano "PodPulse". Los stops del gradiente y el color de "POD" cambian
 * según el tema (`dark:`): el marfil casi blanco (#f5f1e8) que se usa sobre
 * el fondo oscuro es prácticamente invisible sobre el fondo claro, así que
 * en modo claro se reemplaza por tonos dorados más oscuros (oro
 * profundo #8a6f3c / cobre #b4975a) con contraste suficiente sobre blanco. */
export function PodPulseLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="podpulse-logo-wave" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="[stop-color:#8a6f3c] dark:[stop-color:#b4975a]" />
            <stop offset="100%" className="[stop-color:#b4975a] dark:[stop-color:#f5f1e8]" />
          </linearGradient>
        </defs>
        <rect x="1" y="9" width="3" height="6" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="6" y="5" width="3" height="14" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="11" y="2" width="3" height="20" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="16" y="6" width="3" height="12" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="21" y="9" width="3" height="6" rx="1.5" fill="url(#podpulse-logo-wave)" />
      </svg>
      <span className="text-lg font-semibold tracking-wide">
        <span className="text-[#8a6f3c] dark:text-[#f5f1e8]">POD</span>
        <span className="text-[#b4975a]">PULSE</span>
      </span>
    </div>
  );
}
