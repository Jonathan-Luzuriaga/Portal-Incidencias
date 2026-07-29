/**
 * Tipos compartidos (server + client) para el Registro de Jornada Diaria.
 * Sin dependencias de Notion para poder importarse desde componentes cliente.
 */

/** Una fila del Registro de Jornada Diaria (Notion). */
export interface JornadaEntry {
  id: string;
  /** Título de la jornada (columna "Jornada"). */
  jornada: string;
  /** Valor del select "Miembro del Equipo". */
  member: string;
  /** Fecha local (YYYY-MM-DD) de "Horas trabajadas". */
  date: string;
  /** Inicio ISO del rango "Horas trabajadas". */
  start: string | null;
  /** Fin ISO del rango "Horas trabajadas". */
  end: string | null;
  /** Texto crudo de la fórmula "Suma de horas" (ej. "5H 00M"). */
  sumaText: string;
  /** Minutos parseados desde "Suma de horas". */
  minutes: number;
}

/** Resultado agregado de un periodo de facturación para un miembro. */
export interface JornadaTotals {
  member: string;
  /** Límites del periodo (YYYY-MM-DD), ambos inclusivos. */
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  /** Etiqueta legible del total (ej. "42h 30m"). */
  totalLabel: string;
  /** Total en horas decimales (ej. 42.5). */
  totalDecimalHours: number;
  count: number;
  entries: JornadaEntry[];
}

export interface JornadaApiResponse {
  ok: boolean;
  error?: string;
  totals?: JornadaTotals;
}

export interface JornadaOptionsResponse {
  ok: boolean;
  error?: string;
  members?: string[];
}

/** Tarea seleccionable para enlazar en una jornada. */
export interface JornadaTaskOption {
  id: string;
  title: string;
  ticketType: string;
}

/** Responsable (usuario Notion) para filtrar tareas y opcionalmente enlazar. */
export interface JornadaUserOption {
  id: string;
  name: string;
}

export interface JornadaTasksResponse {
  ok: boolean;
  error?: string;
  tasks?: JornadaTaskOption[];
  users?: JornadaUserOption[];
}

/** Payload para crear una jornada (rango fecha/hora inicio → fecha/hora fin). */
export interface CreateJornadaInput {
  member: string;
  title: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:MM (24h) */
  startTime: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** HH:MM (24h) */
  endTime: string;
  taskIds: string[];
  responsableId?: string;
}

export interface JornadaCreateResponse {
  ok: boolean;
  error?: string;
  page?: { id: string; url: string };
  /** Total calculado del rango (para feedback inmediato). */
  totalLabel?: string;
}
