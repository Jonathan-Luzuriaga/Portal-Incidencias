/**
 * Parte .proposal-flow en páginas A4 midiendo altura real en Chromium.
 * Cada hoja queda como .page.page-standard con márgenes y pie corporativo.
 */
import type { Page } from "puppeteer-core";

const FLOW_START_PAGE = 7;
/** Área útil: 1122px − padding superior − zona del pie absoluto. */
const MAX_INNER_HEIGHT = 1014;

export async function paginateProposalFlow(page: Page): Promise<void> {
  await page.evaluate(
    ({ startPage, maxInner }) => {
      const source = document.querySelector(".proposal-flow");
      if (!source) return;

      let elements = Array.from(source.children) as HTMLElement[];
      elements = elements.filter((el) => {
        if (el.tagName.toLowerCase() === "hr" && el.classList.contains("section-divider")) {
          return false;
        }
        return true;
      });
      if (elements.length === 0) {
        source.remove();
        return;
      }

      const measureRoot = document.createElement("div");
      measureRoot.className = "proposal-flow";
      measureRoot.style.cssText =
        "position:absolute;left:-9999px;top:0;width:794px;visibility:hidden;pointer-events:none;";
      const measureHost = document.createElement("div");
      measureHost.className = "page-inner page-inner-standard";
      measureRoot.appendChild(measureHost);
      document.body.appendChild(measureRoot);

      function measureNodes(nodes: HTMLElement[]): number {
        measureHost.replaceChildren(...nodes.map((n) => n.cloneNode(true)));
        return measureHost.scrollHeight;
      }

      function isHeading(el: HTMLElement): boolean {
        const tag = el.tagName.toLowerCase();
        return tag === "h2" || tag === "h3";
      }

      function mustKeepTogether(el: HTMLElement): boolean {
        return (
          el.classList.contains("price-table-wrap") ||
          el.classList.contains("table-wrap-keep") ||
          el.classList.contains("costs-block") ||
          (el.classList.contains("field-block") && !el.classList.contains("field-block-loose"))
        );
      }

      function isOversized(el: HTMLElement): boolean {
        return measureNodes([el]) > maxInner;
      }

      const chunks: HTMLElement[][] = [];
      let current: HTMLElement[] = [];

      for (const el of elements) {
        if (isOversized(el)) {
          if (current.length > 0) {
            chunks.push(current);
            current = [];
          }
          chunks.push([el]);
          continue;
        }

        if (mustKeepTogether(el) && current.length > 0 && measureNodes([...current, el]) > maxInner) {
          chunks.push(current);
          current = [el];
          continue;
        }

        const withNew = [...current, el];
        if (current.length > 0 && measureNodes(withNew) > maxInner) {
          chunks.push(current);
          current = [el];
        } else {
          current = withNew;
        }
      }
      if (current.length > 0) chunks.push(current);

      // Empaquetar agresivamente: fusionar chunks adyacentes mientras quepan.
      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < chunks.length - 1; i++) {
          const combined = [...chunks[i], ...chunks[i + 1]];
          if (measureNodes(combined) <= maxInner) {
            chunks.splice(i, 2, combined);
            merged = true;
            break;
          }
        }
      }

      // Evitar títulos huérfanos al final de una página.
      for (let i = 0; i < chunks.length - 1; i++) {
        const chunk = chunks[i];
        if (chunk.length === 0) continue;
        const last = chunk[chunk.length - 1];
        if (last && (isHeading(last) || last.classList.contains("field-label"))) {
          const orphan = chunk.pop();
          if (orphan) {
            chunks[i + 1] = [orphan, ...chunks[i + 1]];
          }
          if (chunk.length === 0) {
            chunks.splice(i, 1);
            i--;
          }
        }
      }

      // Segunda pasada de fusión tras mover títulos.
      merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < chunks.length - 1; i++) {
          const combined = [...chunks[i], ...chunks[i + 1]];
          if (measureNodes(combined) <= maxInner) {
            chunks.splice(i, 2, combined);
            merged = true;
            break;
          }
        }
      }

      measureRoot.remove();

      const container = document.createElement("div");
      container.className = "proposal-flow-pages";

      let pageNum = startPage;
      for (const chunk of chunks) {
        if (chunk.length === 0) continue;

        const solo = chunk.length === 1 ? chunk[0] : null;
        const tall =
          solo !== null &&
          (solo.tagName.toLowerCase() === "table" ||
            solo.classList.contains("price-table-wrap") ||
            solo.classList.contains("table-wrap-keep") ||
            solo.classList.contains("costs-block") ||
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
    { startPage: FLOW_START_PAGE, maxInner: MAX_INNER_HEIGHT }
  );
}
