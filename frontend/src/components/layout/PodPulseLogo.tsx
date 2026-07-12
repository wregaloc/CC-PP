/** Wordmark de marca — "POD" en marfil + "PULSE" en oro, con un ícono de
 * onda de audio en gradiente oro→marfil a la izquierda. Usado en el header
 * en vez del texto plano "PodPulse". */
export function PodPulseLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="podpulse-logo-wave" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#b4975a" />
            <stop offset="100%" stopColor="#f5f1e8" />
          </linearGradient>
        </defs>
        <rect x="1" y="9" width="3" height="6" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="6" y="5" width="3" height="14" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="11" y="2" width="3" height="20" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="16" y="6" width="3" height="12" rx="1.5" fill="url(#podpulse-logo-wave)" />
        <rect x="21" y="9" width="3" height="6" rx="1.5" fill="url(#podpulse-logo-wave)" />
      </svg>
      <span className="text-lg font-semibold tracking-wide">
        <span className="text-[#f5f1e8]">POD</span>
        <span className="text-[#b4975a]">PULSE</span>
      </span>
    </div>
  );
}
