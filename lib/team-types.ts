export type TeamTicketType = "Épica" | "Tarea" | "Bug";

export const TEAM_TICKET_TYPES: TeamTicketType[] = ["Tarea", "Bug", "Épica"];

export type TeamPriority = "Alta" | "Media" | "Baja";

export const TEAM_PRIORITIES: TeamPriority[] = ["Alta", "Media", "Baja"];

export type TeamClient = "Bago" | "Manticore Labs" | "Plasticaucho";

export const TEAM_CLIENTS: TeamClient[] = ["Manticore Labs", "Bago", "Plasticaucho"];

/** Datos del formulario interno de equipo. */
export interface TeamTaskFormData {
  title: string;
  shortDescription: string;
  bodyMarkdown: string;
  ticketType: TeamTicketType;
  priority: TeamPriority;
  client: TeamClient;
  clientProject: string;
  projectRelationId: string;
  category: string;
  tags: string[];
  prLink: string;
  hours: number | null;
}

export interface TeamTaskApiSuccess {
  ok: true;
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
}

export interface TeamTaskApiError {
  ok: false;
  error: string;
}

export type TeamTaskApiResponse = TeamTaskApiSuccess | TeamTaskApiError;

/** Resultado estructurado por DeepSeek a partir de texto en bruto. */
export interface FormattedTeamTask {
  title: string;
  shortDescription: string;
  bodyMarkdown: string;
  ticketType: TeamTicketType;
  priority: TeamPriority;
  category: string;
  tags: string[];
  client: TeamClient;
  clientProject: string;
  hours: number | null;
}

export interface TeamStructureApiSuccess {
  ok: true;
  formatted: FormattedTeamTask;
}

export interface TeamStructureApiError {
  ok: false;
  error: string;
}

export type TeamStructureApiResponse = TeamStructureApiSuccess | TeamStructureApiError;
