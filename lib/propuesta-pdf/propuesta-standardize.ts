/**
 * Normaliza el contenido de Notion al estándar comercial Manticore antes del PDF.
 * La plantilla HTML es fija (corporate-template); aquí solo se adaptan datos y tablas.
 */
import { ACTIVITY_ORDER } from "./calc";
import type {
  Complejidad,
  CorporateActivity,
  CorporateModule,
  CorporatePersonal,
  CorporateProposalContent,
  CorporateRequirement,
} from "./corporate-types";

const COMPLEJIDADES: Complejidad[] = ["Simple", "Medio", "Medio-alto", "Complejo"];

const HU_ID_PATTERN = /\b(HU[-_]?\d+|H\d{3,4})\b/gi;

const DEFAULT_ACTIVITY_DESCS = [
  "Levantamiento de requerimientos y diseño de mockups con el cliente.",
  "Definición de la arquitectura técnica y modelo de datos.",
  "Implementación de la lógica de negocio y servicios del backend.",
  "Construcción de las interfaces de usuario del sistema.",
  "Pruebas funcionales de los módulos desarrollados.",
  "Pruebas de aceptación de usuario en pre-producción.",
  "Despliegue del aplicativo en el ambiente del cliente.",
  "Capacitación al equipo del cliente sobre el sistema.",
  "Documentación técnica y entrega final del proyecto.",
];

const DEFAULT_ACTIVITY_WEEKS = [2, 1, 4, 3, 1, 1, 0.5, 0.5, 0.5];

