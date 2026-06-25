export type TeamTicketType = "Épica" | "Tarea" | "Bug";

export const TEAM_TICKET_TYPES: TeamTicketType[] = ["Tarea", "Bug", "Épica"];

export type TeamPriority = "Alta" | "Media" | "Baja";

export const TEAM_PRIORITIES: TeamPriority[] = ["Alta", "Media", "Baja"];

export type TeamClient = "Bago" | "Manticore Labs" | "Plasticaucho";

export const TEAM_CLIENTS: TeamClient[] = ["Manticore Labs", "Bago", "Plasticaucho"];

export type TeamEnvironment = "Desarrollo" | "QA" | "Despliegue";

export const TEAM_ENVIRONMENTS: TeamEnvironment[] = ["Desarrollo", "QA", "Despliegue"];

export type TeamScope = "Frontend" | "Backend" | "Fullstack";

export const TEAM_SCOPES: TeamScope[] = ["Frontend", "Backend", "Fullstack"];

export interface TeamProjectOption {
  relationId: string;
  label: string;
}

export interface TeamClientProjectOption {
  value: string;
  label: string;
}

export interface TeamSubtaskInput {
  title: string;
  shortDescription: string;
  bodyMarkdown?: string;
  enabled: boolean;
}

/** Tareas adicionales en un mismo envío (tipo Tarea, sin subtareas). */
export interface TeamAdditionalTaskInput {
  rawInput: string;
  title: string;
  shortDescription: string;
  bodyMarkdown: string;
}

export interface TeamUserOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface TeamParentOption {
  id: string;
  title: string;
  ticketType: string;
}

/** Datos del formulario interno de equipo (ingesta PM). */
export interface TeamTaskFormData {
  title: string;
  shortDescription: string;
  bodyMarkdown: string;
  ticketType: TeamTicketType;
  priority: TeamPriority;
  client: TeamClient;
  clientProject: string;
  projectRelationId: string;
  assigneeIds: string[];
  reviewerIds: string[];
  parentTaskId: string;
  additionalTasks: TeamAdditionalTaskInput[];
  environment: TeamEnvironment;
  scope: TeamScope;
  categories: string[];
  category: string;
  tags: string[];
  subtasks: TeamSubtaskInput[];
  prLink: string;
  hours: number | null;
}

export interface CreatedTeamTaskSummary {
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
}

export interface TeamTaskApiSuccess {
  ok: true;
  pageId: string;
  pageUrl: string | null;
  taskTitle: string;
  evidenceCount: number;
  created: CreatedTeamTaskSummary[];
}

export interface TeamTaskApiError {
  ok: false;
  error: string;
}

export type TeamTaskApiResponse = TeamTaskApiSuccess | TeamTaskApiError;

export interface FormattedSubtask {
  title: string;
  shortDescription: string;
  bodyMarkdown?: string;
}

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
  subtasks: FormattedSubtask[];
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

export interface TeamOptionsApiSuccess {
  ok: true;
  users: TeamUserOption[];
  projects: TeamProjectOption[];
  clientProjects: TeamClientProjectOption[];
  parents: TeamParentOption[];
}

export interface TeamOptionsApiError {
  ok: false;
  error: string;
}

export type TeamOptionsApiResponse = TeamOptionsApiSuccess | TeamOptionsApiError;
