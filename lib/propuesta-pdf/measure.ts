/**
 * Medicion de paginas del PDF corporativo.
 * Portado de ai-workflows/workflows/propuestas/templates/generate_pdf.mjs.
 *
 * Mide cada <section class="page"> y reporta fill%, overflow y paginas vacias.
 * Se ejecuta ANTES de generar el PDF para detectar problemas de paginacion.
 */
import type { Page } from "puppeteer-core";

export interface PageMeasurement {
  page: number;
  footer: string;
  height: number;
  fill: number;
  overflow: boolean;
}

export interface MeasureReport {
  measurements: PageMeasurement[];
  hasOverflow: boolean;
  hasEmptyPages: boolean;
  sectionCount: number;
}

export async function measurePages(page: Page): Promise<MeasureReport> {
  const measurements: PageMeasurement[] = await page.evaluate(() => {
    const limit = 1122;
    return Array.from(document.querySelectorAll(".page")).map((el, i) => {
      const footer =
        el.querySelector(".doc-footer span")?.textContent ?? "cover";
      const inner = el.querySelector(".page-inner");
      const footerEl = el.querySelector(".doc-footer");
      const footerH = footerEl
        ? footerEl.getBoundingClientRect().height + 18
        : 0;
      const available = limit - footerH;
      const content = inner ? inner.scrollHeight : 0;
      const fill =
        available > 0 ? Math.round((content / available) * 100) : 0;
      const h = Math.round(el.scrollHeight);
      return {
        page: i + 1,
        footer,
        height: h,
        fill,
        overflow: h > limit + 4,
      };
    });
  });

  const hasOverflow = measurements.some((m) => m.overflow || m.fill > 100);
  const hasEmptyPages = measurements.some(
    (m) => m.footer !== "cover" && m.fill < 70,
  );

  return {
    measurements,
    hasOverflow,
    hasEmptyPages,
    sectionCount: measurements.length,
  };
}

export function logMeasureReport(report: MeasureReport): void {
  console.log("[measure] Altura por seccion (limite A4 = 1122px):");
  for (const m of report.measurements) {
    const flag = m.overflow
      ? "  <-- DESBORDA"
      : m.fill > 100
        ? "  <-- CONTENIDO >100%"
        : m.fill < 70 && m.footer !== "cover"
          ? "  <-- vacia"
          : "";
    console.log(
      `  ${String(m.page).padStart(2)} (pie ${String(m.footer).padStart(5)}): ${m.height}px (${m.fill}%)${flag}`,
    );
  }
  if (report.hasOverflow) {
    console.warn(
      "[measure] HAY PAGINAS QUE DESBORDAN. El contenido puede aparecer cortado en el PDF.",
    );
  }
  if (report.hasEmptyPages) {
    console.warn(
      "[measure] Hay paginas con menos del 70% de llenado.",
    );
  }
}
