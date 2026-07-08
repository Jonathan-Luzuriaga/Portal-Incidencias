/** Tipos del contenido estructurado de una propuesta corporativa Manticore Labs. */

export type Complejidad = "Simple" | "Medio" | "Medio-alto" | "Complejo";

export interface CorporateCover {
  /** Nombre del sistema, sin la palabra "Propuesta" ni comillas. */
  name: string;
  /** Código PS-AAAA-DDMM-XX. */
  code: string;
  /** Versión, ej. 1.0.0. */
  version: string;
  /** Fecha en formato largo: "DD de mes del AAAA". */
  fecha: string;
  /** Días de vigencia (default 45). */
  validezDias: number;
}

export interface CorporateModule {
  nombre: string;
  complejidad: Complejidad;
  descripcion: string;
  funcionalidades: string[];
}

export interface CorporatePersonal {
  rol: string;
  cantidad: number;
  descripcion: string;
}

/**
 * Actividad del ciclo de vida. Las 9 actividades son fijas y en orden fijo.
 * Las horas se toman de Notion cuando existen; si no, se derivan como semanas × 40.
 */
export interface CorporateActivity {
  descripcion: string;
  semanas: number;
  /** Horas leídas directamente de la propuesta en Notion. */
  horas?: number;
}

export interface CorporateRequirement {
  nombre: string;
  descripcion: string;
  /** Rango en semanas, ej. "3–5 semanas". */
  tiempo: string;
}

/** Contenido que produce DeepSeek a partir de la propuesta de Notion. */
export interface CorporateProposalContent {
  cover: CorporateCover;
  scrumMaster: string;
  qaResponsable: string;
  objetivos: string[];
  modulos: CorporateModule[];
  personal: CorporatePersonal[];
  /** Exactamente 9 actividades en el orden estándar del ciclo de vida. */
  actividades: CorporateActivity[];
  requerimientos: CorporateRequirement[];
  /** Valores financieros extraídos de Notion (tablas de costos / etapas). */
  financialsFromNotion?: Partial<CorporateFinancials>;
  /** Forma de pago leída de Notion. */
  pagosFromNotion?: CorporatePago[];
  /** HTML fiel de secciones opcionales transcritas desde Notion. */
  entregablesHtml?: string;
  actividadesHtml?: string;
  formaPagoHtml?: string;
  seccionesExtrasHtml?: Array<{ heading: string; html: string }>;
}

export interface CorporatePago {
  fase: number;
  hito: string;
  porcentaje: number;
  /** Monto sobre el subtotal SIN IVA, formateado (ej. "1,392.00"). */
  monto: string;
  entregables?: string[];
  condicionPago?: string;
}

/** Resultado de los cálculos financieros (deterministas, calculados en código). */
export interface CorporateFinancials {
  actividadesHoras: number[];
  totalHoras: number;
  horasDesarrollo: number;
  horasUat: number;
  subtotal: number;
  iva: number;
  total: number;
  precioDesarrollo: number;
  precioPruebas: number;
  pagos: CorporatePago[];
}
