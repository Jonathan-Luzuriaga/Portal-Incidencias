import { ServiceError } from "../types";

export interface RenderPdfOptions {
  /**
   * Honra el tamaño de página definido por @page en el CSS (A4, margin 0).
   * Se usa con la plantilla corporativa, que ya trae márgenes y pies por página.
   */
  preferCSSPageSize?: boolean;
  /** Binario ya resuelto por {@link warmChromiumExecutable} para evitar espera duplicada. */
  executablePath?: string;
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.AWS_REGION);
}

const WINDOWS_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function resolveLocalExecutable(): Promise<string> {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const { existsSync } = await import("fs");
  for (const p of WINDOWS_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  const unixPaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const p of unixPaths) {
    if (existsSync(p)) return p;
  }
  throw new ServiceError(
    "No se encontró Chrome para generar el PDF en local. Define CHROME_PATH con la ruta al ejecutable de Chrome.",
    500
  );
}

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ??
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

const RENDER_TIMEOUT_MS = 100_000;

/** Ruta del binario de Chromium en serverless; se reutiliza entre invocaciones calientes. */
let cachedExecutablePath: Promise<string> | null = null;

/** Precalienta la descarga/extracción de Chromium en paralelo con Notion o DeepSeek. */
export function warmChromiumExecutable(): Promise<string> {
  if (!isServerless()) return resolveLocalExecutable();
  if (!cachedExecutablePath) {
    cachedExecutablePath = (async () => {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      return chromium.executablePath(CHROMIUM_PACK_URL);
    })();
  }
  return cachedExecutablePath;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new ServiceError(message, 504)), ms);
    }),
  ]);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lanza el navegador con reintentos ante `ETXTBSY`, un error de carrera en
 * serverless: el binario de Chromium recién extraído en /tmp aún se está
 * escribiendo cuando se intenta ejecutar. Reintentar con una breve espera lo
 * resuelve porque en el segundo intento el binario ya está en disco.
 */
async function launchWithRetry(
  puppeteer: typeof import("puppeteer-core").default,
  opts: { args: string[]; executablePath: string; headless: boolean | "shell" }
): Promise<import("puppeteer-core").Browser> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await puppeteer.launch(opts);
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("ETXTBSY") || attempt === maxAttempts) throw err;
      await sleep(300 * attempt);
    }
  }
  throw lastErr;
}

async function renderHtmlToPdfInner(html: string, options: RenderPdfOptions = {}): Promise<Buffer> {
  const serverless = isServerless();
  const puppeteer = (await import("puppeteer-core")).default;

  let executablePath: string;
  let args: string[];
  let headless: boolean | "shell" = true;

  if (serverless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    executablePath = options.executablePath ?? (await warmChromiumExecutable());
    args = await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" });
    headless = "shell";
  } else {
    executablePath = await resolveLocalExecutable();
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
  }

  const browser = await launchWithRetry(puppeteer, { args, executablePath, headless });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 45000 });
    try {
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
    } catch {
      // fuentes web no críticas; continuar con fallback del sistema
    }

    if (options.preferCSSPageSize) {
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        timeout: 30000,
      });
      return Buffer.from(pdf);
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "14mm", left: "14mm" },
      timeout: 30000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Renderiza un documento HTML a PDF (A4) y devuelve el Buffer. */
export async function renderHtmlToPdf(html: string, options: RenderPdfOptions = {}): Promise<Buffer> {
  return withTimeout(
    renderHtmlToPdfInner(html, options),
    RENDER_TIMEOUT_MS,
    "Tiempo agotado generando el PDF. Intenta de nuevo."
  );
}
