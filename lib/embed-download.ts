/**
 * Helpers para descargas PDF dentro del embed de Notion.
 * Notion embebe la app en un iframe con sandbox restrictivo (sin allow-downloads /
 * allow-popups). Las descargas por blob o window.open desde el iframe fallan.
 * La solución es navegar la ventana superior (top) a la URL real del PDF.
 */

export function isEmbeddedInFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function toAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

/**
 * Abre una URL de PDF fuera del sandbox del iframe.
 * Preferencia: window.top (rompe el embed) → window.open → location del frame.
 */
export function openPdfOutsideSandbox(pathOrUrl: string): void {
  const href = toAbsoluteUrl(pathOrUrl);

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = href;
      return;
    }
  } catch {
    // top cross-origin: Notion suele permitir asignar location.href de todas formas;
    // si falla, seguimos con fallbacks.
  }

  try {
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (opened) return;
  } catch {
    // popup bloqueado
  }

  window.location.href = href;
}
