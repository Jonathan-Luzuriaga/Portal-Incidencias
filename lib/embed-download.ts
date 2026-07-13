/**
 * Helpers para abrir PDFs desde el portal (incluido embed de Notion).
 * Preferimos pestaña nueva + URL HTTPS / blob para saltar el iframe.
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

export type OpenPdfFromPostResult =
  | { ok: true }
  | { ok: false; reason: "popup_blocked" | "request_failed"; message?: string };

function writePopupHtml(popup: Window, title: string, bodyHtml: string): void {
  try {
    popup.document.open();
    popup.document.write(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title>` +
        `<style>body{font-family:system-ui,sans-serif;padding:2rem;color:#37352f;}</style>` +
        `</head><body>${bodyHtml}</body></html>`
    );
    popup.document.close();
  } catch {
    // cross-origin / closed
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  let message = `Error ${res.status}`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // respuesta no JSON
  }
  return message;
}

/**
 * Abre about:blank en el mismo gesto del click, genera el PDF por POST y
 * navega la pestaña al blob (fuera del sandbox de Notion).
 */
export async function openPdfFromPost(
  url: string,
  init: RequestInit
): Promise<OpenPdfFromPostResult> {
  let popup: Window | null = null;
  try {
    popup = window.open("about:blank", "_blank");
  } catch {
    popup = null;
  }

  if (!popup) {
    return { ok: false, reason: "popup_blocked" };
  }

  writePopupHtml(popup, "Generando PDF…", "<p>Generando PDF… puede tardar hasta 1 minuto.</p>");

  try {
    const res = await fetch(toAbsoluteUrl(url), init);
    if (!res.ok) {
      const message = await parseErrorMessage(res);
      writePopupHtml(
        popup,
        "Error al generar PDF",
        `<p>No se pudo generar el PDF.</p><p>${message.replace(/</g, "&lt;")}</p>`
      );
      return { ok: false, reason: "request_failed", message };
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      popup.location.href = objectUrl;
    } catch {
      writePopupHtml(
        popup,
        "PDF listo",
        `<p>PDF generado.</p><p><a href="${objectUrl}" target="_blank" rel="noopener noreferrer">Abrir PDF</a></p>`
      );
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red al generar el PDF.";
    writePopupHtml(
      popup,
      "Error al generar PDF",
      `<p>No se pudo generar el PDF.</p><p>${message.replace(/</g, "&lt;")}</p>`
    );
    return { ok: false, reason: "request_failed", message };
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
