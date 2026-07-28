import {
  ROL_DEFAULT,
  tarifaDefault,
  type RolEncargado,
} from "./proforma-calc";

export interface ProformaActividad {
  id: string;
  actividad: string;
  descripcion: string;
  horas: number;
  rol: RolEncargado;
  valorHora: number;
}

export interface ProformaActividadInput {
  actividad: string;
  descripcion: string;
  horas: number;
  rol: RolEncargado;
  valorHora: number;
}

export interface ProformaPreviewDatos {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  actividades: ProformaActividadInput[];
  /** Si true, la proforma es por garantía (total $0). */
  esGarantia?: boolean;
}

let actividadSeq = 0;

export function nuevaActividad(partial?: Partial<ProformaActividadInput>): ProformaActividad {
  actividadSeq += 1;
  const rol = partial?.rol ?? ROL_DEFAULT;
  const valorHora =
    partial?.valorHora != null && Number.isFinite(partial.valorHora)
      ? partial.valorHora
      : tarifaDefault(rol);
  return {
    id: `act-${actividadSeq}`,
    actividad: partial?.actividad ?? "",
    descripcion: partial?.descripcion ?? "",
    horas: partial?.horas ?? 0,
    rol,
    valorHora,
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
