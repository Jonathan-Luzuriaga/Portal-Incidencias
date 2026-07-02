import { ServiceError } from "../types";

export interface RenderPdfOptions {
  /**
   * Honra el tamaño de página definido por @page en el CSS (A4, margin 0).
   * Se usa con la plantilla corporativa, que ya trae márgenes y pies por página.
   */
  preferCSSPageSize?: boolean;
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

/** Renderiza un documento HTML a PDF (A4) y devuelve el Buffer. */
export async function renderHtmlToPdf(html: string, options: RenderPdfOptions = {}): Promise<Buffer> {
  const serverless = isServerless();
  const puppeteer = (await import("puppeteer-core")).default;

  let executablePath: string;
  let args: string[];

  if (serverless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  } else {
    executablePath = await resolveLocalExecutable();
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
  }

  const browser = await puppeteer.launch({ args, executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 45000 });
    try {
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
    } catch {
      // fuentes web no críticas; continuar con fallback del sistema
    }

    if (options.preferCSSPageSize) {
      // La plantilla corporativa define @page (A4, margin 0) y sus propios pies
      // por página; se respeta el tamaño del CSS sin márgenes ni footer de Puppeteer.
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