function stripHuIds(text: string): string {
  return text.replace(HU_ID_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

function normComplejidad(raw: string): Complejidad {
  const s = raw.trim().toLowerCase();
  const found = COMPLEJIDADES.find((c) => c.toLowerCase() === s);
  if (found) return found;
  if (s.includes("alto") || s.includes("complej")) return "Complejo";
  if (s.includes("medio")) return "Medio";
  return "Simple";
}

function normModule(m: CorporateModule): CorporateModule {
  return {
    nombre: stripHuIds(m.nombre).slice(0, 80) || "Módulo",
    complejidad: normComplejidad(m.complejidad),
    descripcion: stripHuIds(m.descripcion) || "Funcionalidad del sistema.",
    funcionalidades: (m.funcionalidades.length ? m.funcionalidades : ["Funcionalidad principal"])
      .map(stripHuIds)
      .filter(Boolean)
      .slice(0, 6),
  };
}

function defaultPersonal(): CorporatePersonal[] {
  return [
    {
      rol: "Arquitecto de Solución / PM",
      cantidad: 1,
      descripcion: "Gestión del proyecto y definición de la arquitectura de la solución.",
    },
    {
      rol: "Programador Senior (Full Stack / Front)",
      cantidad: 1,
      descripcion: "Desarrollo del backend y de los módulos de mayor complejidad.",
    },
    {
      rol: "Revisor de Calidad (QA)",
      cantidad: 1,
      descripcion: "Pruebas funcionales, UAT y documentación de hallazgos.",
    },
  ];
}

function ensurePersonal(rows: CorporatePersonal[]): CorporatePersonal[] {
  const mapped = rows
    .filter((p) => p.rol.trim())
    .map((p) => ({
      rol: stripHuIds(p.rol),
      cantidad: Math.max(1, p.cantidad || 1),
      descripcion: stripHuIds(p.descripcion),
    }));

  if (mapped.length === 0) return defaultPersonal();

  const hasQa = mapped.some((p) => /qa|calidad/i.test(p.rol));
  if (!hasQa) {
    mapped.push({
      rol: "Revisor de Calidad (QA)",
      cantidad: 1,
      descripcion: "Pruebas funcionales y validación de entregables.",
    });
  }
  return mapped;
}

/** Siempre 9 filas en el orden fijo de la plantilla. */
export function normalizeActivities(rows: CorporateActivity[]): CorporateActivity[] {
  return ACTIVITY_ORDER.map((_, i) => {
    const src = rows[i];
    const semanas =
      typeof src?.semanas === "number" && src.semanas > 0 ? src.semanas : DEFAULT_ACTIVITY_WEEKS[i];
    return {
      descripcion: stripHuIds(src?.descripcion ?? "") || DEFAULT_ACTIVITY_DESCS[i],
      semanas,
    };
  });
}

function normRequirement(r: CorporateRequirement, index: number): CorporateRequirement {
  const nombre = stripHuIds(r.nombre);
  return {
    nombre: nombre || `Requerimiento ${String(index + 1).padStart(3, "0")}`,
    descripcion: stripHuIds(r.descripcion),
    tiempo: r.tiempo.trim() || "1–2 semanas",
  };
}

function defaultModule(name: string): CorporateModule {
  return {
    nombre: stripHuIds(name).slice(0, 60) || "Módulo principal",
    complejidad: "Medio",
    descripcion: "Módulo central que cubre las funcionalidades solicitadas en la propuesta.",
    funcionalidades: ["Gestión de la información", "Reportería"],
  };
}

/** Mezcla parser determinista + extracción IA (prioridad al parser donde hay datos). */
export function mergeProposalContent(
  primary: CorporateProposalContent,
  secondary: CorporateProposalContent
): CorporateProposalContent {
  return {
    cover: primary.cover,
    scrumMaster: primary.scrumMaster || secondary.scrumMaster,
    qaResponsable: primary.qaResponsable || secondary.qaResponsable,
    objetivos: primary.objetivos.length ? primary.objetivos : secondary.objetivos,
    modulos: primary.modulos.length ? primary.modulos : secondary.modulos,
    personal: primary.personal.length ? primary.personal : secondary.personal,
    actividades: primary.actividades.some((a) => a.semanas > 0)
      ? primary.actividades
      : secondary.actividades,
    requerimientos: primary.requerimientos.length ? primary.requerimientos : secondary.requerimientos,
  };
}

export function isSparseContent(content: CorporateProposalContent): boolean {
  const totalWeeks = content.actividades.reduce((s, a) => s + (a.semanas || 0), 0);
  return content.modulos.length === 0 || totalWeeks < 1;
}

/** Adapta cualquier propuesta de Notion al formato fijo de la plantilla corporativa. */
export function standardizeProposalContent(
  content: CorporateProposalContent
): CorporateProposalContent {
  const objetivos = (content.objetivos.length
    ? content.objetivos
    : ["Cubrir los requerimientos funcionales solicitados por el cliente."]
  )
    .map(stripHuIds)
    .filter(Boolean)
    .slice(0, 6);

  const modulos = (content.modulos.length ? content.modulos : [defaultModule(content.cover.name)]).map(
    normModule
  );

  const requerimientos = (content.requerimientos.length
    ? content.requerimientos
    : [
        {
          nombre: "Funcionalidad principal",
          descripcion: "Implementación del alcance funcional descrito en la propuesta.",
          tiempo: "2–4 semanas",
        },
      ]
  ).map(normRequirement);

  return {
    cover: content.cover,
    scrumMaster: content.scrumMaster?.trim() || "Manticore Labs",
    qaResponsable: content.qaResponsable?.trim() || "Manticore Labs",
    objetivos,
    modulos,
    personal: ensurePersonal(content.personal),
    actividades: normalizeActivities(content.actividades),
    requerimientos,
  };
}

export const PROPUESTA_STANDARD_GUIDE = {
  title: "Plantilla corporativa automática",
  intro:
    "Al generar el PDF, el portal adapta el contenido de Notion a la plantilla fija Manticore: mismas secciones, mismas tablas (columnas y filas estándar), mismos tamaños de página y cálculos de precios deterministas. No hace falta validar manualmente antes de descargar.",
  sections: [
    "Portada, índice y metodología SCRUM (bloques fijos)",
    "Tabla Soluciones: Módulo · Complejidad · Descripción · Funcionalidades",
    "Tabla Personal: Rol · Cantidad · Descripción del Rol",
    "Tabla Actividades: 9 filas fijas del ciclo de vida",
    "Tabla Requerimientos y tiempos",
    "Tiempos, costos, nota, forma de pago y conclusiones",
  ],
  notionSteps: [
    "Completa el contenido de negocio en Notion (puede variar el orden).",
    "Opcional: ejecuta «Estandarizar propuesta» en Notion AI para ordenar el documento.",
    "Genera el PDF aquí: el sistema normaliza tablas y aplica la plantilla corporativa.",
  ],
} as const;
