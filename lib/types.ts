export type Priority = "Alto" | "Medio" | "Bajo";

export const PRIORITIES: Priority[] = ["Alto", "Medio", "Bajo"];

export type Environment = "Desarrollo" | "LATEST" | "QA" | "Producción";

export const ENVIRONMENTS: Environment[] = ["Desarrollo", "LATEST", "QA", "Producción"];

/** Datos crudos del formulario enviados por el cliente. */
export interface IncidentFormData {
  /** Valor exacto de Proyecto Cliente en Notion, ej. [BAGO][ZONALES-MG] */
  clientProject: string;
  title: string;
  priority: Priority;
  justification: string;
  environment: Environment;
  dateTime: string;
  userRole: string;
  moduleUrl: string;
  browserDevice: string;
  affectedRecordId: string;
  summary: string;
  actualResult: string;
  expectedResult: string;
}

/** Resultado estructurado que DeepSeek genera para crear la tarea en Notion. */
export interface FormattedIncident {
  /** Título de la tarea, ej. "[QA] Bug: checkbox COA incompleto en /producto" */
  taskTitle: string;
  /** Descripción corta para la property de Notion. */
  shortDescription: string;
  /** Valor exacto del select Prioridad en Notion (ej. "Media"). */
  notionPriority: string;
  /** Cuerpo completo con secciones emoji, listo para convertir a bloques. */
  bodyMarkdown: string;
}

export interface IncidentApiSuccess {
  ok: true;
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
  /** Presente cuando se procesa un documento con varias incidencias. */
  created?: CreatedIncidentSummary[];
  total?: number;
}

export interface CreatedIncidentSummary {
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
}

export interface IncidentApiError {
  ok: false;
  error: string;
}

export type IncidentApiResponse = IncidentApiSuccess | IncidentApiError;

/**
 * Error de negocio que transporta un código HTTP semántico hasta el Route Handler.
 */
export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}
