/**
 * Helpers para abrir PDFs desde el portal (incluido embed de Notion).
 * Preferimos URL HTTPS real + window.open('_blank') para saltar el iframe.
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
 * Abre la URL del PDF en una pestaña nueva.
 * Debe llamarse en el mismo tick del click del usuario (gesto) para evitar bloqueo de popups.
 */
export function openPdfInNewTab(pathOrUrl: string): boolean {
  const href = toAbsoluteUrl(pathOrUrl);
  try {
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback abajo
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
