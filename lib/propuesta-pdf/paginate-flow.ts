/**
 * Parte el bloque .proposal-flow en páginas A4 (794×1122) con pie corporativo,
 * midiendo altura real en Chromium antes de imprimir.
 */
import type { Page } from "puppeteer-core";

const FLOW_START_PAGE = 7;
const PAGE_HEIGHT = 1122;
/** Área útil dentro de page-inner-standard (padding-top + pie). */
const MAX_INNER_HEIGHT = 1014;

export async function paginateProposalFlow(page: Page): Promise<void> {
  await page.evaluate(
    ({ startPage, pageHeight, maxInner }) => {
      const source = document.querySelector(".proposal-flow");
      if (!source) return;

      const elements = Array.from(source.children) as HTMLElement[];
      if (elements.length === 0) {
        source.remove();
        return;
      }

      const measureHost = document.createElement("div");
      measureHost.className = "page-inner page-inner-standard proposal-flow-measure";
      measureHost.style.cssText =
        "position:absolute;left:-9999px;top:0;width:794px;visibility:hidden;pointer-events:none;";
      document.body.appendChild(measureHost);

      function measureNodes(nodes: HTMLElement[]): number {
        measureHost.replaceChildren(...nodes.map((n) => n.cloneNode(true)));
        return measureHost.scrollHeight;
      }

      const chunks: HTMLElement[][] = [];
      let current: HTMLElement[] = [];

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const isHeading = tag === "h2" || tag === "h3";
        const soloHeight = measureNodes([el]);

        if (soloHeight > maxInner) {
          if (current.length > 0) {
            chunks.push(current);
            current = [];
          }
          chunks.push([el]);
          continue;
        }

        const combined = measureNodes([...current, el]);
        if (combined > maxInner && current.length > 0) {
          chunks.push(current);
          current = [el];
          continue;
        }

        if (isHeading && current.length > 0) {
          const withoutLast = current.slice(0, -1);
          const last = current[current.length - 1];
          if (withoutLast.length > 0 && measureNodes([...withoutLast, el]) <= maxInner) {
            chunks.push(withoutLast);
            current = last ? [last, el] : [el];
            continue;
          }
        }

        current.push(el);
      }

      if (current.length > 0) chunks.push(current);
      measureHost.remove();

      const container = document.createElement("div");
      container.className = "proposal-flow-pages";

      let pageNum = startPage;
      for (const chunk of chunks) {
        const solo = chunk.length === 1 ? chunk[0] : null;
        const tall =
          solo !== null &&
          (solo.tagName.toLowerCase() === "table" ||
            measureNodes(chunk) > maxInner);

        const section = document.createElement("section");
        section.className = tall
          ? "page page-standard page-flow-chunk page-flow-tall"
          : "page page-standard page-flow-chunk";

        const inner = document.createElement("div");
        inner.className = "page-inner page-inner-standard";
        for (const node of chunk) {
          inner.appendChild(node.cloneNode(true));
        }

        const footer = document.createElement("footer");
        footer.className = "doc-footer";
        footer.innerHTML = `<a href="mailto:info@manticore-labs.com">info@manticore-labs.com</a><span>${pageNum}</span>`;

        section.appendChild(inner);
        section.appendChild(footer);
        container.appendChild(section);
        pageNum++;
      }

      source.replaceWith(container);
    },
    {
      startPage: FLOW_START_PAGE,
      pageHeight: PAGE_HEIGHT,
      maxInner: MAX_INNER_HEIGHT,
    }
  );
}
