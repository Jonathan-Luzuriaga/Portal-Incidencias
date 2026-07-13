/**
 * Helpers para abrir/descargar PDFs desde el portal (incluido embed de Notion).
 *
 * Notion suele bloquear window.open en el iframe. La vía fiable es:
 * POST → blob → <a download> (sin pestaña nueva).
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

export type FetchPdfBlobResult =
  | { ok: true; blob: Blob }
  | { ok: false; message: string };

/** Genera el PDF por POST y devuelve el blob (sin abrir pestañas). */
export async function fetchPdfAsBlob(
  url: string,
  init: RequestInit
): Promise<FetchPdfBlobResult> {
  try {
    const res = await fetch(toAbsoluteUrl(url), init);
    if (!res.ok) {
      return { ok: false, message: await parseErrorMessage(res) };
    }
    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/pdf") && !contentType.includes("octet-stream")) {
      // Algunos proxies envían PDF sin content-type perfecto; si el body es binario igual sirve.
      const peek = await res.clone().arrayBuffer();
      if (peek.byteLength < 5) {
        return { ok: false, message: "La respuesta del servidor no es un PDF válido." };
      }
    }
    const blob = await res.blob();
    if (blob.size < 5) {
      return { ok: false, message: "El PDF llegó vacío." };
    }
    return {
      ok: true,
      blob: blob.type ? blob : new Blob([blob], { type: "application/pdf" }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red al generar el PDF.";
    return { ok: false, message };
  }
}

/**
 * Dispara descarga en el propio frame (sin popup).
 * Tras un await el gesto del usuario ya se perdió: en Notion conviene
 * mostrar además un <a download> visible para un segundo clic.
 */
export function triggerBlobDownload(objectUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
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
