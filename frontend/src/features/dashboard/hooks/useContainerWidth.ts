import { useCallback, useEffect, useState } from "react";

/** Mide el ancho disponible del contenedor con ResizeObserver. Usa un
 * callback ref (no `useRef` + efecto de una sola vez): en varios consumidores
 * (p. ej. KeywordsCloud) el div real se monta recién cuando QueryState deja
 * de mostrar el Skeleton de carga, así que un efecto con `[]` que lea
 * `ref.current` al montar el componente llegaría demasiado temprano y nunca
 * detectaría el nodo. */
export function useContainerWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, width] as const;
}
