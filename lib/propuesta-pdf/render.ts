import { ServiceError } from "../types";
import { measurePages, logMeasureReport } from "./measure";
import { paginateProposalFlow } from "./paginate-flow";

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

type BrowserLaunchProfile = {
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
};

function joinWin(...parts: string[]): string {
  return parts.join("\\");
}

/** Rutas habituales de Chrome, Edge, Brave y Chromium en Windows (incluye instalaciones x86 y por usuario). */
function getWindowsBrowserPaths(): string[] {
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const localAppData = process.env.LOCALAPPDATA;
  const candidates: string[] = [];

  const chromeRel = ["Google", "Chrome", "Application", "chrome.exe"];
  const edgeRel = ["Microsoft", "Edge", "Application", "msedge.exe"];
  const braveRel = ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"];
  const chromiumRel = ["Chromium", "Application", "chrome.exe"];

  for (const root of [programFiles, programFilesX86, localAppData]) {
    if (!root) continue;
    candidates.push(
      joinWin(root, ...chromeRel),
      joinWin(root, ...edgeRel),
      joinWin(root, ...braveRel),
      joinWin(root, ...chromiumRel)
    );
  }

  return [...new Set(candidates)];
}

const UNIX_BROWSER_PATHS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

async function findSystemBrowserExecutable(): Promise<string | null> {
  if (process.env.CHROME_PATH?.trim()) return process.env.CHROME_PATH.trim();

  const { existsSync } = await import("fs");
  const paths = process.platform === "win32" ? getWindowsBrowserPaths() : UNIX_BROWSER_PATHS;
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ??
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

const RENDER_TIMEOUT_MS = 100_000;

/** Binario empaquetado (Vercel o fallback local); se reutiliza entre invocaciones. */
let cachedBundledExecutablePath: Promise<string> | null = null;

async function resolveBundledExecutablePath(): Promise<string> {
  if (!cachedBundledExecutablePath) {
    cachedBundledExecutablePath = (async () => {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      return chromium.executablePath(CHROMIUM_PACK_URL);
    })();
  }
  return cachedBundledExecutablePath;
}

async function resolveBundledLaunchProfile(): Promise<BrowserLaunchProfile> {
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const puppeteer = (await import("puppeteer-core")).default;
  const executablePath = await resolveBundledExecutablePath();
  const args = await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" });
  return { executablePath, args, headless: "shell" };
}

async function resolveBrowserLaunchProfile(options: RenderPdfOptions = {}): Promise<BrowserLaunchProfile> {
  if (isServerless()) {
    const profile = await resolveBundledLaunchProfile();
    return {
      ...profile,
      executablePath: options.executablePath ?? profile.executablePath,
    };
  }

  const systemExecutable = await findSystemBrowserExecutable();
  if (systemExecutable) {
    return {
      executablePath: systemExecutable,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    };
  }

  console.warn(
    "[render] No se encontró Chrome/Edge/Brave en el sistema; usando Chromium empaquetado para generar el PDF."
  );
  return resolveBundledLaunchProfile();
}

/** Precalienta el navegador en paralelo con Notion (sistema o Chromium empaquetado). */
export function warmChromiumExecutable(): Promise<string> {
  return resolveBrowserLaunchProfile().then((profile) => profile.executablePath);
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
  const puppeteer = (await import("puppeteer-core")).default;
  const { executablePath, args, headless } = await resolveBrowserLaunchProfile(options);

  const browser = await launchWithRetry(puppeteer, { args, executablePath, headless });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 45000 });
    try {
      await page.emulateMediaType("print");
    } catch {
      // no crítico
    }
    try {
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
    } catch {
      // fuentes web no críticas; continuar con fallback del sistema
    }

    try {
      await paginateProposalFlow(page);
    } catch (err) {
      console.warn("[render] No se pudo paginar proposal-flow:", err);
    }

    if (options.preferCSSPageSize) {
      try {
        const report = await measurePages(page);
        logMeasureReport(report);
      } catch (err) {
        console.warn("[render] No se pudo medir paginas:", err);
      }

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
