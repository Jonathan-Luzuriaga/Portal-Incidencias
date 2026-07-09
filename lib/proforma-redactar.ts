import type { ProformaActividadInput } from "./proforma-types";

const PALABRAS_CANONICAS = [
  "cambio",
  "flujo",
  "reporte",
  "reportes",
  "cuenta",
  "cuentas",
  "clave",
  "formulario",
  "excel",
  "exportar",
  "exportación",
  "botón",
  "modificación",
  "integración",
  "validación",
  "desarrollo",
  "software",
  "pantalla",
  "módulo",
  "modulo",
  "ajuste",
  "corrección",
  "implementación",
  "análisis",
  "diseño",
  "pruebas",
  "documentación",
] as const;

const REEMPLAZOS_EXACTOS: Record<string, string> = {
  canbii: "cambio",
  canbio: "cambio",
  camboi: "cambio",
  camio: "cambio",
  fkujio: "flujo",
  flujoi: "flujo",
  fluijo: "flujo",
  reportte: "reporte",
  repote: "reporte",
  reprote: "reporte",
  reprotes: "reportes",
  exporta: "exportar",
  modificacion: "modificación",
  boton: "botón",
  validacion: "validación",
  integracion: "integración",
  cuentasclave: "cuentas clave",
};

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizarAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function corregirToken(token: string): string {
  const limpio = normalizarAscii(token).replace(/[^a-z0-9]/g, "");
  if (!limpio) return "";

  if (REEMPLAZOS_EXACTOS[limpio]) {
    return REEMPLAZOS_EXACTOS[limpio];
  }

  let mejor = limpio;
  let mejorDist = Infinity;
  const maxDist = Math.max(2, Math.floor(limpio.length / 3));

  for (const palabra of PALABRAS_CANONICAS) {
    const dist = levenshtein(limpio, normalizarAscii(palabra));
    if (dist < mejorDist && dist <= maxDist) {
      mejorDist = dist;
      mejor = palabra;
    }
  }

  return mejor;
}

function tokenizar(texto: string): string[] {
  return texto
    .trim()
    .replace(/[;]/g, " ")
    .split(/\s+/)
    .map(corregirToken)
    .filter(Boolean);
}

function textoContiene(tokens: string[], ...palabras: string[]): boolean {
  const unidos = tokens.join(" ");
  return palabras.every((p) => unidos.includes(normalizarAscii(p)));
}

function construirAlcancePorIntencion(tokens: string[]): string | null {
  const unidos = tokens.join(" ");

  if (textoContiene(tokens, "cambio", "flujo") && unidos.includes("report")) {
    if (unidos.includes("cuenta") && unidos.includes("clave")) {
      return "Implementar cambio de flujo y reportes en cuentas clave.";
    }
    return "Implementar cambio de flujo y ajustes en reportes.";
  }

  if (unidos.includes("export") && (unidos.includes("excel") || unidos.includes("formulario"))) {
    return "Implementar en el formulario la exportación de información a Excel.";
  }

  if (unidos.includes("boton") || unidos.includes("botón")) {
    if (unidos.includes("excel") || unidos.includes("export")) {
      return "Implementar un botón que permita exportar la información a Excel.";
    }
  }

  if (unidos.includes("formulario") && (unidos.includes("modific") || unidos.includes("cambio"))) {
    return "Implementar ajustes en el formulario según el alcance solicitado.";
  }

  if (unidos.includes("integrac")) {
    return "Implementar la integración solicitada y validar su funcionamiento.";
  }

  if (unidos.includes("report") && unidos.includes("cuenta")) {
    return "Implementar ajustes en reportes del módulo de cuentas.";
  }

  return null;
}

function formatearOracion(text: string): string {
  let result = text.trim().replace(/\s+/g, " ");
  if (!result) return "";

  result = result.charAt(0).toUpperCase() + result.slice(1);
  if (!/[.!?]$/.test(result)) result += ".";
  return result.slice(0, 500);
}

function limpiarCola(fragmento: string): string {
  const tokens = tokenizar(fragmento);
  return tokens.join(" ");
}

/**
 * Redacción local de alcance cuando DeepSeek no está disponible.
 * Corrige errores tipográficos frecuentes y arma una frase comercial estándar.
 */
