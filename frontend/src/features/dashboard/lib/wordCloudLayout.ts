/**
 * Layout tipo "nube de palabras" real (espiral de Arquímedes con detección de
 * colisiones) — Recharts no trae un primitivo de nube de palabras y no se
 * agrega una librería nueva solo para este widget (ver KeywordsCloud), así
 * que se implementa el algoritmo estándar (el mismo enfoque que usan
 * wordcloud2.js / d3-cloud) a mano: cada palabra, de mayor a menor peso, se
 * coloca en el centro y si colisiona con una ya puesta, se prueba en puntos
 * cada vez más lejanos siguiendo una espiral hasta encontrar un hueco libre.
 */

export interface WordCloudInput {
  hashtag: string;
  sentimiento: string;
  occurrences: number;
}

export interface PlacedWord extends WordCloudInput {
  fontSizePx: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx as CanvasRenderingContext2D;
}

function measureWord(text: string, fontSizePx: number): { width: number; height: number } {
  const ctx = getMeasureContext();
  ctx.font = `700 ${fontSizePx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const metrics = ctx.measureText(text);
  const height =
    (metrics.actualBoundingBoxAscent ?? fontSizePx * 0.8) +
    (metrics.actualBoundingBoxDescent ?? fontSizePx * 0.25);
  return { width: metrics.width, height: height || fontSizePx * 1.1 };
}

/** Hash determinístico (no cripto) — la posición inicial de cada palabra en
 * su espiral depende de esto en vez de Math.random, para que el layout no
 * "salte" entre renders con los mismos datos. */
function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

export function layoutWordCloud(
  words: WordCloudInput[],
  containerWidth: number,
  containerHeight: number,
  options: { minFontPx?: number; maxFontPx?: number; padding?: number } = {},
): PlacedWord[] {
  const { minFontPx = 12, maxFontPx = 44, padding = 4 } = options;
  if (words.length === 0 || containerWidth <= 0 || containerHeight <= 0) return [];

  const sorted = [...words].sort((a, b) => b.occurrences - a.occurrences);
  const max = sorted[0].occurrences;
  const min = sorted[sorted.length - 1].occurrences;
  const range = max - min || 1;

  const placed: PlacedWord[] = [];
  const halfW = containerWidth / 2;
  // Achata verticalmente el óvalo (igual que las nubes de referencia son más
  // anchas que altas) reservando algo menos de la mitad de la altura.
  const halfH = containerHeight / 2;
  const maxRadius = Math.hypot(halfW, halfH);

  for (const word of sorted) {
    const weight = (word.occurrences - min) / range;
    const fontSizePx = minFontPx + weight * (maxFontPx - minFontPx);
    const { width: textW, height: textH } = measureWord(word.hashtag, fontSizePx);
    const w = textW + padding * 2;
    const h = textH + padding * 2;

    let angle = (hashCode(word.hashtag + word.sentimiento) % 360) * (Math.PI / 180);
    let radius = 0;
    let found: { x: number; y: number } | null = null;

    while (radius < maxRadius) {
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) * 0.72;
      const rect = { x, y, w, h };
      const withinBounds = Math.abs(x) + w / 2 <= halfW && Math.abs(y) + h / 2 <= halfH;

      if (withinBounds && !placed.some((p) => rectsOverlap(rect, { x: p.x, y: p.y, w: p.width, h: p.height }))) {
        found = { x, y };
        break;
      }

      angle += 0.22;
      radius += 1.4;
    }

    if (found) {
      placed.push({ ...word, fontSizePx, x: found.x, y: found.y, width: w, height: h });
    }
    // Si no encontró hueco dentro del área disponible, la palabra se omite
    // (igual que hacen wordcloud2.js/d3-cloud con las que no caben).
  }

  return placed;
}
