/**
 * Carga los assets de imagen de la plantilla corporativa y los devuelve como
 * data URIs base64. Se incrustan directamente en el HTML para que el render en
 * Puppeteer (serverless) no dependa de la red ni de rutas relativas.
 *
 * Los archivos viven en public/propuestas-assets/ y se fuerzan dentro del bundle
 * serverless mediante outputFileTracingIncludes en next.config.ts.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ASSET_FILES = [
  "manticorelogoazul.png",
  "manticore-logo-full.png",
  "imagen1.png",
  "imagen2.png",
  "imagen3.png",
  "imagen4.png",
] as const;

export type AssetName = (typeof ASSET_FILES)[number];

let cache: Record<string, string> | null = null;

export function loadCorporateAssets(): Record<AssetName, string> {
  if (cache) return cache as Record<AssetName, string>;
  const result: Record<string, string> = {};
  for (const file of ASSET_FILES) {
    try {
      const path = join(process.cwd(), "public", "propuestas-assets", file);
      const buffer = readFileSync(path);
      result[file] = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch (err) {
      console.warn(`[propuesta-pdf/assets] No se pudo cargar ${file}:`, err);
      result[file] = "";
    }
  }
  cache = result;
  return result as Record<AssetName, string>;
}