export function redactarDescripcionLocal(textoBruto: string): string {
  let text = textoBruto.trim().replace(/\s+/g, " ");
  if (!text) return "";

  text = text
    .replace(/;a/gi, "ñ")
    .replace(/;o/gi, "ó")
    .replace(/;i/gi, "í")
    .replace(/;e/gi, "é")
    .replace(/;u/gi, "ú");

  const tokens = tokenizar(text);
  const porIntencion = construirAlcancePorIntencion(tokens);
  if (porIntencion) return porIntencion;

  if (/^se\s+(hizo|realiz[oó]|implement[oó]|agreg[oó]|a[nñ]adi[oó])\s+/i.test(text)) {
    const resto = limpiarCola(text.replace(/^se\s+\w+\s+/i, ""));
    if (/bot[oó]n.*excel|exportar.*excel/i.test(text)) {
      return "Implementar en el formulario un botón que permita exportar la información a Excel.";
    }
    if (/formulario/i.test(text)) {
      return formatearOracion(`Implementar en el formulario: ${resto}`);
    }
    return formatearOracion(`Implementación de ${resto}`);
  }

  if (/^hay\s+que\s+/i.test(text)) {
    const resto = limpiarCola(text.replace(/^hay\s+que\s+/i, ""));
    return formatearOracion(`Implementar ${resto}`);
  }

  const redactado = limpiarCola(text);
  if (!redactado) return "";

  if (!/^(implementar|desarrollar|crear|modificar|ajustar|corregir|sustituir|agregar|incorporar)/i.test(redactado)) {
    return formatearOracion(`Implementar ${redactado}`);
  }

  return formatearOracion(redactado);
}

const PLANTILLAS_ACTIVIDAD = [
  { actividad: "Análisis y diseño", descripcion: "Revisión del alcance y definición de la solución técnica." },
  { actividad: "Desarrollo", descripcion: "Implementación de la funcionalidad solicitada." },
  { actividad: "Pruebas", descripcion: "Validación funcional y corrección de observaciones." },
  { actividad: "Documentación y entrega", descripcion: "Evidencias de prueba y cierre del entregable." },
];

function actividadesPorAlcance(descripcion: string, horasTotales: number): ProformaActividadInput[] | null {
  const lower = normalizarAscii(descripcion);

  if (lower.includes("flujo") && lower.includes("report")) {
    const base = Math.max(1, horasTotales);
    const h1 = Math.max(1, Math.round(base * 0.2));
    const h2 = Math.max(1, Math.round(base * 0.45));
    const h3 = Math.max(1, Math.round(base * 0.2));
    const h4 = Math.max(1, base - h1 - h2 - h3);

    return [
      {
        actividad: "Análisis funcional",
        descripcion: "Revisión del flujo actual y definición del nuevo comportamiento.",
        horas: h1,
      },
      {
        actividad: "Desarrollo de flujo",
        descripcion: "Implementación del cambio de flujo solicitado en el módulo.",
        horas: h2,
      },
      {
        actividad: "Reportes",
        descripcion: "Ajuste y validación de reportes asociados al proceso.",
        horas: h3,
      },
      {
        actividad: "Pruebas y entrega",
        descripcion: "Pruebas funcionales, correcciones y entrega del cambio.",
        horas: h4,
      },
    ];
  }

  return null;
}

/** Genera actividades de respaldo que suman las horas totales. */
export function generarActividadesFallback(
  descripcion: string,
  horasTotales: number,
  cantidad?: number
): ProformaActividadInput[] {
  const total = Math.max(1, horasTotales);
  const porAlcance = actividadesPorAlcance(descripcion, total);
  if (porAlcance) return porAlcance;

  const n = cantidad && cantidad > 0 ? Math.min(cantidad, 12) : 4;
  const base = Math.floor(total / n);
  let resto = total % n;

  return Array.from({ length: n }, (_, i) => {
    const tpl = PLANTILLAS_ACTIVIDAD[i % PLANTILLAS_ACTIVIDAD.length];
    const horas = base + (resto > 0 ? 1 : 0);
    if (resto > 0) resto -= 1;
    return {
      actividad: tpl.actividad,
      descripcion: i === 1 ? descripcion.slice(0, 240) || tpl.descripcion : tpl.descripcion,
      horas,
    };
  });
}
