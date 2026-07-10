/**
 * Helpers para descargas PDF dentro del embed de Notion.
 *
 * Notion embebe la app en un iframe con sandbox + CSP propios.
 * - blob: / <a download> → bloqueados (sin allow-downloads)
 * - window.open / target=_blank → suelen bloquearse (sin allow-popups)
 * - window.top.location / target=_top → Notion lo bloquea con CSP frame-src
 *   (securitypolicyviolation: Framing '')
 *
 * Lo que sí funciona: navegar el propio iframe a una URL HTTPS real del PDF
 * (Content-Disposition: attachment) o copiar el enlace para abrirlo fuera.
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

export type EmbedOpenResult = "navigated_frame" | "opened_tab";

/**
 * Abre el PDF sin intentar romper el iframe de Notion (evita CSP).
 * Embebido: navega el frame actual. Fuera: intenta pestaña nueva.
 */
export function openPdfOutsideSandbox(pathOrUrl: string): EmbedOpenResult {
  const href = toAbsoluteUrl(pathOrUrl);

  if (!isEmbeddedInFrame()) {
    try {
      const opened = window.open(href, "_blank", "noopener,noreferrer");
      if (opened) return "opened_tab";
    } catch {
      // continuar
    }
  }

  window.location.assign(href);
  return "navigated_frame";
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
