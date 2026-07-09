import type { PerfilDesarrollador } from "./proforma-calc";

export interface ProformaActividad {
  id: string;
  actividad: string;
  descripcion: string;
  horas: number;
}

export interface ProformaActividadInput {
  actividad: string;
  descripcion: string;
  horas: number;
}

export interface ProformaPreviewDatos {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  perfil: PerfilDesarrollador;
  actividades: ProformaActividadInput[];
}

let actividadSeq = 0;

export function nuevaActividad(partial?: Partial<ProformaActividadInput>): ProformaActividad {
  actividadSeq += 1;
  return {
    id: `act-${actividadSeq}`,
    actividad: partial?.actividad ?? "",
    descripcion: partial?.descripcion ?? "",
    horas: partial?.horas ?? 0,
  };
}

export function sumarHorasActividades(actividades: ProformaActividadInput[]): number {
  return actividades.reduce((sum, a) => sum + (Number.isFinite(a.horas) ? a.horas : 0), 0);
}

export type HorasCuadre = "ok" | "excede" | "falta";

export function validarHorasActividades(
  horasTotales: number,
  actividades: ProformaActividadInput[]
): { cuadre: HorasCuadre; suma: number } {
  const suma = sumarHorasActividades(actividades);
  if (horasTotales <= 0) return { cuadre: "ok", suma };
  if (suma > horasTotales) return { cuadre: "excede", suma };
  if (suma < horasTotales && actividades.some((a) => a.actividad.trim() || a.descripcion.trim())) {
    return { cuadre: "falta", suma };
  }
  return { cuadre: "ok", suma };
}
